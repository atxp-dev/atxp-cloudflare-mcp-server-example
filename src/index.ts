import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BigNumber } from "bignumber.js";
import { requirePayment } from "./requirePaymentWorker.js";
import { ATXPWorkerMiddleware } from "./atxpWorkerMiddleware.js";
import { buildWorkerATXPConfig, getATXPWorkerContext } from "./atxpWorkerContext.js";
import { Network } from "@atxp/common";

// Define auth context type for our ATXP integration
interface ATXPAuthContext {
  user?: string;
  claims?: {
    sub?: string;
    name?: string;
  };
  [key: string]: unknown; // Index signature to satisfy Record<string, unknown> constraint
}

// Define our MCP agent with ATXP payment integration
export class MyMCP extends McpAgent<Env, unknown, ATXPAuthContext> {
	server = new McpServer({
		name: "ATXP-Protected Hello World MCP Server",
		version: "1.0.0",
	});

	async init() {
		// Payment-protected hello_world tool
		this.server.tool(
			"hello_world", 
			{ name: z.string().optional() }, 
			async ({ name }) => {
				// Require payment of 0.01 USDC before processing
				// Pass the authenticated user from this.props
				await requirePayment({ 
					price: new BigNumber(0.01),
					authenticatedUser: this.props?.user
				});

				const greeting = name ? `Hello, ${name}!` : "Hello, World!";
				const userInfo = this.props?.claims?.name || this.props?.user || "anonymous user";
				const message = `${greeting} Thanks for your 0.01 USDC payment, ${userInfo}! 💰`;
				
				return {
					content: [{ type: "text", text: message }],
				};
			}
		);
	}

	// Static ATXP middleware instance
	public static atxpMiddleware: ATXPWorkerMiddleware | null = null;
	
	// Store ATXP config globally for access during tool execution
	public static atxpConfig: any = null;
	
	// Authentication now handled via ctx.props - no global state needed

	// Initialize ATXP middleware
	static initATXP(env: Env) {
		if (!env.FUNDING_DESTINATION) {
			throw new Error('FUNDING_DESTINATION environment variable not set - running in demo mode');
		}
		if (!env.FUNDING_NETWORK) {
			throw new Error('FUNDING_NETWORK environment variable not set - running in demo mode');
		}

		const atxpArgs = {
			destination: env.FUNDING_DESTINATION!,
			network: env.FUNDING_NETWORK as Network,
			payeeName: 'ATXP MCP Server Demo',
			allowHttp: env.NODE_ENV === 'development',
		};

		// Build config once and reuse it
		MyMCP.atxpConfig = buildWorkerATXPConfig(atxpArgs);
		MyMCP.atxpMiddleware = new ATXPWorkerMiddleware(MyMCP.atxpConfig);
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		try {
			const url = new URL(request.url);

			// Handle OAuth metadata endpoint BEFORE authentication
			if (url.pathname === "/.well-known/oauth-protected-resource") {
				const metadata = {
					resource: url.origin + "/",
					resource_name: "ATXP MCP Server Demo",
					authorization_servers: ["https://auth.atxp.ai"],
					bearer_methods_supported: ["header"],
					scopes_supported: ["read", "write"],
				};
				
				return new Response(JSON.stringify(metadata), {
					status: 200,
					headers: { "Content-Type": "application/json" }
				});
			}

			// Initialize empty auth context
			let authContext: ATXPAuthContext = {};

			// Initialize ATXP middleware (with error handling for missing env vars)
			try {
				if (!MyMCP.atxpMiddleware) {
					MyMCP.initATXP(env);
				}
				
				// Check if ATXP middleware should handle this request
				const atxpResponse = await MyMCP.atxpMiddleware!.handleRequest(request, env);
				if (atxpResponse) {
					return atxpResponse;
				}

				// DEBUG: Extract authentication data from ATXP context
				const atxpWorkerContext = getATXPWorkerContext();
				
				if (atxpWorkerContext) {
					const tokenData = atxpWorkerContext.getTokenData();
					authContext = {
						user: atxpWorkerContext.atxpAccountId() || undefined,
						claims: {
							sub: tokenData?.sub,
							name: tokenData?.name,
						}
					};
				}
			} catch (error) {
				console.error('ATXP middleware error:', error);
			}

			// CRITICAL: Create extended context with props
			const extendedCtx = {
				...ctx,
				props: authContext  // This is where ctx.props gets populated!
			};

			// Use standard MCP agent routing with extended context
			if (url.pathname === "/sse" || url.pathname === "/sse/message") {
				return MyMCP.serveSSE("/sse").fetch(request, env, extendedCtx);
			}

			if (url.pathname === "/mcp") {
				return MyMCP.serve("/mcp").fetch(request, env, extendedCtx);
			}

			// Handle root path for MCP connections (what ATXP client expects)
			if (url.pathname === "/") {
				return MyMCP.serve("/").fetch(request, env, extendedCtx);
			}

			return new Response("Not found", { status: 404 });
			
		} catch (error) {
			console.error('Error in main fetch handler:', error);
			return new Response(JSON.stringify({
				error: 'server_error',
				error_description: error instanceof Error ? error.message : 'Unknown error'
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	},
};