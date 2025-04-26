require('dotenv').config();
const Web3 = require('web3');

// Test configuration
const TEST_AMOUNT = 0.01; // Small amount for testing (0.01 USDT)
const USDT_CONTRACT = process.env.USDT_CONTRACT;
const PROJECT_WALLET = process.env.PROJECT_WALLET;
const WEB3_PROVIDER = process.env.WEB3_PROVIDER;
const WEB3_WS_PROVIDER = process.env.WEB3_WS_PROVIDER;
const TEST_SENDER = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'; // Your test wallet

// USDT Contract ABI (minimal for transfer event and balanceOf)
const USDT_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' }
    ],
    name: 'Transfer',
    type: 'event'
  },
  {
    constant: true,
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function'
  }
];

async function runBlockchainTest() {
  console.log('🔍 Starting blockchain-only test on Mumbai testnet');
  console.log(`💼 Project wallet: ${PROJECT_WALLET}`);
  console.log(`💰 Test amount: ${TEST_AMOUNT} USDT`);
  
  try {
    // Initialize Web3 HTTP for queries
    console.log('\n🔌 Connecting to Web3 HTTP provider...');
    const web3 = new Web3(WEB3_PROVIDER);
    console.log(`✅ Connected to HTTP provider: ${WEB3_PROVIDER}`);
    
    // Initialize Web3 WebSocket for subscriptions
    console.log('\n🔌 Connecting to Web3 WebSocket provider...');
    const web3Ws = new Web3(WEB3_WS_PROVIDER);
    console.log(`✅ Connected to WebSocket provider: ${WEB3_WS_PROVIDER}`);
    
    // Initialize contract for queries
    const usdtContract = new web3.eth.Contract(USDT_ABI, USDT_CONTRACT);
    // Initialize contract for events
    const usdtContractWs = new web3Ws.eth.Contract(USDT_ABI, USDT_CONTRACT);
    console.log(`✅ USDT contract initialized at: ${USDT_CONTRACT}`);
    
    // Check project wallet balance
    try {
      console.log('\n💰 Checking project wallet balance...');
      const balanceWei = await web3.eth.getBalance(PROJECT_WALLET);
      const balanceEth = web3.utils.fromWei(balanceWei, 'ether');
      console.log(`✅ Project wallet ETH balance: ${balanceEth} MATIC`);
    } catch (error) {
      console.error('❌ Error checking ETH balance:', error.message);
    }
    
    // Check USDT balance if possible
    try {
      console.log('\n💵 Checking USDT balance...');
      const balanceUSDT = await usdtContract.methods.balanceOf(PROJECT_WALLET).call();
      const formattedBalance = web3.utils.fromWei(balanceUSDT, 'mwei'); // USDT uses 6 decimals
      console.log(`✅ Project wallet USDT balance: ${formattedBalance} USDT`);
    } catch (error) {
      console.error('❌ Error checking USDT balance:', error.message);
    }
    
    // Set up event watching with WebSocket
    console.log('\n👀 Setting up Transfer event watching...');
    const subscription = usdtContractWs.events.Transfer({
      filter: { to: PROJECT_WALLET }
    })
    .on('connected', subId => {
      console.log(`✅ Event subscription established with ID: ${subId}`);
    })
    .on('data', event => {
      const { from, to, value } = event.returnValues;
      const amount = web3.utils.fromWei(value, 'mwei');
      console.log(`\n🎉 Transfer detected!`);
      console.log(`📤 From: ${from}`);
      console.log(`📥 To: ${to}`);
      console.log(`💰 Amount: ${amount} USDT`);
      console.log(`🧾 Transaction hash: ${event.transactionHash}`);
    })
    .on('error', error => {
      console.error('❌ Event error:', error);
    });
    
    console.log('\n🔔 IMPORTANT: Send exactly this amount from MetaMask to complete the test:');
    console.log(`💰 Amount: ${TEST_AMOUNT} USDT`);
    console.log(`📬 To address: ${PROJECT_WALLET}`);
    console.log('🌐 Network: Mumbai Testnet');
    console.log('\n⚠️ Make sure you have test USDT on Mumbai. Get it from a faucet if needed.');
    console.log('\n⏳ Watching for payments... (Press Ctrl+C to stop)');
    
    // Keep the process running to watch for events
    await new Promise(resolve => {
      // This promise intentionally never resolves, keeping the process alive
      // User must press Ctrl+C to exit
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n👋 Test stopped. Cleaning up...');
  if (subscription) {
    subscription.unsubscribe((error, success) => {
      if (error) console.error('❌ Error unsubscribing:', error);
      else console.log('✅ Successfully unsubscribed from events');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

runBlockchainTest();
