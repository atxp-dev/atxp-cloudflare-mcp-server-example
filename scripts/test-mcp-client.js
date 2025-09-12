#!/usr/bin/env node

/**
 * Configurable MCP client test script
 * 
 * Usage:
 *   node scripts/test-mcp-client.js [URL]
 *   npm run test:local    # Test local dev server
 *   npm run test:remote   # Test deployed server
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

// Default URLs
const LOCAL_URL = 'http://localhost:8787/sse';
const REMOTE_URL = 'https://mcp-server.robdimarco-125.workers.dev/sse';

// Get URL from command line arg or environment variable
const serverUrl = process.argv[2] || process.env.MCP_SERVER_URL || REMOTE_URL;

async function testMCPServer(url) {
  const urlType = url.includes('localhost') ? '🏠 LOCAL' : '☁️  REMOTE';
  
  console.log('🧪 Testing MCP Server');
  console.log(`📍 URL: ${url} (${urlType})`);
  console.log('━'.repeat(60));
  console.log('');

  // Create SSE transport
  const transport = new SSEClientTransport(new URL(url));
  const client = new Client(
    {
      name: 'mcp-test-client',
      version: '1.0.0',
    },
    {
      capabilities: {}
    }
  );

  try {
    // Connect to the server
    console.log('🔌 Connecting to MCP server...');
    await client.connect(transport);
    console.log('✅ Connected successfully!');
    console.log('');

    // Get server info
    console.log('ℹ️  Server information:');
    const serverInfo = await client.getServerVersion();
    console.log(`   Name: ${serverInfo.name}`);
    console.log(`   Version: ${serverInfo.version}`);
    console.log('');

    // List available tools
    console.log('🔍 Listing available tools...');
    const toolsResponse = await client.listTools();
    console.log(`   Found ${toolsResponse.tools.length} tool(s):`);
    toolsResponse.tools.forEach(tool => {
      console.log(`   • ${tool.name}: ${tool.description || 'No description'}`);
    });
    console.log('');

    // Test each tool found
    for (const tool of toolsResponse.tools) {
      if (tool.name === 'hello_world') {
        await testHelloWorldTool(client);
      }
    }

    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.message.includes('ECONNREFUSED') && url.includes('localhost')) {
      console.log('💡 Hint: Make sure to start the local dev server first:');
      console.log('   npm run dev');
    }
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    // Close the connection
    try {
      await client.close();
      console.log('🔌 Connection closed cleanly');
    } catch (closeError) {
      console.error('⚠️  Error closing connection:', closeError.message);
    }
  }
}

async function testHelloWorldTool(client) {
  console.log('🧪 Testing hello_world tool:');
  
  // Test 1: Without parameters
  console.log('   📞 Calling hello_world() without parameters...');
  const result1 = await client.callTool({
    name: 'hello_world',
    arguments: {}
  });
  console.log(`   📝 Result: "${result1.content[0].text}"`);
  
  // Test 2: With name parameter
  console.log('   📞 Calling hello_world({ name: "MCP Tester" })...');
  const result2 = await client.callTool({
    name: 'hello_world',
    arguments: { name: 'MCP Tester' }
  });
  console.log(`   📝 Result: "${result2.content[0].text}"`);
  
  // Test 3: With different name
  console.log('   📞 Calling hello_world({ name: "Cloudflare" })...');
  const result3 = await client.callTool({
    name: 'hello_world',
    arguments: { name: 'Cloudflare' }
  });
  console.log(`   📝 Result: "${result3.content[0].text}"`);
  console.log('');
}

// Show usage information
function showUsage() {
  console.log('MCP Client Test Script');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/test-mcp-client.js [URL]');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/test-mcp-client.js                                    # Test remote server (default)');
  console.log(`  node scripts/test-mcp-client.js ${LOCAL_URL}     # Test local server`);
  console.log(`  node scripts/test-mcp-client.js ${REMOTE_URL}    # Test remote server`);
  console.log('');
  console.log('Environment variable:');
  console.log('  MCP_SERVER_URL=http://localhost:8787/sse node scripts/test-mcp-client.js');
  console.log('');
  console.log('NPM scripts (recommended):');
  console.log('  npm run test:local     # Test local development server');
  console.log('  npm run test:remote    # Test deployed server');
}

// Handle help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

// Run the test
console.log('');
testMCPServer(serverUrl).catch(console.error);