require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');

const databaseService = require('./services/database');
const authService = require('./services/authentication');

// Import routes
const ussdRoute = require('./routes/ussd');
const adminRoute = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Security Middleware - Only apply in production
if (process.env.NODE_ENV === 'production') {
  // Use Helmet to set security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'", 'fonts.gstatic.com'],
        connectSrc: ["'self'", 'polygon-mumbai.infura.io']
      }
    }
  }));
  
  // Apply CORS with strict options in production
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    methods: ['GET', 'POST'],
    credentials: true
  }));
} else {
  // Less strict for development
  app.use(cors());
}

// Rate limiting for sensitive routes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per window
  message: 'Too many login attempts, please try again later'
});

// Set up session middleware for admin authentication
const sessionOptions = {
  secret: process.env.SESSION_SECRET || 'cryptopup-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // Only use secure cookies in production
    httpOnly: true, // Mitigate XSS attacks
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};

// In production, use a better session store
if (process.env.NODE_ENV === 'production' && mongoose.connection.readyState === 1) {
  const MongoStore = require('connect-mongo');
  sessionOptions.store = MongoStore.create({ 
    mongoUrl: process.env.MONGODB_URI,
    ttl: 14 * 24 * 60 * 60 // 14 days
  });
}

app.use(session(sessionOptions));

// Set up EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Set content type for USSD responses
app.use('/ussd', (req, res, next) => {
  res.header('Content-Type', 'text/plain');
  next();
});

// Start server function (using async/await properly)
async function startServer() {
  try {
    // Connect to MongoDB
    await databaseService.connectDB();
    console.log('✅ Connected to MongoDB');
    
    // Check database collections
    try {
      const collections = await databaseService.checkCollections();
      console.log(`✅ Database collections verified: ${collections.length} found`);
      
      // Initialize admin user if needed
      await authService.createInitialAdmin();
    } catch (error) {
      console.error('❌ Failed to check collections:', error);
    }
    
    // Log routes being set up
    console.log('Setting up routes...');
    
        console.log('Setting up routes in the correct order...');
    
    // Set up USSD route first
    app.use('/ussd', ussdRoute);
    
    // Set up CSRF protection
    const csrfProtection = csrf({ cookie: true });
    
    // Add special routes for debugging admin access with CSRF protection
    app.get('/admin-direct', csrfProtection, (req, res) => {
      res.render('admin/login', { error: null, csrfToken: req.csrfToken() });
    });
    
    // Create a direct route to admin dashboard for testing
    app.get('/admin-dashboard', csrfProtection, (req, res) => {
      req.session.isAdmin = true; // Auto-login for testing
      res.render('admin/dashboard', {
        pendingCount: 5,
        confirmedCount: 3,
        completedCount: 10,
        failedCount: 2,
        userCount: 8,
        recentTransactions: [],
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        dailyCounts: [2, 5, 3, 7, 4, 6, 9],
        totalRevenue: 123.45,
        moment: require('moment'),
        csrfToken: req.csrfToken()
      });
    });
    
    // Set up admin route with the correct middleware
    app.use('/admin', adminRoute);
    
    // For direct admin root access
    app.get('/admin', (req, res) => {
      res.redirect('/admin/login');
    });
    
    // Confirm routes are set up
    console.log('✅ Routes configured: /ussd and /admin');
    
    // Serve HTML file for the root route with explicit redirect to admin
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
    
    // API info route
    app.get('/api', (req, res) => {
      res.json({ 
        message: 'CrypTopUp API is running',
        adminDashboard: '/admin',
        ussdEndpoint: '/ussd'
      });
    });
    
    // Error handler middleware
    app.use((err, req, res, next) => {
      console.error('Server error:', err);
      res.status(500).json({ error: 'Server error', message: err.message });
    });

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
    
  } catch (error) {
    console.error('❌ Server startup error:', error);
    process.exit(1);
  }
}

// Run the server
startServer();
