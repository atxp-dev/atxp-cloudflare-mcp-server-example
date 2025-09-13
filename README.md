# ATXP-Protected MCP Server on Cloudflare Workers

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

## Creating Your Own ATXP-Protected Tools

Add payment-protected tools in `src/index.ts`:

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

- `atxpCloudflareWorkerFromEnv()` - Main wrapper for environment-based config
- `atxpCloudflareWorker()` - Lower-level wrapper with explicit config
- `requirePayment()` - Payment enforcement in tool handlers

### Environment Variables

- `FUNDING_DESTINATION` - Wallet address for receiving payments
- `FUNDING_NETWORK` - Blockchain network (e.g., "base", "ethereum")
- `ATXP_SERVER` - ATXP authentication server URL
- `ALLOW_INSECURE_HTTP_REQUESTS_DEV_ONLY_PLEASE` - HTTP allowance for development

## Security

- Production uses HTTPS-only OAuth flows
- Payments are settled on-chain with cryptographic proof
- Authentication tokens are introspected with ATXP servers
- Race conditions prevented through proper context isolation

## Development vs Production

| Feature | Development | Production |
|---------|-------------|------------|
| HTTP Requests | Allowed | Blocked |
| OAuth Flow | Local callback | HTTPS callback |
| Payments | Test network | Mainnet (Base) |
| Debugging | Console logs | Minimal logging |

## Testing

The project includes comprehensive testing:

- Local development server testing
- Production deployment verification  
- Payment flow validation
- Authentication integration testing

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
