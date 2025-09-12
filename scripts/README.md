# MCP Test Scripts

This directory contains testing utilities for the MCP server.

## test-mcp-client.js

A configurable MCP client test script that can test both local and remote MCP servers.

### Quick Usage

```bash
# Test remote (deployed) server
npm run test:remote

# Test local development server
npm run test:local

# Test default (remote) server
npm test
```

### Manual Usage

```bash
# Test specific URL
node scripts/test-mcp-client.js http://localhost:8787/sse
node scripts/test-mcp-client.js https://mcp-server.robdimarco-125.workers.dev/sse

# Show help
node scripts/test-mcp-client.js --help

# Use environment variable
MCP_SERVER_URL=http://localhost:8787/sse node scripts/test-mcp-client.js
```

### What it tests

- ✅ MCP server connectivity
- ✅ Server information retrieval
- ✅ Tool discovery
- ✅ Tool functionality with various parameters
- ✅ Proper connection cleanup

### Example Output

```
🧪 Testing MCP Server
📍 URL: https://mcp-server.robdimarco-125.workers.dev/sse (☁️  REMOTE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔌 Connecting to MCP server...
✅ Connected successfully!

ℹ️  Server information:
   Name: Hello World MCP Server
   Version: 1.0.0

🔍 Listing available tools...
   Found 1 tool(s):
   • hello_world: No description

🧪 Testing hello_world tool:
   📞 Calling hello_world() without parameters...
   📝 Result: "Hello, World!"
   📞 Calling hello_world({ name: "MCP Tester" })...
   📝 Result: "Hello, MCP Tester!"

🎉 All tests completed successfully!
🔌 Connection closed cleanly
```

### Troubleshooting

**Local server connection failed?**
- Make sure the development server is running: `npm run dev`
- Check that port 8787 is available
- Verify the local URL is correct: `http://localhost:8787/sse`

**Remote server connection failed?**
- Check if the server is deployed: `npm run deploy`
- Verify the remote URL is accessible in a browser
- Check for network connectivity issues