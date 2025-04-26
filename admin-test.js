// Simple test server for admin dashboard
const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const app = express();
const PORT = 8088; // Use an uncommon port to avoid conflicts

// Set up EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Set up session middleware
app.use(session({
  secret: 'test-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Admin credentials for quick testing
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';

// Simple admin authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.redirect('/login');
};

// Login routes - standalone without requiring the admin router
app.get('/login', (req, res) => {
  res.render('admin/login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/dashboard');
  }
  
  res.render('admin/login', { error: 'Invalid credentials' });
});

// Root route - redirect to login
app.get('/', (req, res) => {
  res.redirect('/login');
});

// Dashboard route (simplified version without DB access)
app.get('/dashboard', requireAuth, (req, res) => {
  res.render('admin/dashboard', {
    pendingCount: 5,
    confirmedCount: 3,
    completedCount: 10,
    failedCount: 2,
    userCount: 8,
    recentTransactions: [
      {
        _id: '1',
        user: { phoneNumber: '+2547XXXXXXXX' },
        amount: 10,
        cryptoAmount: 8.5,
        createdAt: new Date(),
        status: 'completed',
        dataPlan: { name: '1GB Data' }
      },
      {
        _id: '2',
        user: { phoneNumber: '+2348XXXXXXXX' },
        amount: 5,
        cryptoAmount: 4.2,
        createdAt: new Date(),
        status: 'pending',
        dataPlan: { name: '500MB Data' }
      }
    ],
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    dailyCounts: [2, 5, 3, 7, 4, 6, 9],
    totalRevenue: 123.45,
    moment: require('moment')
  });
});

// Add test middleware to log requests
app.use((req, res, next) => {
  console.log(`[TEST SERVER] ${req.method} ${req.url}`);
  next();
});

// Catch-all route to handle all admin routes in case of issues
app.all('/admin*', (req, res, next) => {
  console.log(`[TEST SERVER] Admin route handler for: ${req.method} ${req.url}`);
  next();
});

// Start the server
app.listen(PORT, () => {
  console.log(`Admin test server running at http://localhost:${PORT}`);
  console.log(`Try accessing: http://localhost:${PORT}/admin`);
  console.log(`Direct login: http://localhost:${PORT}/admin-direct`);
});

// Error handler middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).render('admin/error', { error: err.message || 'Internal Server Error' });
});
app.listen(PORT, () => {
  console.log(`Test admin server running on port ${PORT}`);
});
