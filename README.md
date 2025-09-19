# ATXP-Protected MCP Server on Cloudflare Workers

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/atxp-dev/atxp-cloudflare-mcp-server-example/)


This example demonstrates how to build a payment-protected MCP server using ATXP (Authentic Transaction Protocol) on Cloudflare Workers. Users must pay in cryptocurrency (USDC on Base network) to use the MCP tools.

## Features

- 🛡️ **OAuth Authentication** - Users authenticate with ATXP before accessing tools
- 💰 **Cryptocurrency Payments** - Real USDC payments on Base network required for tool usage
- ⚡ **Cloudflare Workers** - Serverless deployment with Durable Objects for MCP agents
- 🔒 **Production Ready** - Secure HTTPS-only configuration for production deployment
- 🧪 **Development Friendly** - Local HTTP support for testing

## Architecture

- **Main Worker**: Handles ATXP authentication and OAuth challenges
- **Durable Objects**: Isolated MCP agent instances with payment protection
- **ATXP Integration**: Seamless payment flow with on-chain settlement

## Getting Started

### Prerequisites

1. Cloudflare account with Workers enabled
2. ATXP account for payments (sign up at https://accounts.atxp.ai)
3. Cryptocurrency wallet for receiving payments

### Environment Configuration

Add the following to `.env`.

```bash
# Development security setting - allows HTTP for localhost testing
ALLOW_INSECURE_HTTP_REQUESTS_DEV_ONLY_PLEASE=true

# Your ATXP connection string for receiving payments and client testing
ATXP_CONNECTION_STRING=https://accounts.atxp.ai?connection_token=YOUR_TOKEN
```

### Production Deployment
Use `wranger secret put ATXP_CONNECTION_STRING` to set your connection string

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

## Usage

### Testing Locally

```bash
# Start development server
npm run dev

# Test with ATXP client (in another terminal)
npm run test:local
```

### Testing Production

```bash
# Test deployed server
npm run test:remote
```

## Creating Your Own ATXP-Protected Server

### 1. Set Up the Fetch Handler

Create your main handler in `src/index.ts`:

```typescript
import { McpAgent } from "agents/mcp";
import { atxpCloudflare, type ATXPCloudflareOptions } from "@atxp/cloudflare";
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
    paymentDestination,
  } as ATXPCloudflareOptions;
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const cloudflareOptions = createOptions(env);
    const handler = atxpCloudflare(cloudflareOptions);
    const response = await handler.fetch(request, env, ctx);
    return response;
  }
};
```

### 2. Add Payment-Protected Tools

Add payment-protected tools in your MCP class:

```typescript
import { requirePayment } from "@atxp/cloudflare";
import { BigNumber } from "bignumber.js";

// Add to MyMCP class init() method
this.server.tool(
  "my_premium_tool",
  { input: z.string() },
  async ({ input }) => {
    if (!this.props) {
      throw new Error("ATXP props are not initialized");
    }

    const options = createOptions(this.env);
    await requirePayment(
      {
        price: new BigNumber(0.05), // 0.05 USDC
      },
      options,
      this.props,
    );

    // Your tool logic here
    return {
      content: [{ type: "text", text: `Processed: ${input}` }]
    };
  }
);
```

## API Reference

### ATXP Integration Functions

#### `atxpCloudflare(options)`

Main wrapper for creating ATXP-protected Cloudflare Workers:

```typescript
atxpCloudflare({
  mcpAgent: MyMCP,                    // Your MCP agent class
  payeeName?: string,                 // Display name for OAuth
  allowHttp?: boolean,                // Allow HTTP for development
  paymentDestination: ATXPPaymentDestination, // Payment destination instance
  mountPaths?: {                      // Optional custom paths
    mcp?: string,
    sse?: string,
    root?: string
  }
})
```

#### `requirePayment(paymentRequest, options, props)`

Payment enforcement in tool handlers:

```typescript
await requirePayment(
  {
    price: BigNumber,                 // Payment amount in USDC
  },
  options: ATXPCloudflareOptions,     // Options from createOptions()
  props: ATXPMCPAgentProps            // ATXP props from this.props
);
```

### Environment Variables

- `ATXP_CONNECTION_STRING` - ATXP connection string containing payment destination and network configuration
- `ALLOW_INSECURE_HTTP_REQUESTS_DEV_ONLY_PLEASE` - HTTP allowance for development


## Contributing

When adding features:

1. Ensure proper ATXP initialization in Durable Objects
2. Use `ATXPAuthContext` for authentication data
3. Follow the environment variable naming convention
4. Test both local and production deployments

## Learn More

- [ATXP Documentation](https://docs.atxp.ai)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [Base Network](https://base.org/)
