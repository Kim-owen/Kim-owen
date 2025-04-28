// Main Express app for CrypTopUp
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');

// Import routes
const ussdRoutes = require('./routes/ussd');
const testRoutes = require('./routes/test');
const adminRoutes = require('./routes/admin');

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Create event emitter for transactions
const EventEmitter = require('events');
const transactionEvents = new EventEmitter();

// Make transactionEvents accessible globally
app.set('transactionEvents', transactionEvents);

// Handle transaction events
transactionEvents.on('transaction_update', (transaction) => {
    io.emit('transaction_update', transaction);
});

transactionEvents.on('system_alert', (alert) => {
    io.emit('system_alert', alert);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Make io accessible to our router
app.set('io', io);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Security middleware setup
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:"],
            styleSrc: ["'self'", "'unsafe-inline'", "https:"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https:"],
            fontSrc: ["'self'", "https:", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Cookie and session setup
app.use(cookieParser(process.env.COOKIE_SECRET || 'dev-cookie-secret'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-session-secret',
    resave: false,
    saveUninitialized: false,
    name: 'sessionId',
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/cryptopup',
        ttl: 24 * 60 * 60 // 24 hours
    })
}));

// CSRF Protection
const csrfProtection = csurf({
    cookie: true
});

// Global middleware for view data
app.use((req, res, next) => {
    // Basic view data
    res.locals.user = req.session.user || null;
    res.locals.isAdmin = req.session.isAdmin || false;
    res.locals.isLoginPage = req.path === '/admin/login';
    
    // Flash messages
    res.locals.success = req.session.success;
    res.locals.error = req.session.error;
    delete req.session.success;
    delete req.session.error;
    
    next();
});

// Error handler
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        req.session.error = 'The form has expired. Please try again.';
        return res.redirect('back');
    }
    next(err);
});

// Rate limiting for login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login attempts per windowMs
    message: 'Too many login attempts from this IP. Please try again later.'
});

// Import authentication service
const authService = require('./services/authentication');

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('MongoDB connected');
    // Create initial admin user
    await authService.createInitialAdmin();
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/ussd', ussdRoutes);
app.use('/test', testRoutes);

// Admin routes with security
app.use('/admin', csrfProtection, (req, res, next) => {
    // Add CSRF token to views
    res.locals.csrfToken = req.csrfToken();
    next();
}, adminRoutes);

// Root route
app.get('/', (req, res) => {
    if (req.session.isAdmin) {
        res.redirect('/admin/dashboard');
    } else {
        res.redirect('/admin/login');
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    let errorMessage;
    let statusCode = 500;
    
    if (err.code === 'EBADCSRFTOKEN') {
        errorMessage = 'Invalid CSRF token. Please try again.';
        statusCode = 403;
    } else {
        errorMessage = process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred';
    }
    
    res.status(statusCode).render('admin/error', {
        title: 'Error - CrypTopUp Admin',
        error: errorMessage,
        isLoginPage: true
    });
});

// Listen on port
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`CrypTopUp server listening on port ${PORT}`);
});
