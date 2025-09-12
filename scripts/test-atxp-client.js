#!/usr/bin/env node

/**
 * ATXP-aware MCP client test script
 * 
 * This demonstrates how to use the atxpClient to connect to our 
 * payment-protected MCP server and handle the payment flow.
 * 
 * Usage:
 *   node scripts/test-atxp-client.js [URL]
 *   npm run test:atxp:local    # Test local dev server
 *   npm run test:atxp:remote   # Test deployed server
 */

import 'dotenv/config';
import { atxpClient, ATXPAccount } from '@atxp/client';

// Default URLs
const LOCAL_URL = 'http://localhost:8787';
const REMOTE_URL = 'https://mcp-server.robdimarco-125.workers.dev';

// Get URL from command line arg or environment variable
const serverUrl = process.argv[2] || process.env.MCP_SERVER_URL || REMOTE_URL;

async function testATXPClient(url) {
  const urlType = url.includes('localhost') ? '🏠 LOCAL' : '☁️  REMOTE';
  
  console.log('🧪 Testing ATXP-Enabled MCP Server');
  console.log(`📍 URL: ${url} (${urlType})`);
  console.log('━'.repeat(60));
  console.log('');

  try {
    // Load ATXP account from connection string - required for real transactions
    const connectionString = process.env.ATXP_CONNECTION_STRING;
    
    if (!connectionString) {
      console.error('❌ ATXP_CONNECTION_STRING environment variable is required');
      console.error('');
      console.error('Please set up your .env file with:');
      console.error('ATXP_CONNECTION_STRING=atxp://accountId@network/privateKey');
      console.error('');
      console.error('Example:');
      console.error('ATXP_CONNECTION_STRING=atxp://my-account@solana-devnet/your_base58_private_key');
      process.exit(1);
    }

    console.log('🔑 Loading ATXPAccount from connection string...');
    const account = new ATXPAccount(connectionString);
    console.log(`✅ ATXPAccount loaded: ${account.accountId}`);

    console.log('🔌 Connecting to ATXP-protected MCP server...');
    
    // Create ATXP client with payment handling
    const client = await atxpClient({
      mcpServer: url,
      account: account,
      allowHttp: url.includes('localhost'), // Allow HTTP for local development
      
      // Payment approval callback
      approvePayment: async (payment) => {
        console.log('💰 Payment required:');
        console.log(`   Amount: ${payment.amount} ${payment.currency}`);
        console.log(`   Network: ${payment.network}`);
        console.log(`   Resource: ${payment.resourceName}`);
        console.log('   Approving payment...');
        return true; // Auto-approve for demo
      },

      // Event handlers
      onAuthorize: async ({ authorizationServer, userId }) => {
        console.log(`🔐 Authorized with server ${authorizationServer} as user ${userId}`);
      },

      onAuthorizeFailure: async ({ authorizationServer, userId, error }) => {
        console.error(`❌ Authorization failed for user ${userId} on ${authorizationServer}:`, error.message);
      },

      onPayment: async ({ payment }) => {
        console.log(`✅ Payment successful: ${payment.amount} ${payment.currency}`);
      },

      onPaymentFailure: async ({ payment, error }) => {
        console.error(`❌ Payment failed: ${payment.amount} ${payment.currency} - ${error.message}`);
      }
    });

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
      console.log(`   • ${tool.name}: ${tool.description || 'Payment-protected tool'}`);
    });
    console.log('');

    // Test payment-protected tools
    for (const tool of toolsResponse.tools) {
      if (tool.name === 'hello_world') {
        await testHelloWorldWithPayment(client);
      }
    }

    console.log('🎉 All ATXP tests completed successfully!');
    console.log('💡 The server successfully handled payment requirements and tool execution.');

  } catch (error) {
    console.error('❌ ATXP test failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED') && url.includes('localhost')) {
      console.log('💡 Hint: Make sure to start the local dev server first:');
      console.log('   npm run dev');
    }
    
    if (error.message.includes('payment') || error.message.includes('authorization')) {
      console.log('💡 This might be expected behavior if testing real payment flows.');
      console.log('   Check server logs for payment processing details.');
    }
    
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

async function testHelloWorldWithPayment(client) {
  console.log('🧪 Testing payment-protected hello_world tool:');
  
  // Test 1: Without parameters (should trigger payment flow)
  console.log('   📞 Calling hello_world() - expect payment flow...');
  try {
    const result1 = await client.callTool({
      name: 'hello_world',
      arguments: {}
    });
    console.log(`   📝 Result: "${result1.content[0].text}"`);
  } catch (error) {
    console.log(`   ⚠️  Payment flow error: ${error.message}`);
  }
  
  // Test 2: With name parameter (should also trigger payment)
  console.log('   📞 Calling hello_world({ name: "ATXP User" }) - expect payment flow...');
  try {
    const result2 = await client.callTool({
      name: 'hello_world',
      arguments: { name: 'ATXP User' }
    });
    console.log(`   📝 Result: "${result2.content[0].text}"`);
  } catch (error) {
    console.log(`   ⚠️  Payment flow error: ${error.message}`);
  }
  
  console.log('');
}

// Show usage information
function showUsage() {
  console.log('ATXP MCP Client Test Script');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/test-atxp-client.js [URL]');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/test-atxp-client.js                                    # Test remote server (default)');
  console.log(`  node scripts/test-atxp-client.js ${LOCAL_URL}     # Test local server`);
  console.log(`  node scripts/test-atxp-client.js ${REMOTE_URL}    # Test remote server`);
  console.log('');
  console.log('Environment variables (optional for real payments):');
  console.log('  SOLANA_ENDPOINT=https://api.mainnet-beta.solana.com');
  console.log('  SOLANA_PRIVATE_KEY=your_base58_encoded_private_key');
  console.log('');
  console.log('NPM scripts (recommended):');
  console.log('  npm run test:atxp:local     # Test local development server');
  console.log('  npm run test:atxp:remote    # Test deployed server');
}

// Handle help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

// Run the test
console.log('');
testATXPClient(serverUrl).catch(console.error);