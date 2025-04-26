const Transaction = require('../models/Transaction');

/**
 * A simulator for blockchain functionality that doesn't require actual Web3 connections
 * This is useful for development and testing
 */
class BlockchainSimulator {
  constructor() {
    this.watchingTransactions = new Map();
    this.isWatching = false;
    console.log('✅ Blockchain simulator initialized in development mode');
  }

  async watchForPayment(walletAddress, amount, transactionId) {
    try {
      console.log(`Watching for simulated payment from ${walletAddress} for ${amount} USDT...`);
      
      const key = `${walletAddress}-${amount}`;
      this.watchingTransactions.set(key, { 
        transactionId,
        amount,
        startTime: Date.now()
      });

      // Start watching if not already watching
      if (!this.isWatching) {
        await this.startWatching();
      }

      return true;
    } catch (error) {
      console.error('❌ Error setting up payment watch:', error);
      throw error;
    }
  }

  async startWatching() {
    this.isWatching = true;
    console.log('Blockchain simulator started watching for payments');
    
    // Set up simulated payment interval (checks every 15 seconds)
    this.checkInterval = setInterval(() => this.checkForSimulatedPayments(), 15000);
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  checkForSimulatedPayments() {
    console.log('Checking for simulated payments...');
    
    // Auto-approve some transactions for testing
    // In a real app, replace this with actual blockchain monitoring
    for (const [key, details] of this.watchingTransactions) {
      // 1 in 3 chance of simulating a payment received
      if (Math.random() < 0.3) {
        const txHash = '0x' + Array.from({length: 64}, () => 
          Math.floor(Math.random() * 16).toString(16)).join('');
        
        console.log(`💰 Simulated payment detected for transaction ${details.transactionId}`);
        console.log(`📝 Simulated transaction hash: ${txHash}`);
        
        this.handleSuccessfulPayment(details.transactionId, txHash);
        this.watchingTransactions.delete(key);
      }
    }
  }

  async handleSuccessfulPayment(transactionId, txHash) {
    try {
      await Transaction.findByIdAndUpdate(transactionId, {
        $set: {
          status: 'COMPLETED',
          blockchainTxHash: txHash,
          completedAt: new Date()
        }
      });
      console.log(`✅ Transaction ${transactionId} updated with hash ${txHash}`);
    } catch (error) {
      console.error('❌ Error updating transaction:', error);
      throw error;
    }
  }

  startCleanupInterval() {
    // Clean up stale transactions every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, details] of this.watchingTransactions) {
        // Remove transactions older than 1 hour
        if (now - details.startTime > 3600000) {
          this.handleExpiredTransaction(details.transactionId);
          this.watchingTransactions.delete(key);
        }
      }
    }, 300000);
  }

  async handleExpiredTransaction(transactionId) {
    try {
      await Transaction.findByIdAndUpdate(transactionId, {
        $set: {
          status: 'EXPIRED',
          error: 'Payment timeout: Transaction expired after 1 hour'
        }
      });
      console.log(`⏰ Transaction ${transactionId} marked as expired`);
    } catch (error) {
      console.error('❌ Error updating expired transaction:', error);
      throw error;
    }
  }

  formatUSDT(amount) {
    // Simulate USDT formatting (6 decimals)
    return String(amount);
  }

  async getUSDTBalance(address) {
    // Simulate USDT balance - returns random balance between 10-100 USDT
    const balance = (10 + Math.floor(Math.random() * 90)).toFixed(2);
    console.log(`Simulated USDT balance for ${address}: ${balance} USDT`);
    return balance;
  }

  cleanup() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.isWatching = false;
    console.log('✅ Blockchain simulator cleaned up');
    return Promise.resolve();
  }
}

// Create and export a singleton instance
const blockchainSimulator = new BlockchainSimulator();
module.exports = blockchainSimulator;
