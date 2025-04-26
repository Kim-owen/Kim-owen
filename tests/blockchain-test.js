require('dotenv').config();
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const blockchainService = require('../services/blockchain');

async function testBlockchainService() {
    console.log('Starting blockchain service test...');
    
    try {
        // Test blockchain service initialization
        console.log('\nTesting blockchain service initialization...');
        const web3 = blockchainService.web3;
        console.log('✅ Web3 connection:', web3.currentProvider.constructor.name);
        console.log('✅ Project wallet:', blockchainService.projectWallet);

        // Test USDT contract
        console.log('\nTesting USDT contract...');
        const usdtContract = blockchainService.usdtContract;
        console.log('✅ USDT contract address:', usdtContract.options.address);

        // Test payment watching setup
        console.log('\nTesting payment watching setup...');
        const testWallet = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
        const amount = 1; // 1 USDT
        const testTxId = new mongoose.Types.ObjectId();

        await blockchainService.watchForPayment(
            testWallet,
            amount,
            testTxId
        );
        console.log('✅ Payment watching started');

        // Check if transaction is being watched
        const key = `${testWallet}-${amount}`;
        const watchingTx = blockchainService.watchingTransactions.get(key);
        console.log('✅ Transaction details:', {
            isWatching: blockchainService.isWatching,
            transactionFound: !!watchingTx,
            expectedAmount: watchingTx?.expectedAmount
        });

        // Test cleanup
        console.log('\nTesting cleanup...');
        await blockchainService.cleanup();
        console.log('✅ Blockchain service cleaned up');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }

    // Exit process
    process.exit(0);
}

testBlockchainService();
