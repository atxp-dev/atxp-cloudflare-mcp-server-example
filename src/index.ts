import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BigNumber } from "bignumber.js";
import { requirePayment } from "./requirePaymentWorker.js";
import { ATXPWorkerMiddleware } from "./atxpWorkerMiddleware.js";
import { clearATXPWorkerContext } from "./atxpWorkerContext.js";

// Define our MCP agent with ATXP payment integration
export class MyMCP extends McpAgent {
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
				await requirePayment({ price: new BigNumber(0.01) });

				const greeting = name ? `Hello, ${name}!` : "Hello, World!";
				const message = `${greeting} [Demo Mode: Payment of 0.01 USDC simulated] 💰`;
				
				return {
					content: [{ type: "text", text: message }],
				};
			}
		);
	}

	// Static ATXP middleware instance
	public static atxpMiddleware: ATXPWorkerMiddleware | null = null;

	// Initialize ATXP middleware
	static initATXP(env: Env) {
		if (!env.SOLANA_DESTINATION) {
			console.warn('SOLANA_DESTINATION environment variable not set - running in demo mode');
		}

		MyMCP.atxpMiddleware = new ATXPWorkerMiddleware({
			destination: env.SOLANA_DESTINATION || 'demo-destination',
			server: (env.ATXP_SERVER || 'https://auth.atxp.ai') as any,
			payeeName: 'ATXP MCP Server Demo',
			allowHttp: env.NODE_ENV === 'development',
			currency: 'USDC' as const,
			network: 'base' as const,
		});
	}

}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		try {
			// Clear any lingering context from previous requests
			clearATXPWorkerContext();

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
			} catch (error) {
				console.error('ATXP middleware error:', error);
				// Continue without ATXP if there's an error
			}

			const url = new URL(request.url);

			// Use standard MCP agent routing
			if (url.pathname === "/sse" || url.pathname === "/sse/message") {
				return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
			}

			if (url.pathname === "/mcp") {
				return MyMCP.serve("/mcp").fetch(request, env, ctx);
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
		} finally {
			// Clean up context after request
			clearATXPWorkerContext();
		}
	},
};
