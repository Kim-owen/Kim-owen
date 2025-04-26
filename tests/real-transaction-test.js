require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const blockchainService = require('../services/blockchain');

// Amount to test with
const TEST_AMOUNT = 0.01; // Small amount for testing (0.01 USDT)
// Test phone number
const TEST_PHONE = '+1234567890';
// How long to watch for payment (in minutes)
const WATCH_MINUTES = 5;

async function runRealTransactionTest() {
    try {
        console.log('🔍 Starting real transaction test on Mumbai testnet');
        console.log(`📱 Test phone: ${TEST_PHONE}`);
        console.log(`💰 Test amount: ${TEST_AMOUNT} USDT`);
        console.log(`⏱️ Will watch for: ${WATCH_MINUTES} minutes`);
        
        // Connect to MongoDB
        console.log('\n📊 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Create or find test user
        console.log('\n👤 Creating test user...');
        let user = await User.findOne({ phoneNumber: TEST_PHONE });
        
        if (!user) {
            user = await User.create({
                phoneNumber: TEST_PHONE,
                walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', // Replace with your test wallet
                cryptoBalance: 0,
                operator: 'Test Operator',
                country: 'Test Country'
            });
            console.log(`✅ Created new test user: ${user._id}`);
        } else {
            console.log(`✅ Found existing test user: ${user._id}`);
        }
        
        // Create transaction
        console.log('\n💳 Creating test transaction...');
        const transaction = await Transaction.create({
            userId: user._id,
            type: 'DATA_PURCHASE',
            status: 'PENDING',
            amount: {
                crypto: TEST_AMOUNT,
                data: 100 // 100MB (just for testing)
            },
            dataPlan: {
                name: 'Test 100MB',
                operator: 'Test Operator',
                country: 'Test Country'
            }
        });
        console.log(`✅ Created transaction: ${transaction._id}`);
        
        // Watch for payment
        console.log('\n👀 Setting up payment watch...');
        const projectWallet = process.env.PROJECT_WALLET;
        console.log(`💼 Project wallet: ${projectWallet}`);
        
        await blockchainService.watchForPayment(
            user.walletAddress, 
            TEST_AMOUNT,
            transaction._id
        );
        
        console.log('\n🔔 IMPORTANT: Send exactly this amount from MetaMask to complete the test:');
        console.log(`💰 Amount: ${TEST_AMOUNT} USDT`);
        console.log(`📬 To address: ${projectWallet}`);
        console.log('🌐 Network: Mumbai Testnet');
        console.log('\n⚠️ Make sure you have test USDT on Mumbai. Get it from a faucet if needed.');
        
        console.log(`\n⏳ Watching for payment for ${WATCH_MINUTES} minutes...`);
        const endTime = Date.now() + (WATCH_MINUTES * 60 * 1000);
        
        const checkInterval = setInterval(async () => {
            // Check transaction status
            const updatedTx = await Transaction.findById(transaction._id);
            
            if (updatedTx.status === 'COMPLETED') {
                console.log('\n🎉 SUCCESS! Transaction completed!');
                console.log(`✅ Transaction hash: ${updatedTx.blockchainTxHash}`);
                console.log(`✅ Completed at: ${updatedTx.completedAt}`);
                clearInterval(checkInterval);
                await cleanup();
            } else if (Date.now() > endTime) {
                console.log('\n⚠️ Test timed out. No payment received within the time limit.');
                clearInterval(checkInterval);
                await cleanup();
            }
        }, 10000); // Check every 10 seconds
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        await cleanup();
    }
}

async function cleanup() {
    try {
        console.log('\n🧹 Cleaning up...');
        await blockchainService.cleanup();
        await mongoose.connection.close();
        console.log('✅ Cleanup complete');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n👋 Test interrupted. Cleaning up...');
    await cleanup();
});

// Start the test
runRealTransactionTest();
