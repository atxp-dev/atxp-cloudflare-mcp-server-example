import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BigNumber } from "bignumber.js";
import { requirePayment } from "./requirePaymentWorker.js";
import { ATXPMcpApi, ATXPAuthContext, ATXPEnv, initATXPFromEnv } from "./atxpMcpApi.js";

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

	// ATXP functionality now handled by ATXPMcpApi
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		try {
			const url = new URL(request.url);

			// Handle OAuth metadata endpoint BEFORE authentication
			if (url.pathname === "/.well-known/oauth-protected-resource") {
				return ATXPMcpApi.createOAuthMetadata(
					url.origin + "/",
					"ATXP MCP Server Demo"
				);
			}

			// Initialize empty auth context
			let authContext: ATXPAuthContext = {};

			// Initialize ATXP middleware (with error handling for missing env vars)
			try {
				if (!ATXPMcpApi.isInitialized()) {
					initATXPFromEnv(env, "ATXP MCP Server Demo");
				}
				
				// Check if ATXP middleware should handle this request
				const atxpResponse = await ATXPMcpApi.getMiddleware().handleRequest(request, env);
				if (atxpResponse) {
					return atxpResponse;
				}

				// Extract authentication data from ATXP context
				authContext = ATXPMcpApi.createAuthContext();
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