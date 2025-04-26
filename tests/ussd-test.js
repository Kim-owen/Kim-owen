require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');

// Configuration
const BASE_URL = 'http://localhost:3000/ussd'; // Adjust if your server runs on a different port
const TEST_PHONE = '+254700000000'; // Test phone number

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    return false;
  }
}

// Send USSD request
async function sendUSSDRequest(text) {
  try {
    console.log(`🔄 Sending USSD request with text: "${text}"`);
    const response = await axios.post(BASE_URL, {
      sessionId: '12345',
      phoneNumber: TEST_PHONE,
      text: text
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Error sending USSD request:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return 'Error: Failed to send request';
  }
}

// Simulated USSD session with predefined inputs
async function runSimulatedUSSDSession() {
  console.log('\n🔍 AUTOMATED USSD Test');
  console.log('====================');
  console.log('This tool simulates Africa\'s Talking USSD requests');
  console.log('Phone Number:', TEST_PHONE);
  console.log('====================\n');
  
  try {
    // Test Main Menu (empty text)
    console.log('\n🧪 TEST: Main Menu');
    let response = await sendUSSDRequest('');
    printResponse(response);
    if (!response.includes('Welcome to CrypTopUp')) {
      throw new Error('Main menu not displayed correctly');
    }
    
    // Test Buy Data option
    console.log('\n🧪 TEST: Buy Data Option');
    response = await sendUSSDRequest('1');
    printResponse(response);
    if (!response.includes('Data Plans')) {
      throw new Error('Data plans not displayed correctly');
    }
    
    // Test selecting a plan (select first plan)
    console.log('\n🧪 TEST: Selecting Data Plan');
    response = await sendUSSDRequest('1*1');
    printResponse(response);
    if (!response.includes('Wallet Address') && !response.includes('Enter your wallet')) {
      throw new Error('Wallet address prompt not displayed correctly');
    }
    
    // Test entering wallet address
    console.log('\n🧪 TEST: Entering Wallet Address');
    const testWallet = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
    response = await sendUSSDRequest(`1*1*${testWallet}`);
    printResponse(response);
    if (!response.includes('Confirm your order')) {
      throw new Error('Order confirmation not displayed correctly');
    }
    
    // Test order confirmation
    console.log('\n🧪 TEST: Order Confirmation');
    response = await sendUSSDRequest('1*1*0x742d35Cc6634C0532925a3b844Bc454e4438f44e*1');
    printResponse(response);
    if (!response.includes('Payment Instructions')) {
      throw new Error('Payment instructions not displayed correctly');
    }
    
    // Test transaction status
    console.log('\n🧪 TEST: Transaction Status');
    response = await sendUSSDRequest('2');
    printResponse(response);
    
    // Test account info
    console.log('\n🧪 TEST: Account Information');
    response = await sendUSSDRequest('3');
    printResponse(response);
    
    console.log('\n✅ All USSD tests completed successfully!');
  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
  }
}

// Helper to print USSD responses
function printResponse(response) {
  const isMenu = response.startsWith('CON');
  const type = isMenu ? '🔄 MENU' : '🛑 END';
  const content = response.replace(/^(CON|END)\s/, '');
  
  console.log(`${type} Response:`); 
  console.log('--------------------');
  console.log(content);
  console.log('--------------------');
}

// Main execution
async function main() {
  const dbConnected = await connectDB();
  if (!dbConnected) {
    console.error('Cannot proceed without database connection');
    process.exit(1);
  }
  
  await runSimulatedUSSDSession();
  
  try {
    await mongoose.connection.close();
    console.log('\n🧹 Cleaned up and disconnected from MongoDB');
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error);
  }
}

// Start the test
main().catch(error => {
  console.error('❌ Error in main execution:', error);
  process.exit(1);
});
