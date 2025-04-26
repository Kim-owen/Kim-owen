// Main Express app for CrypTopUp
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const ussdRoutes = require('./routes/ussd');
const testRoutes = require('./routes/test');

const app = express();
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/ussd', ussdRoutes);
app.use('/test', testRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('CrypTopUp server is running.');
});

// Listen on port 3000
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`CrypTopUp server listening on port ${PORT}`);
});

// For Ngrok/USSD callback, expose /ussd endpoint
