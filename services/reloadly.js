// Reloadly API integration
const axios = require('axios');
const { detectOperator } = require('../config/operators');

async function topUp(phone, plan) {
  try {
    const token = await getReloadlyToken();
    
    // Get operator ID (this would need to be configured based on the country)
    const operatorId = await getOperatorId(phone, token);
    
    // Convert plan to MB for the API
    let amount;
    switch(plan) {
      case '500MB':
        amount = 500;
        break;
      case '1GB':
        amount = 1024;
        break;
      case '2GB':
        amount = 2048;
        break;
      case '5GB':
        amount = 5120;
        break;
      case '10GB':
        amount = 10240;
        break;
      default:
        amount = 500;
    }
    
    // Validate amount for the operator
    await validateOperatorAmount(operatorId, amount, token);

    // Make the top-up request
    const response = await axios.post('https://topups.reloadly.com/topups', {
      operatorId: operatorId,
      amount: amount,
      recipientPhone: phone,
      senderPhone: 'CRYPTOPUP'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`[Reloadly] Top up successful for ${phone}: ${plan}`);
    return response.data;
  } catch (error) {
    console.error('[Reloadly] Top up failed:', error.message);
    throw error;
  }
}

// Get authentication token
async function getReloadlyToken() {
  try {
    const response = await axios.post('https://auth.reloadly.com/oauth/token', {
      client_id: process.env.RELOADLY_CLIENT_ID,
      client_secret: process.env.RELOADLY_CLIENT_SECRET,
      grant_type: 'client_credentials',
      audience: 'https://topups.reloadly.com'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.access_token;
  } catch (error) {
    console.error('[Reloadly] Auth failed:', error.message);
    throw error;
  }
}

// Get operator ID for a phone number
async function getOperatorId(phone, token) {
  try {
    // First try local operator detection
    const operator = detectOperator(phone);
    if (operator) {
      console.log(`[Reloadly] Detected operator: ${operator.name}`);
      return operator.id;
    }

    // Fallback to Reloadly's auto-detect if local detection fails
    console.log('[Reloadly] Local detection failed, using Reloadly auto-detect');
    const response = await axios.get(`https://topups.reloadly.com/operators/auto-detect/phone/${phone}/country-code/KE`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Cache the operator ID for future use
    console.log(`[Reloadly] Auto-detected operator ID: ${response.data.operatorId}`);
    return response.data.operatorId;
  } catch (error) {
    console.error('[Reloadly] Operator detection failed:', error.message);
    throw error;
  }
}

// Validate if the operator supports the requested amount
async function validateOperatorAmount(operatorId, amount, token) {
  try {
    const response = await axios.get(`https://topups.reloadly.com/operators/${operatorId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const operator = response.data;
    if (amount < operator.minAmount || amount > operator.maxAmount) {
      throw new Error(`Amount ${amount}MB is not supported by ${operator.name}. Supported range: ${operator.minAmount}MB - ${operator.maxAmount}MB`);
    }

    return true;
  } catch (error) {
    console.error('[Reloadly] Amount validation failed:', error.message);
    throw error;
  }
}

module.exports = { topUp };
