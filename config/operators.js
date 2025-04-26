// Mobile operator configurations with data plans and status
const axios = require('axios');

const operators = {
  // East Africa
  KE: {
    SAFARICOM: {
      id: 1, // Replace with actual Reloadly operator ID
      prefix: ['254701', '254702', '254703', '254704', '254705', '254706', '254707', '254708', '254709', '254710', '254711', '254712', '254713', '254714', '254715', '254716', '254717', '254718', '254719', '254720', '254721', '254722', '254723', '254724', '254725', '254726', '254727', '254728', '254729', '254790', '254791', '254792', '254793', '254794', '254795', '254796', '254797', '254798', '254799'],
      name: 'Safaricom',
      country: 'Kenya',
      plans: {
        '500MB': { amount: 500, price: 1 },
        '1GB': { amount: 1024, price: 2 },
        '2GB': { amount: 2048, price: 3.5 },
        '5GB': { amount: 5120, price: 8 }
      }
    },
    AIRTEL: {
      id: 2, // Replace with actual Reloadly operator ID
      prefix: ['254730', '254731', '254732', '254733', '254734', '254735', '254736', '254737', '254738', '254739', '254750', '254751', '254752', '254753', '254754', '254755', '254756'],
      name: 'Airtel Kenya',
      country: 'Kenya',
      plans: {
        '500MB': { amount: 500, price: 1 },
        '1GB': { amount: 1024, price: 2 },
        '2GB': { amount: 2048, price: 3.5 }
      }
    },
    TELKOM: {
      id: 3,
      prefix: ['254770', '254771', '254772', '254773', '254774', '254775', '254776', '254777', '254778', '254779'],
      name: 'Telkom Kenya',
      country: 'Kenya',
      plans: {
        '500MB': { amount: 500, price: 1 },
        '1GB': { amount: 1024, price: 2 },
        '2GB': { amount: 2048, price: 3.5 },
        '5GB': { amount: 5120, price: 8 },
        '10GB': { amount: 10240, price: 15 }
      }
    }
  },
  // Tanzania
  TZ: {
    VODACOM: {
      id: 4,
      prefix: ['255744', '255745', '255746', '255747', '255748', '255749'],
      name: 'Vodacom Tanzania',
      country: 'Tanzania',
      plans: {
        '500MB': { amount: 500, price: 1 },
        '1GB': { amount: 1024, price: 2 },
        '2GB': { amount: 2048, price: 3.5 }
      }
    },
    AIRTEL: {
      id: 5,
      prefix: ['255780', '255781', '255782', '255783', '255784', '255785'],
      name: 'Airtel Tanzania',
      country: 'Tanzania',
      plans: {
        '500MB': { amount: 500, price: 1 },
        '1GB': { amount: 1024, price: 2 }
      }
    }
  },
  // Ghana
  GH: {
    MTN: {
      id: 6,
      prefix: ['233240', '233241', '233242', '233243', '233244', '233245', '233246', '233247', '233248', '233249', '233540', '233541', '233542', '233543', '233544', '233545', '233546', '233547', '233548', '233549'],
      name: 'MTN Ghana',
      country: 'Ghana',
      plans: {
        '500MB': { amount: 500, price: 1.2 },
        '1GB': { amount: 1024, price: 2.2 },
        '3GB': { amount: 3072, price: 5.5 },
        '10GB': { amount: 10240, price: 15 }
      }
    },
    VODAFONE: {
      id: 7,
      prefix: ['233200', '233201', '233202', '233203', '233204', '233205', '233206', '233207', '233208', '233209', '233500', '233501', '233502', '233503', '233504', '233505', '233506', '233507', '233508', '233509'],
      name: 'Vodafone Ghana',
      country: 'Ghana',
      plans: {
        '500MB': { amount: 500, price: 1.1 },
        '1GB': { amount: 1024, price: 2 },
        '2GB': { amount: 2048, price: 3.8 },
        '5GB': { amount: 5120, price: 7.5 }
      }
    },
    AIRTELTIGOTOGO: {
      id: 8,
      prefix: ['233260', '233261', '233262', '233263', '233264', '233265', '233266', '233267', '233268', '233269', '233560', '233561', '233562', '233563', '233564', '233565', '233566', '233567', '233568', '233569'],
      name: 'AirtelTigo Ghana',
      country: 'Ghana',
      plans: {
        '500MB': { amount: 500, price: 1 },
        '1GB': { amount: 1024, price: 1.8 },
        '2GB': { amount: 2048, price: 3.5 },
        '5GB': { amount: 5120, price: 7 }
      }
    }
  },
  // Nigeria
  NG: {
    MTN: {
      id: 6,
      prefix: ['234803', '234806', '234813', '234816', '234814'],
      name: 'MTN Nigeria',
      plans: {
        '500MB': { amount: 500, price: 1 },
        '1GB': { amount: 1024, price: 2 },
        '2GB': { amount: 2048, price: 3.5 },
        '5GB': { amount: 5120, price: 8 }
      }
    },
    GLO: {
      id: 7,
      prefix: ['234805', '234807', '234815', '234811'],
      name: 'Globacom Nigeria',
      plans: {
        '500MB': { amount: 500, price: 1 },
        '1GB': { amount: 1024, price: 2 },
        '2GB': { amount: 2048, price: 3.5 }
      }
    }
  },
  // South Africa
  ZA: {
    VODACOM: {
      id: 8,
      prefix: ['27710', '27711', '27712', '27713', '27714'],
      name: 'Vodacom South Africa',
      plans: {
        '500MB': { amount: 500, price: 1 },
        '1GB': { amount: 1024, price: 2 },
        '2GB': { amount: 2048, price: 3.5 }
      }
    },
    MTN: {
      id: 9,
      prefix: ['27730', '27731', '27732', '27733', '27734'],
      name: 'MTN South Africa',
      plans: {
        '500MB': { amount: 500, price: 1 },
        '1GB': { amount: 1024, price: 2 },
        '2GB': { amount: 2048, price: 3.5 }
      }
    }
  }
};

// Helper function to detect operator from phone number
function detectOperator(phoneNumber) {
  // Remove leading + and any spaces
  phoneNumber = phoneNumber.replace(/[\s+]/g, '');
  
  // Add leading zero for South African numbers if needed
  if (phoneNumber.startsWith('27') && phoneNumber.length === 11) {
    phoneNumber = '27' + '0' + phoneNumber.substring(2);
  }
  
  // Check each operator's prefixes
  for (const countryCode in operators) {
    for (const operatorKey in operators[countryCode]) {
      const operator = operators[countryCode][operatorKey];
      if (operator.prefix.some(prefix => phoneNumber.startsWith(prefix))) {
        return operator;
      }
    }
  }
  
  // If no operator found, return a default test operator for development
  console.log('No operator detected for phone number, using default test operator:', phoneNumber);
  return operators.GH.MTN;
  
  // This code is now unreachable due to the default fallback above
  // throw new Error('Unsupported operator for phone number: ' + phoneNumber);
}

// Cache for operator status
const operatorStatusCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Check operator status with caching
async function checkOperatorStatus(operatorId, token) {
  const now = Date.now();
  const cachedStatus = operatorStatusCache.get(operatorId);

  if (cachedStatus && (now - cachedStatus.timestamp) < CACHE_DURATION) {
    return cachedStatus.status;
  }

  try {
    const response = await axios.get(`https://topups.reloadly.com/operators/${operatorId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const status = {
      isActive: response.data.isActive,
      supportsRanges: response.data.supportsRanges,
      minAmount: response.data.minAmount,
      maxAmount: response.data.maxAmount,
      localName: response.data.localName,
      timestamp: now
    };

    operatorStatusCache.set(operatorId, status);
    return status;
  } catch (error) {
    console.error(`Error checking operator status: ${error.message}`);
    throw error;
  }
}

// Get available plans for an operator
function getOperatorPlans(operator) {
  return operator.plans || {
    '500MB': { amount: 500, price: 1 },
    '1GB': { amount: 1024, price: 2 }
  };
}

// Format plans for USSD menu
function formatPlansMenu(operator) {
  const plans = getOperatorPlans(operator);
  return Object.entries(plans)
    .map(([name, details], index) => `${index + 1}. ${name} - ${details.price} USDT`)
    .join('\n');
}

module.exports = {
  operators,
  detectOperator,
  checkOperatorStatus,
  getOperatorPlans,
  formatPlansMenu
};
