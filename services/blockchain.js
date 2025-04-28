const Web3 = require('web3');
const Transaction = require('../models/Transaction');

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

class BlockchainService {
  constructor() {
    this.web3 = null;
    this.usdtContract = null;
    this.projectWallet = null;
    this.watchingTransactions = new Map();
    this.isWatching = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.subscription = null;
    this.initialize();
  }

  initialize() {
    try {
      console.log('Initializing blockchain service...');
      // Create a mock Web3 instance for development
      this.web3 = {
        utils: {
          toWei: (amount) => amount * 1000000, // Simple conversion for USDT's 6 decimals
          fromWei: (amount) => amount / 1000000
        },
        eth: {
          Contract: function() {
            return {
              methods: {
                balanceOf: () => ({ call: async () => '1000000000' }) // Mock 1000 USDT
              },
              events: {
                Transfer: () => ({
                  on: () => {}
                })
              }
            };
          }
        }
      };
      this.projectWallet = process.env.PROJECT_WALLET || '0x1234...'; // Mock wallet address
      console.log('✅ Blockchain service initialized (Development Mode)');
    } catch (error) {
      console.error('❌ Failed to initialize blockchain service:', error);
      throw error;
    }
  }

  async startWatching() {
    try {
      if (this.isWatching) {
        console.log('Already watching for transactions');
        return;
      }

      console.log('Starting to watch for USDT transfers...');
      this.isWatching = true;

      // Watch for Transfer events
      this.subscription = this.usdtContract.events.Transfer({
        filter: { to: this.projectWallet }
      })
      .on('data', async (event) => {
        try {
          const { from, value } = event.returnValues;
          console.log(`📥 Received transfer event from ${from} for ${this.formatUSDT(value)} USDT`);
          
          // Check all watching transactions
          for (const [key, details] of this.watchingTransactions) {
            const [walletAddress] = key.split('-');
            
            if (from.toLowerCase() === walletAddress.toLowerCase() && 
                value === details.expectedAmount) {
              // Payment matched
              console.log('✅ Payment matched! Updating transaction status...');
              await this.handleSuccessfulPayment(details.transactionId, event.transactionHash);
              this.watchingTransactions.delete(key);
            }
          }
        } catch (error) {
          console.error('❌ Error processing transfer event:', error);
        }
      })
      .on('error', async (error) => {
        console.error('❌ Error in transfer event subscription:', error);
        this.isWatching = false;
        await this.handleConnectionError();
      });

      // Start cleanup interval
      this.startCleanupInterval();

    } catch (error) {
      console.error('❌ Error starting blockchain watcher:', error);
      this.isWatching = false;
      await this.handleConnectionError();
    }
  }

  async watchForPayment(walletAddress, amount, transactionId) {
    try {
      console.log(`Watching for payment from ${walletAddress} for ${amount} USDT...`);
      const expectedAmount = this.web3.utils.toWei(amount.toString(), 'mwei'); // USDT has 6 decimals
      
      // Store transaction details
      const key = `${walletAddress}-${amount}`;
      this.watchingTransactions.set(key, { 
        transactionId,
        expectedAmount,
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

  async handleConnectionError() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(async () => {
        try {
          this.initialize();
          await this.startWatching();
          this.reconnectAttempts = 0;
        } catch (error) {
          console.error('❌ Reconnection attempt failed:', error);
        }
      }, 5000 * Math.pow(2, this.reconnectAttempts)); // Exponential backoff
    } else {
      console.error('❌ Max reconnection attempts reached. Manual intervention required.');
    }
  }

  startCleanupInterval() {
    // Clean up stale transactions every 5 minutes
    setInterval(() => {
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

  // Utility function to format USDT amount
  formatUSDT(amount) {
    return this.web3.utils.fromWei(amount, 'mwei');
  }

  // Get USDT balance of an address
  async getUSDTBalance(address) {
    try {
      const balance = await this.usdtContract.methods.balanceOf(address).call();
      return this.formatUSDT(balance);
    } catch (error) {
      console.error('❌ Error getting USDT balance:', error);
      throw error;
    }
  }

  // Cleanup resources
  async cleanup() {
    if (this.subscription) {
      this.subscription.unsubscribe((error, success) => {
        if (error) console.error('❌ Error unsubscribing:', error);
        else console.log('✅ Successfully unsubscribed from events');
      });
    }
    this.isWatching = false;
  }
}

// Create and export a singleton instance
const blockchainService = new BlockchainService();
module.exports = blockchainService;
