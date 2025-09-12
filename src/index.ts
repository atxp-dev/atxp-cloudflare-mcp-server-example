import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Hello World MCP Server",
		version: "1.0.0",
	});

	async init() {
		// Simple hello_world tool
		this.server.tool(
			"hello_world", 
			{ name: z.string().optional() }, 
			async ({ name }) => {
				const greeting = name ? `Hello, ${name}!` : "Hello, World!";
				return {
					content: [{ type: "text", text: greeting }],
				};
			}
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
