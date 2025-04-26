// Africa's Talking USSD menu handler
const express = require('express');
const router = express.Router();
const AfricasTalking = require('africastalking');

// Initialize Africa's Talking SDK
const africastalking = AfricasTalking({
  apiKey: process.env.AFRICASTALKING_API_KEY,
  username: process.env.AFRICASTALKING_USERNAME
});

// Initialize SMS service (we'll use this for notifications)
const smsService = africastalking.SMS;
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { detectOperator, formatPlansMenu, checkOperatorStatus } = require('../config/operators');
const reloadlyService = require('../services/reloadly');
const blockchainService = require('../services/blockchain');

// Helper function to send SMS notifications
async function sendSMS(phoneNumber, message) {
  try {
    await smsService.send({
      to: phoneNumber,
      message: message
    });
    console.log(`SMS sent to ${phoneNumber}`);
  } catch (error) {
    console.error('Error sending SMS:', error);
  }
}

// Helper function to format transaction status for display
function formatTransactionStatus(transaction) {
  let statusText = '';
  
  switch(transaction.status) {
    case 'PENDING':
      statusText = 'Payment Pending';
      break;
    case 'CONFIRMED':
      statusText = 'Payment Confirmed';
      break;
    case 'PROCESSING':
      statusText = 'Processing Top-up';
      break;
    case 'COMPLETED':
      statusText = 'Top-up Completed';
      break;
    case 'FAILED':
      statusText = `Failed: ${transaction.error?.message || 'Unknown error'}`;
      break;
    case 'EXPIRED':
      statusText = 'Transaction Expired';
      break;
    default:
      statusText = transaction.status;
  }
  
  // Format date as DD/MM/YYYY HH:MM
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return `${transaction.dataPlan.name} (${transaction.amount.data}MB)\n` +
         `Status: ${statusText}\n` +
         `Amount: ${transaction.amount.crypto} USDT\n` +
         `Created: ${formatDate(transaction.createdAt)}\n` +
         (transaction.completedAt ? `Completed: ${formatDate(transaction.completedAt)}` : '');
}

// USSD callback endpoint
router.post('/', async (req, res) => {
  // Africa's Talking sends POST form data
  const { sessionId, phoneNumber, text } = req.body;
  let response = '';

  try {
    // Split user input by "*" to get menu levels
    const input = text ? text.split('*') : [];
    console.log(`USSD request: phone=${phoneNumber}, text=${text}, input=${JSON.stringify(input)}`);

    if (input.length === 0 || text === '') {
      // Main menu
      response = 'CON Welcome to CrypTopUp!\n' +
                 '1. Buy Data\n' +
                 '2. Check Transaction Status\n' +
                 '3. View Account';
    } 
    // Buy Data flow
    else if (input[0] === '1') {
      // Data plan selection
      if (input.length === 1) {
        try {
          const operator = detectOperator(phoneNumber);
          
          // In development mode, skip Reloadly API call
          let skipReloadlyCheck = process.env.NODE_ENV === 'development' || !process.env.RELOADLY_API_KEY;
          
          if (!skipReloadlyCheck) {
            try {
              const token = await reloadlyService.getToken();
              const status = await checkOperatorStatus(operator.id, token);
              
              if (!status.isActive) {
                response = `END ${operator.name} is currently unavailable.\nPlease try again later.`;
                return;
              }
            } catch (reloadlyError) {
              console.warn('Reloadly API not available, continuing in development mode:', reloadlyError.message);
              skipReloadlyCheck = true;
            }
          }

          // Show available data plans
          response = `CON ${operator.name} Data Plans:\n${formatPlansMenu(operator)}`;
        } catch (error) {
          console.error('Error getting operator plans:', error);
          
          // Fallback to default operator in test/development mode
          const defaultOperator = operators.GH.MTN;
          console.log('Using fallback operator for testing:', defaultOperator.name);
          response = `CON ${defaultOperator.name} Data Plans:\n${formatPlansMenu(defaultOperator)}`;
        }
      } else if (input.length === 2) {
        // Ask for wallet address
        const user = await User.findOne({ phoneNumber });
        const walletAddress = user?.walletAddress || '';
        
        response = walletAddress
          ? `CON Wallet Address:\n${walletAddress}\n\n1. Use this address\n2. Enter new address`
          : 'CON Enter your wallet address:';
      } else if (input.length === 3) {
        // Handle wallet address input or selection
        const operator = detectOperator(phoneNumber);
        const plans = Object.entries(operator.plans);
        const selectedPlan = plans[parseInt(input[1]) - 1];
        
        if (!selectedPlan) {
          response = 'END Invalid plan selection. Please try again.';
          return;
        }
        
        // Get wallet address based on user's choice
        let walletAddress = '';
        if (input[2] === '1') {
          // User chose to use existing address
          const user = await User.findOne({ phoneNumber });
          if (!user || !user.walletAddress) {
            response = 'END Error: No wallet address found. Please try again.';
            return;
          }
          walletAddress = user.walletAddress;
        } else if (input[2] === '2') {
          // User chose to enter new address
          response = 'CON Enter your new wallet address:';
          return;
        } else {
          // User entered a wallet address directly
          walletAddress = input[2];
          
          // Basic validation for wallet address
          if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
            response = 'END Invalid wallet address format. Address should start with 0x and be 42 characters long.';
            return;
          }
        }
        
        // Ask for confirmation
        const [plan, details] = selectedPlan;
        response = `CON Confirm your order:\n` +
                   `Plan: ${plan} (${details.amount}MB)\n` +
                   `Price: ${details.price} USDT\n` +
                   `Wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}\n\n` +
                   `1. Confirm\n2. Cancel`;
      } else if (input.length === 4) {
        // Process confirmation
        if (input[3] === '1') {
          // Confirmed - process the transaction
          const operator = detectOperator(phoneNumber);
          const plans = Object.entries(operator.plans);
          const selectedPlan = plans[parseInt(input[1]) - 1];
          
          if (!selectedPlan) {
            response = 'END Invalid plan selection. Please try again.';
            return;
          }
          
          const [plan, details] = selectedPlan;
          const amount = details.price;
          
          // Get the wallet address
          let walletAddress = '';
          if (input[2] === '1') {
            // Using existing address
            const user = await User.findOne({ phoneNumber });
            walletAddress = user.walletAddress;
          } else if (input[2] === '2' && input.length >= 4) {
            // New address from input[3]
            walletAddress = input[3];
          } else {
            // Direct address input
            walletAddress = input[2];
          }
          
          // Create or update user
          let user = await User.findOne({ phoneNumber });
          if (!user) {
            user = await User.create({
              phoneNumber,
              walletAddress,
              operator: operator.name,
              country: operator.country
            });
          } else {
            user.walletAddress = walletAddress;
            await user.save();
          }

          // Create transaction
          const transaction = await Transaction.create({
            userId: user._id,
            type: 'DATA_PURCHASE',
            status: 'PENDING',
            amount: {
              crypto: amount,
              data: details.amount
            },
            dataPlan: {
              name: plan,
              operator: operator.name,
              country: operator.country
            }
          });

          // Start watching for payment
          await blockchainService.watchForPayment(walletAddress, amount, transaction._id);
          
          // Send response with payment instructions
          response = `END Payment Instructions:\n` +
                    `Send ${amount} USDT to:\n` +
                    `${process.env.PROJECT_WALLET}\n\n` +
                    `Selected: ${plan} (${details.amount}MB)\n` +
                    `Network: Polygon Mumbai\n` +
                    `Transaction ID: ${transaction._id}\n\n` +
                    `We'll notify you via SMS once payment is confirmed and data is topped up.`;
                    
          // Send confirmation SMS
          await sendSMS(phoneNumber, 
            `CrypTopUp: Your order for ${plan} (${details.amount}MB) has been created. ` +
            `Please send ${amount} USDT to ${process.env.PROJECT_WALLET.slice(0, 8)}...`
          );
        } else {
          // Cancelled
          response = 'END Transaction cancelled. Thank you for using CrypTopUp.';
        }
      }
    }
    // Check Transaction Status flow
    else if (input[0] === '2') {
      if (input.length === 1) {
        // Get recent transactions
        const user = await User.findOne({ phoneNumber });
        if (!user) {
          response = 'END No transactions found. You need to make a purchase first.';
          return;
        }
        
        const transactions = await Transaction.find({ userId: user._id })
          .sort({ createdAt: -1 })
          .limit(5);
          
        if (transactions.length === 0) {
          response = 'END No transactions found for your account.';
        } else if (transactions.length === 1) {
          // If only one transaction, show its details directly
          const tx = transactions[0];
          response = `END Transaction Details:\n${formatTransactionStatus(tx)}`;
        } else {
          // List transactions for selection
          let menu = 'CON Select transaction to view:\n';
          transactions.forEach((tx, index) => {
            const date = new Date(tx.createdAt).toLocaleDateString('en-GB');
            menu += `${index + 1}. ${tx.dataPlan.name} - ${tx.status} (${date})\n`;
          });
          response = menu;
        }
      } else if (input.length === 2) {
        // Show specific transaction details
        const user = await User.findOne({ phoneNumber });
        if (!user) {
          response = 'END No account found for this phone number.';
          return;
        }
        
        const transactions = await Transaction.find({ userId: user._id })
          .sort({ createdAt: -1 })
          .limit(5);
          
        const selection = parseInt(input[1]) - 1;
        if (selection < 0 || selection >= transactions.length) {
          response = 'END Invalid selection. Please try again.';
          return;
        }
        
        const tx = transactions[selection];
        response = `END Transaction Details:\n${formatTransactionStatus(tx)}`;
      }
    }
    // View Account flow
    else if (input[0] === '3') {
      if (input.length === 1) {
        // Get user account info
        const user = await User.findOne({ phoneNumber });
        if (!user) {
          response = 'END No account found. Please make a purchase first to create an account.';
          return;
        }
        
        // Get transaction count and last transaction
        const transactionCount = await Transaction.countDocuments({ userId: user._id });
        const lastTransaction = await Transaction.findOne({ userId: user._id })
          .sort({ createdAt: -1 });
          
        const lastTxDate = lastTransaction ? new Date(lastTransaction.createdAt).toLocaleDateString('en-GB') : 'N/A';
        
        response = 'CON Account Information:\n' +
                   `Phone: ${user.phoneNumber}\n` +
                   `Wallet: ${user.walletAddress ? user.walletAddress.slice(0, 6) + '...' + user.walletAddress.slice(-4) : 'Not set'}\n` +
                   `Operator: ${user.operator}\n` +
                   `Transactions: ${transactionCount}\n` +
                   `Last Transaction: ${lastTxDate}\n\n` +
                   '1. Update Wallet Address\n' +
                   '2. Back to Main Menu';
      } else if (input.length === 2) {
        if (input[1] === '1') {
          // Update wallet address
          response = 'CON Enter your new wallet address:';
        } else {
          // Back to main menu
          response = 'END Returning to main menu. Please dial the service again.';
        }
      } else if (input.length === 3 && input[1] === '1') {
        // Process wallet address update
        const walletAddress = input[2];
        
        // Basic validation
        if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
          response = 'END Invalid wallet address format. Address should start with 0x and be 42 characters long.';
          return;
        }
        
        // Update user's wallet address
        let user = await User.findOne({ phoneNumber });
        if (!user) {
          user = await User.create({
            phoneNumber,
            walletAddress,
            operator: detectOperator(phoneNumber).name,
            country: detectOperator(phoneNumber).country
          });
        } else {
          user.walletAddress = walletAddress;
          await user.save();
        }
        
        response = `END Wallet address updated successfully to:\n${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
      }
    }
    // Fallback for invalid options
    else {
      response = 'END Invalid option. Please try again.';
    }
  } catch (error) {
    console.error('USSD Error:', error);
    response = 'END An error occurred while processing your request. Please try again.';
  }

  // Send response in the format expected by Africa's Talking
  res.send(response);
});

module.exports = router;
