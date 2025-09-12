# ATXP MCP Test Scripts

This directory contains testing utilities for the ATXP-protected MCP server.

## test-atxp-client.js

An ATXP-aware MCP client test script that handles real payment transactions using ATXPAccount.

### Prerequisites

1. **Set up your .env file** (copy from .env.example):
   ```bash
   cp .env.example .env
   ```

2. **Configure ATXP_CONNECTION_STRING**:
   ```env
   ATXP_CONNECTION_STRING=atxp://your-account@network/your_private_key
   ```

### Quick Usage

```bash
# Test remote (deployed) server with real payments
npm run test:remote

# Test local development server with real payments
npm run test:local

# Test default (remote) server
npm test
```

### Manual Usage

```bash
# Test specific URL
node scripts/test-atxp-client.js http://localhost:8787
node scripts/test-atxp-client.js https://mcp-server.robdimarco-125.workers.dev

# Show help
node scripts/test-atxp-client.js --help

# Use environment variable
MCP_SERVER_URL=http://localhost:8787 node scripts/test-atxp-client.js
```

### What it tests

- ✅ ATXP account loading from connection string
- ✅ MCP server connectivity with ATXP authentication
- ✅ Payment flow handling for protected tools
- ✅ Real transaction processing (when configured)
- ✅ OAuth and authorization flows
- ✅ Tool execution after successful payment

### Example Output

```
🧪 Testing ATXP-Enabled MCP Server
📍 URL: https://mcp-server.robdimarco-125.workers.dev (☁️  REMOTE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔑 Loading ATXPAccount from connection string...
✅ ATXPAccount loaded: my-account

🔌 Connecting to ATXP-protected MCP server...
✅ Connected successfully!

💰 Payment required:
   Amount: 0.01 USDC
   Network: base
   Resource: Hello World MCP Server
   Approving payment...

🔄 Processing payment: 0.01 USDC to destination_wallet
✅ Payment successful: 0.01 USDC

📞 Testing payment-protected hello_world tool:
📝 Result: "Hello, World! Thanks for your 0.01 USDC payment! 💰"

🎉 All ATXP tests completed successfully!
```

### Troubleshooting

**ATXP_CONNECTION_STRING required error?**
- Copy `.env.example` to `.env`
- Set your ATXP connection string in the format: `atxp://accountId@network/privateKey`

**Local server connection failed?**
- Make sure the development server is running: `npm run dev`
- Check that port 8787 is available
- Verify the local URL is correct: `http://localhost:8787`

**Payment failures?**
- Ensure your ATXP account has sufficient balance
- Check network connectivity
- Verify your private key is correct
- Check server logs for payment processing details

**Remote server connection failed?**
- Check if the server is deployed: `npm run deploy`
- Verify the remote URL is accessible
- Check for network connectivity issues