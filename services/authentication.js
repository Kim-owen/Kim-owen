const crypto = require('crypto');
const mongoose = require('mongoose');

// Create an Admin model
const AdminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  passwordSalt: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Admin = mongoose.model('Admin', AdminSchema);

// Hash password function
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

// Create initial admin user
async function createInitialAdmin() {
  try {
    const adminExists = await Admin.findOne({ username: process.env.ADMIN_USERNAME });
    if (!adminExists) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = hashPassword(process.env.ADMIN_PASSWORD, salt);
      
      await new Admin({
        username: process.env.ADMIN_USERNAME,
        passwordHash: hash,
        passwordSalt: salt
      }).save();
      
      console.log('✅ Initial admin user created');
    } else {
      console.log('ℹ️ Admin user already exists');
    }
  } catch (error) {
    console.error('❌ Error creating initial admin:', error);
  }
}

// Authenticate function
async function authenticateAdmin(username, password) {
  try {
    const admin = await Admin.findOne({ username });
    if (!admin) return false;
    
    const hash = hashPassword(password, admin.passwordSalt);
    return hash === admin.passwordHash;
  } catch (error) {
    console.error('❌ Authentication error:', error);
    return false;
  }
}

module.exports = { 
  Admin,
  createInitialAdmin,
  authenticateAdmin,
  hashPassword
};
