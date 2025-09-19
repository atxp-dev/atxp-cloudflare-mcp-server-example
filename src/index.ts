import { McpAgent } from "agents/mcp";
import { BigNumber } from "bignumber.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
	requirePayment,
	atxpCloudflare,
	type ATXPMCPAgentProps,
	type ATXPCloudflareOptions,
} from "@atxp/cloudflare";
import { ATXPPaymentDestination } from "@atxp/server";

const createOptions = (env: Env) => {
	const paymentDestination = new ATXPPaymentDestination(
		env.ATXP_CONNECTION_STRING,
	);
	paymentDestination.destination =
		paymentDestination.destination.bind(paymentDestination);
	return {
		mcpAgent: MyMCP,
		payeeName: "ATXP MCP Server Demo",
		allowHttp: env.ALLOW_INSECURE_HTTP_REQUESTS_DEV_ONLY_PLEASE === "true",
		// Don't create the payment destination here - create it when needed
		paymentDestination,
	} as ATXPCloudflareOptions;
};

// Define our MCP agent with ATXP payment integration
export class MyMCP extends McpAgent<Env, unknown, ATXPMCPAgentProps> {
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
				if (!this.props) {
					throw new Error("ATXP props are not initialized");
				}

				const options = createOptions(this.env);
				await requirePayment(
					{
						price: new BigNumber(0.01),
					},
					options,
					this.props,
				);

				const greeting = name ? `Hello, ${name}!` : "Hello, World!";
				const userInfo = this.props.tokenCheck?.data?.sub || "anonymous user";
				const message = `${greeting} Thanks for your 0.01 USDC payment, ${userInfo}! 💰`;

				return {
					content: [{ type: "text", text: message }],
				};
			},
		);
	}
}

// Use the new simplified ATXP Cloudflare Worker wrapper
export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const cloudflareOptions = createOptions(env);
		const handler = atxpCloudflare(cloudflareOptions);
		const response = await handler.fetch(request, env, ctx);
		return response;
	},
};
