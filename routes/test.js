// Test route to check server health
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'CrypTopUp test route working.' });
});

module.exports = router;
