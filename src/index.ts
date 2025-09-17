import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BigNumber } from "bignumber.js";
import { requirePayment, atxpCloudflare } from "@atxp/cloudflare";

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
				// Pass the authenticated user and ATXP init params from this.props
				await requirePayment({ 
					price: new BigNumber(0.01),
				});

				const greeting = name ? `Hello, ${name}!` : "Hello, World!";
				const userInfo = this.props?.user || "anonymous user";
				const message = `${greeting} Thanks for your 0.01 USDC payment, ${userInfo}! 💰`;
				
				return {
					content: [{ type: "text", text: message }],
				};
			}
		);
	}	
}

// Use the new simplified ATXP Cloudflare Worker wrapper
export default {
	async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
		// Create the handler with environment-based configuration
		const handler = atxpCloudflare({
			mcpAgent: MyMCP,
			payeeName: "ATXP MCP Server Demo",
			allowHttp: env.ALLOW_INSECURE_HTTP_REQUESTS_DEV_ONLY_PLEASE === 'true',
			destination: env.FUNDING_DESTINATION,
			network: env.FUNDING_NETWORK
		});
		
		return handler.fetch(request, env, ctx);
	}
};
