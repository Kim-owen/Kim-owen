require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const blockchainSimulator = require('../services/blockchain-simulator');

async function testWithSimulator() {
    try {
        // Connect to MongoDB
        console.log('📊 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Create test user
        console.log('\n👤 Creating test user...');
        const testPhone = '+9876543210';
        let user = await User.findOne({ phoneNumber: testPhone });
        
        if (!user) {
            user = await User.create({
                phoneNumber: testPhone,
                walletAddress: '0xTestWallet123',
                cryptoBalance: 0,
                operator: 'TestOperator',
                country: 'TestCountry'
            });
            console.log(`✅ Created test user: ${user._id}`);
        } else {
            console.log(`✅ Found existing test user: ${user._id}`);
        }
        
        // Create test transaction
        console.log('\n💳 Creating test transaction...');
        const transaction = await Transaction.create({
            userId: user._id,
            type: 'DATA_PURCHASE',
            status: 'PENDING',
            amount: {
                crypto: 1,
                data: 500
            },
            dataPlan: {
                name: '500MB',
                operator: 'TestOperator',
                country: 'TestCountry'
            }
        });
        console.log(`✅ Created test transaction: ${transaction._id}`);
        
        // Set up payment watch with simulator
        console.log('\n👀 Setting up simulated payment watch...');
        await blockchainSimulator.watchForPayment(
            user.walletAddress,
            1, // 1 USDT
            transaction._id
        );
        
        console.log('\n⏰ Waiting for simulated payment (max 2 minutes)...');
        console.log('Transaction will be auto-approved at random intervals for testing');
        
        // Check transaction status every 5 seconds
        let attempts = 0;
        const maxAttempts = 24; // 2 minutes (24 * 5 seconds)
        
        const checkInterval = setInterval(async () => {
            attempts++;
            
            // Get updated transaction
            const updatedTx = await Transaction.findById(transaction._id);
            console.log(`Check #${attempts}: Transaction status = ${updatedTx.status}`);
            
            if (updatedTx.status === 'COMPLETED') {
                console.log('\n🎉 SUCCESS! Transaction completed!');
                console.log(`✅ Transaction hash: ${updatedTx.blockchainTxHash}`);
                console.log(`✅ Completed at: ${updatedTx.completedAt}`);
                clearInterval(checkInterval);
                await cleanup();
            } else if (attempts >= maxAttempts) {
                console.log('\n⚠️ Test timed out after 2 minutes');
                clearInterval(checkInterval);
                await cleanup();
            }
        }, 5000);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        await cleanup();
    }
}

async function cleanup() {
    try {
        console.log('\n🧹 Cleaning up...');
        await blockchainSimulator.cleanup();
        
        // Optional: Delete test transactions older than 1 hour
        const oneHourAgo = new Date(Date.now() - 3600000);
        await Transaction.deleteMany({ 
            createdAt: { $lt: oneHourAgo },
            status: { $in: ['COMPLETED', 'EXPIRED'] }
        });
        
        await mongoose.connection.close();
        console.log('✅ Cleanup complete');
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        process.exit(0);
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n👋 Test interrupted. Cleaning up...');
    await cleanup();
});

// Start the test
testWithSimulator();
