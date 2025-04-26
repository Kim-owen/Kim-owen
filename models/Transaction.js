// Transaction model for MongoDB
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['DATA_PURCHASE', 'CRYPTO_DEPOSIT', 'REFUND'],
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'FAILED', 'COMPLETED'],
    default: 'PENDING'
  },
  amount: {
    crypto: {
      type: Number,
      required: true
    },
    data: {
      type: Number,  // in MB
      required: true
    }
  },
  dataPlan: {
    name: String,
    operator: String,
    country: String
  },
  txHash: {
    type: String,
    sparse: true,
    unique: true
  },
  reloadlyTransactionId: {
    type: String,
    sparse: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  confirmedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  error: {
    code: String,
    message: String
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);
