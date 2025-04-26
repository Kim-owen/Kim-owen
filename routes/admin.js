const express = require('express');
const router = express.Router();
const moment = require('moment');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const blockchainService = require('../services/blockchain');
const authService = require('../services/authentication');
const operators = require('../config/operators');
const os = require('os');
const csrf = require('csurf');
const rateLimit = require('express-rate-limit');

// CSRF protection
const csrfProtection = csrf({ cookie: true });

// Rate limiter for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per window
  message: 'Too many login attempts, please try again later'
});

// Admin authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.redirect('/admin/login');
};

// Apply CSRF protection to all admin routes
router.use(csrfProtection);

// Add CSRF token to all responses
router.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// Test route to verify admin router is working
router.get('/test', (req, res) => {
  res.send('Admin router is working!');
});

// Root admin route - redirect to login or dashboard
router.get('/', (req, res) => {
  if (req.session && req.session.isAdmin) {
    res.redirect('/admin/dashboard');
  } else {
    res.redirect('/admin/login');
  }
});

// Login page
router.get('/login', (req, res) => {
  res.render('admin/login', { error: null, csrfToken: req.csrfToken() });
});

// Login action with rate limiting
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // First, try using the new authentication service
    const isAuthenticated = await authService.authenticateAdmin(username, password);
    
    // Fall back to env variables if no admin in database yet
    if (isAuthenticated || (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD)) {
      req.session.isAdmin = true;
      req.session.adminUsername = username;
      req.session.lastLogin = new Date();
      
      console.log(`Admin login successful: ${username} at ${new Date().toISOString()}`);
      return res.redirect('/admin/dashboard');
    }
    
    console.log(`Failed login attempt for username: ${username} at ${new Date().toISOString()}`);
    res.render('admin/login', { 
      error: 'Invalid username or password', 
      csrfToken: req.csrfToken() 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.render('admin/login', { 
      error: 'An error occurred during login. Please try again.', 
      csrfToken: req.csrfToken() 
    });
  }
});

// Logout action
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// Dashboard page
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    // Get transaction counts by status
    const pendingCount = await Transaction.countDocuments({ status: 'PENDING' });
    const confirmedCount = await Transaction.countDocuments({ status: 'CONFIRMED' });
    const completedCount = await Transaction.countDocuments({ status: 'COMPLETED' });
    const failedCount = await Transaction.countDocuments({ status: 'FAILED' });
    
    // Get user count
    const userCount = await User.countDocuments();
    
    // Get recent transactions
    const recentTransactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId');
    
    // Get daily transaction counts (last 7 days)
    const days = [];
    const dailyCounts = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = moment().subtract(i, 'days');
      const startOfDay = date.startOf('day').toDate();
      const endOfDay = date.endOf('day').toDate();
      
      const count = await Transaction.countDocuments({
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      });
      
      days.push(date.format('MMM DD'));
      dailyCounts.push(count);
    }
    
    // Get total revenue (in USDT)
    const transactions = await Transaction.find({ status: 'COMPLETED' });
    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.amount.crypto, 0);
    
    // Render dashboard with data
    res.render('admin/dashboard', {
      pendingCount,
      confirmedCount,
      completedCount,
      failedCount,
      userCount,
      recentTransactions,
      days,
      dailyCounts,
      totalRevenue,
      moment
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('admin/error', { error });
  }
});

// Transactions page
router.get('/transactions', requireAuth, async (req, res) => {
  try {
    // Get page number from query params
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    
    // Get status filter
    const status = req.query.status || '';
    const filter = status ? { status } : {};
    
    // Get total count for pagination
    const total = await Transaction.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    
    // Get transactions
    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId');
    
    // Render transactions page
    res.render('admin/transactions', {
      transactions,
      page,
      totalPages,
      status,
      moment
    });
  } catch (error) {
    console.error('Transactions error:', error);
    res.status(500).render('admin/error', { error });
  }
});

// Transaction details page
router.get('/transactions/:id', requireAuth, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id).populate('userId');
    
    if (!transaction) {
      return res.status(404).render('admin/error', { error: 'Transaction not found' });
    }
    
    res.render('admin/transaction-details', {
      transaction,
      moment
    });
  } catch (error) {
    console.error('Transaction details error:', error);
    res.status(500).render('admin/error', { error });
  }
});

// Users page
router.get('/users', requireAuth, async (req, res) => {
  try {
    // Get page number from query params
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    
    // Get total count for pagination
    const total = await User.countDocuments();
    const totalPages = Math.ceil(total / limit);
    
    // Get users
    const users = await User.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get transaction counts for each user
    const userTxCounts = await Promise.all(
      users.map(async user => {
        const count = await Transaction.countDocuments({ userId: user._id });
        return { userId: user._id, count };
      })
    );
    
    // Render users page
    res.render('admin/users', {
      users,
      userTxCounts: Object.fromEntries(userTxCounts.map(item => [item.userId.toString(), item.count])),
      page,
      totalPages,
      moment
    });
  } catch (error) {
    console.error('Users error:', error);
    res.status(500).render('admin/error', { error });
  }
});

// User details page
router.get('/users/:id', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).render('admin/error', { error: 'User not found' });
    }
    
    // Get transactions for this user
    const transactions = await Transaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.render('admin/user-details', {
      user,
      transactions,
      moment
    });
  } catch (error) {
    console.error('User details error:', error);
    res.status(500).render('admin/error', { error });
  }
});

// Settings page
router.get('/settings', requireAuth, async (req, res) => {
  try {
    // Get server uptime in a human-readable format
    const uptimeInSeconds = process.uptime();
    const days = Math.floor(uptimeInSeconds / 86400);
    const hours = Math.floor((uptimeInSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
    const uptime = `${days}d ${hours}h ${minutes}m`;
    
    // Get operators grouped by country
    const operatorsByCountry = [];
    for (const countryCode in operators) {
      const countryName = countryCode === 'ZA' ? 'South Africa' : 
                         countryCode === 'GH' ? 'Ghana' : countryCode;
      
      const operatorNames = [];
      for (const opKey in operators[countryCode]) {
        operatorNames.push(operators[countryCode][opKey].name);
      }
      
      operatorsByCountry.push({
        code: countryCode,
        name: countryName,
        operators: operatorNames
      });
    }
    
    // Render settings page
    res.render('admin/settings', {
      config: {
        PROJECT_WALLET: process.env.PROJECT_WALLET,
        USDT_CONTRACT: process.env.USDT_CONTRACT,
        WEB3_PROVIDER: process.env.WEB3_PROVIDER,
        AFRICASTALKING_USERNAME: process.env.AFRICASTALKING_USERNAME
      },
      operatorsByCountry,
      uptime,
      moment
    });
  } catch (error) {
    console.error('Settings error:', error);
    res.status(500).render('admin/error', { error });
  }
});

// API routes for AJAX data
router.get('/api/transactions/stats', requireAuth, async (req, res) => {
  try {
    const last24Hours = moment().subtract(24, 'hours').toDate();
    
    // Get new transactions in last 24h
    const newTransactions = await Transaction.countDocuments({
      createdAt: { $gte: last24Hours }
    });
    
    // Get completed transactions in last 24h
    const completedTransactions = await Transaction.countDocuments({
      status: 'COMPLETED',
      completedAt: { $gte: last24Hours }
    });
    
    // Get revenue in last 24h
    const recentTransactions = await Transaction.find({
      status: 'COMPLETED',
      completedAt: { $gte: last24Hours }
    });
    const revenue = recentTransactions.reduce((sum, tx) => sum + tx.amount.crypto, 0);
    
    res.json({
      newTransactions,
      completedTransactions,
      revenue
    });
  } catch (error) {
    console.error('Stats API error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
