const express = require('express');
const router = express.Router();
const os = require('os');
const { performance } = require('perf_hooks');
const moment = require('moment');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const blockchainService = require('../services/blockchain');
const authService = require('../services/authentication');
const operators = require('../config/operators');
const csrf = require('csurf');
const rateLimit = require('express-rate-limit');

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
  if (req.session.isAdmin) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', {
    title: 'Login - CrypTopUp Admin',
    error: req.session.error,
    layout: 'admin/layout',
    isLoginPage: true
  });
  // Clear any error messages
  delete req.session.error;
});

// Login action with rate limiting and CSRF
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
    req.session.error = 'Invalid username or password';
    return res.redirect('/admin/login');
  } catch (error) {
    console.error('Login error:', error);
    req.session.error = 'An error occurred during login. Please try again.';
    return res.redirect('/admin/login');
  }
});

// Logout action
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/admin/login');
  });
});

// Dashboard page
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    // Get total users
    const totalUsers = await User.countDocuments();
    
    // Get total transactions
    const totalTransactions = await Transaction.countDocuments();
    
    // Get total revenue from completed transactions
    const completedTransactions = await Transaction.find({ status: 'COMPLETED' });
    const totalRevenue = completedTransactions.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    
    // Get pending orders
    const pendingOrders = await Transaction.countDocuments({ status: 'PENDING' });
    
    // Get recent transactions with user details
    const recentTransactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId')
      .lean();

    // Format transactions for display
    const formattedTransactions = recentTransactions.map(t => ({
      id: t._id,
      userAvatar: '/images/default-avatar.png', // You can update this with actual user avatars
      userName: t.userId ? t.userId.username : 'Unknown User',
      amount: t.amount || 0,
      type: t.type || 'Unknown',
      status: t.status.toLowerCase(),
      date: moment(t.createdAt).format('MMM DD, YYYY HH:mm')
    }));

    // Render dashboard with all required data
    res.render('admin/dashboard', {
      title: 'Dashboard - CrypTopUp Admin',
      path: 'dashboard',
      totalUsers,
      totalTransactions,
      totalRevenue,
      pendingOrders,
      recentTransactions: formattedTransactions,
      moment
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('admin/error', { error });
  }
});

// Transaction update endpoint
router.post('/transactions/:id/update', requireAuth, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Update transaction status
    transaction.status = req.body.status;
    await transaction.save();

    // Emit transaction update
    const transactionEvents = req.app.get('transactionEvents');
    if (transactionEvents) {
      transactionEvents.emit('transaction_update', transaction);
      transactionEvents.emit('system_alert', {
        type: 'success',
        message: `Transaction ${transaction._id} has been updated to ${req.body.status}`,
        timestamp: new Date()
      });
    }

    res.json({ success: true, transaction });
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
    res.status(500).render('admin/error', {
      title: 'Error - CrypTopUp Admin',
      error: error.message || 'An unexpected error occurred while loading the transaction details',
      isLoginPage: true
    });
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
    res.status(500).render('admin/error', {
      title: 'Error - CrypTopUp Admin',
      error: error.message || 'An unexpected error occurred while loading the users list',
      isLoginPage: true
    });
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

// Transaction approval
router.post('/transactions/:id/approve', requireAuth, async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);
        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Update transaction status
        transaction.status = 'COMPLETED';
        await transaction.save();

        // Emit transaction update
        const transactionEvents = req.app.get('transactionEvents');
        if (transactionEvents) {
            transactionEvents.emit('transaction_update', transaction);
            transactionEvents.emit('system_alert', {
                type: 'success',
                message: `Transaction ${transaction._id.toString().substring(0, 8)}... has been completed`,
                timestamp: new Date()
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Transaction approval error:', error);
        res.status(500).json({ error: 'Failed to approve transaction' });
    }
});

// Transaction rejection
router.post('/transactions/:id/reject', requireAuth, async (req, res) => {
    try {
        const { reason } = req.body;
        const transaction = await Transaction.findById(req.params.id);
        
        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Update transaction status
        transaction.status = 'FAILED';
        transaction.rejectionReason = reason;
        await transaction.save();

        // Emit transaction update
        const transactionEvents = req.app.get('transactionEvents');
        if (transactionEvents) {
            transactionEvents.emit('transaction_update', transaction);
            transactionEvents.emit('system_alert', {
                type: 'danger',
                message: `Transaction ${transaction._id.toString().substring(0, 8)}... has been rejected: ${reason}`,
                timestamp: new Date()
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Transaction rejection error:', error);
        res.status(500).json({ error: 'Failed to reject transaction' });
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

// Dashboard Refresh API
router.get('/api/transactions/refresh', async (req, res) => {
    try {
        // Get transaction counts
        const [pendingCount, confirmedCount, completedCount, failedCount] = await Promise.all([
            Transaction.countDocuments({ status: 'PENDING' }),
            Transaction.countDocuments({ status: 'CONFIRMED' }),
            Transaction.countDocuments({ status: 'COMPLETED' }),
            Transaction.countDocuments({ status: 'FAILED' })
        ]);

        // Get daily transaction counts for the last 7 days
        const last7Days = [];
        const dailyCounts = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            
            const nextDate = new Date(date);
            nextDate.setDate(date.getDate() + 1);
            
            const count = await Transaction.countDocuments({
                createdAt: { $gte: date, $lt: nextDate }
            });
            
            last7Days.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            dailyCounts.push(count);
        }

        res.json({
            days: last7Days,
            dailyCounts,
            statusCounts: {
                pending: pendingCount,
                confirmed: confirmedCount,
                completed: completedCount,
                failed: failedCount
            }
        });
    } catch (error) {
        console.error('Refresh error:', error);
        res.status(500).json({ error: 'Failed to refresh dashboard data' });
    }
});

// System Health Monitoring
router.get('/api/system/health', async (req, res) => {
    try {
        const startTime = performance.now();
        
        // Get basic system metrics
        const metrics = {
            apiResponse: Math.round(performance.now() - startTime),
            memoryUsage: Math.round((1 - os.freemem() / os.totalmem()) * 100),
            dbLoad: 0, // Will be calculated below
            cpuUsage: Math.round(os.loadavg()[0] * 100) / 100,
            uptime: Math.round(os.uptime() / 3600) // Hours
        };

        // Get database metrics
        const dbStats = await mongoose.connection.db.stats();
        metrics.dbLoad = Math.round((dbStats.indexSize + dbStats.dataSize) / (1024 * 1024)); // MB

        res.json(metrics);
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({ error: 'Failed to get system health metrics' });
    }
});

// Advanced Search API
// Helper function to emit transaction updates
function emitTransactionUpdate(transaction, req) {
    const transactionEvents = req.app.get('transactionEvents');
    if (transactionEvents) {
        transactionEvents.emit('transaction_update', transaction);
    }
}

router.post('/api/transactions/search', async (req, res) => {
    try {
        const { dateRange, transactionType, minAmount, maxAmount, status } = req.body;
        
        // Build query
        const query = {};
        
        // Date range
        if (dateRange) {
            const now = new Date();
            switch(dateRange) {
                case 'today':
                    query.createdAt = { $gte: new Date(now.setHours(0,0,0,0)) };
                    break;
                case 'yesterday':
                    const yesterday = new Date(now);
                    yesterday.setDate(yesterday.getDate() - 1);
                    query.createdAt = {
                        $gte: new Date(yesterday.setHours(0,0,0,0)),
                        $lt: new Date(now.setHours(0,0,0,0))
                    };
                    break;
                case 'last7':
                    query.createdAt = {
                        $gte: new Date(now.setDate(now.getDate() - 7))
                    };
                    break;
                case 'last30':
                    query.createdAt = {
                        $gte: new Date(now.setDate(now.getDate() - 30))
                    };
                    break;
            }
        }
        
        // Transaction type
        if (transactionType) {
            query.type = transactionType;
        }
        
        // Amount range
        if (minAmount || maxAmount) {
            query['amount.crypto'] = {};
            if (minAmount) query['amount.crypto'].$gte = parseFloat(minAmount);
            if (maxAmount) query['amount.crypto'].$lte = parseFloat(maxAmount);
        }
        
        // Status
        if (status) {
            query.status = status;
        }
        
        const transactions = await Transaction.find(query)
            .populate('userId', 'phoneNumber username')
            .populate('dataPlan', 'name')
            .sort({ createdAt: -1 })
            .limit(50);
        
        // Calculate analytics
        const analytics = {
            totalCount: await Transaction.countDocuments(query),
            totalAmount: await Transaction.aggregate([
                { $match: query },
                { $group: {
                    _id: null,
                    total: { $sum: '$amount.crypto' }
                }}
            ]).then(result => result[0]?.total || 0),
            statusBreakdown: await Transaction.aggregate([
                { $match: query },
                { $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }}
            ])
        };
        
        res.json({ transactions, analytics });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Failed to search transactions' });
    }
});

// Export API
router.get('/api/transactions/export', async (req, res) => {
    try {
        const { format } = req.query;
        const transactions = await Transaction.find({})
            .populate('userId', 'phoneNumber username')
            .populate('dataPlan', 'name')
            .sort({ createdAt: -1 });

        let data;
        switch (format) {
            case 'csv':
                data = generateCSV(transactions);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=transactions_${Date.now()}.csv`);
                break;
            case 'excel':
                data = generateExcel(transactions);
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=transactions_${Date.now()}.xlsx`);
                break;
            case 'pdf':
                data = await generatePDF(transactions);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=transactions_${Date.now()}.pdf`);
                break;
            default:
                return res.status(400).json({ error: 'Invalid export format' });
        }

        res.send(data);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export transactions' });
    }
});

module.exports = router;
