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

Copy `.env.example` to `.env` and configure:

```bash
# ATXP Authentication Server
ATXP_SERVER=https://auth.atxp.ai

# Development security setting - allows HTTP for localhost testing
ALLOW_INSECURE_HTTP_REQUESTS_DEV_ONLY_PLEASE=true

# Your ATXP connection string for client testing
ATXP_CONNECTION_STRING=https://accounts.atxp.ai?connection_token=YOUR_TOKEN

# Payment destination (your wallet address)
FUNDING_DESTINATION=0x7F9D1a879750168b8f4A59734B1262D1778fDB5A
FUNDING_NETWORK=base
```

### Production Deployment

Update `wrangler.jsonc` with your production settings:

```json
{
  "vars": {
    "ATXP_SERVER": "https://auth.atxp.ai",
    "FUNDING_DESTINATION": "0xYOUR_WALLET_ADDRESS",
    "FUNDING_NETWORK": "base",
    "ALLOW_INSECURE_HTTP_REQUESTS_DEV_ONLY_PLEASE": "false"
  }
}
```

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
import { atxpCloudflareWorkerFromEnv } from "./atxp/atxpMcpApi.js";

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    // Create the handler with environment-based configuration
    const handler = atxpCloudflareWorkerFromEnv({
      mcpAgent: MyMCP,
      serviceName: "ATXP MCP Server Demo",
      allowHttp: env.ALLOW_INSECURE_HTTP_REQUESTS_DEV_ONLY_PLEASE === 'true',
      fundingDestination: env.FUNDING_DESTINATION,
      fundingNetwork: env.FUNDING_NETWORK
    });
    
    return handler.fetch(request, env, ctx);
  }
};
```

### 2. Add Payment-Protected Tools

Add payment-protected tools in your MCP class:

```typescript
// Add to MyMCP class init() method
this.server.tool(
  "my_premium_tool",
  { input: z.string() },
  async ({ input }) => {
    // Require payment before processing
    await requirePayment({ 
      price: new BigNumber(0.05), // 0.05 USDC
      authenticatedUser: this.props?.user,
      atxpInitParams: this.props?.atxpInitParams
    });

    // Your tool logic here
    return {
      content: [{ type: "text", text: `Processed: ${input}` }]
    };
  }
);
```

## API Reference

### ATXP Integration Functions

#### `atxpCloudflareWorkerFromEnv(options)`

Main wrapper for creating ATXP-protected Cloudflare Workers:

```typescript
atxpCloudflareWorkerFromEnv({
  mcpAgent: MyMCP,                    // Your MCP agent class
  serviceName?: string,               // Display name for OAuth
  allowHttp?: boolean,                // Allow HTTP for development
  fundingDestination: string,         // Wallet address for payments
  fundingNetwork: Network,            // Blockchain network ("base", etc.)
  mountPaths?: {                      // Optional custom paths
    mcp?: string,
    sse?: string, 
    root?: string
  }
})
```

#### `requirePayment(config)`

Payment enforcement in tool handlers:

```typescript
await requirePayment({
  price: BigNumber,                   // Payment amount in USDC
  authenticatedUser?: string,         // User ID from this.props?.user
  atxpInitParams?: ATXPMcpConfig     // ATXP config from this.props?.atxpInitParams
});
```

### Environment Variables

- `FUNDING_DESTINATION` - Wallet address for receiving payments
- `FUNDING_NETWORK` - Blockchain network (e.g., "base", "ethereum")
- `ATXP_SERVER` - ATXP authentication server URL
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
