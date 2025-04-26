// User model for MongoDB
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  walletAddress: {
    type: String,
    required: true,
    trim: true
  },
  cryptoBalance: {
    type: Number,
    default: 0
  },
  operator: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastTopUp: {
    type: Date
  }
});

module.exports = mongoose.model('User', userSchema);

module.exports = mongoose.model('User', userSchema);
