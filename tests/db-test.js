require('dotenv').config();
const mongoose = require('mongoose');
const databaseService = require('../services/database');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

async function testConnection() {
    console.log('Starting MongoDB connection test...');
    console.log('Using connection string:', process.env.MONGODB_URI);
    
    try {
        // Connect to database
        await databaseService.connectDB();
        console.log('✅ Connection successful!');
        
        // Check database status
        const status = databaseService.getStatus();
        console.log('📊 Database status:', status);
        
        // Test User model
        console.log('\nTesting User model...');
        const testUser = {
            phoneNumber: '+1234567890',
            walletAddress: '0xTestWallet',
            operator: 'TestOperator',
            country: 'TestCountry'
        };
        
        const user = await User.create(testUser);
        console.log('✅ Test user created:', user._id);
        
        // Test Transaction model
        console.log('\nTesting Transaction model...');
        const transaction = await Transaction.create({
            userId: user._id,
            type: 'DATA_PURCHASE',
            amount: {
                crypto: 1,
                data: 500
            },
            dataPlan: {
                name: 'Test Plan',
                operator: 'TestOperator',
                country: 'TestCountry'
            }
        });
        console.log('✅ Test transaction created:', transaction._id);
        
        // Test querying
        console.log('\nTesting queries...');
        const foundUser = await User.findById(user._id);
        console.log('✅ User query successful:', foundUser.phoneNumber);
        
        const foundTransaction = await Transaction.findOne({ userId: user._id });
        console.log('✅ Transaction query successful:', foundTransaction.type);
        
        // Cleanup
        console.log('\nCleaning up test data...');
        await User.deleteOne({ _id: user._id });
        await Transaction.deleteOne({ _id: transaction._id });
        console.log('✅ Test data cleaned up');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.name === 'MongoServerSelectionError') {
            console.log('\n🔍 Troubleshooting tips:');
            console.log('1. Make sure MongoDB service is running');
            console.log('2. Check if MongoDB is installed correctly');
            console.log('3. Verify the connection string in .env file');
        }
    } finally {
        // Close the connection
        try {
            await mongoose.connection.close();
            console.log('\n✅ Connection closed successfully');
        } catch (err) {
            console.error('❌ Error closing connection:', err.message);
        }
        process.exit(0);
    }
}

testConnection();
