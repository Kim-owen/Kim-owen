# CrypTopUp Deployment Guide

This document provides detailed instructions for deploying the CrypTopUp application to production.

## Deployment Options

CrypTopUp can be deployed to various platforms. Here are the recommended options:

### 1. Railway (Recommended)

Railway offers an excellent platform for Node.js applications with MongoDB integration.

1. **Setup**:
   - Create an account on [Railway](https://railway.app/)
   - Install Railway CLI: `npm i -g @railway/cli`
   - Login: `railway login`

2. **Deploy**:
   ```bash
   # Initialize Railway project
   railway init

   # Link to existing project (if applicable)
   railway link

   # Deploy
   railway up
   ```

3. **Environment Variables**:
   - Copy all variables from `.env.production` to Railway Dashboard
   - Update MongoDB URI to use your production database

4. **MongoDB**:
   - Use Railway's MongoDB plugin or connect to MongoDB Atlas

### 2. Render

Render is another excellent option with a generous free tier.

1. **Setup**:
   - Create an account on [Render](https://render.com/)
   - Link your GitHub repository

2. **Deploy**:
   - Create a new Web Service
   - Select your GitHub repo
   - Select the Node.js runtime
   - Set build command: `npm install`
   - Set start command: `npm start`

3. **Environment Variables**:
   - Copy all variables from `.env.production` to Render Dashboard
   - Update MongoDB URI to use your production database

### 3. Digital Ocean App Platform

Digital Ocean provides a robust platform with good scaling options.

1. **Setup**:
   - Create an account on [Digital Ocean](https://www.digitalocean.com/)
   - Create a new App

2. **Deploy**:
   - Link your GitHub repository
   - Configure as a Node.js app
   - Set the run command to `npm start`

3. **Environment Variables**:
   - Copy all variables from `.env.production` to Digital Ocean App settings

## Production MongoDB Setup

### Option 1: MongoDB Atlas (Recommended)

1. Create a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account
2. Create a new cluster (M0 Free tier is sufficient to start)
3. Set up a database user with a strong password
4. Configure network access to allow connections from your deployment platform
5. Get your connection string and update the `MONGODB_URI` environment variable

Example connection string:
```
mongodb+srv://[username]:[password]@[cluster].mongodb.net/cryptopup?retryWrites=true&w=majority
```

### Option 2: Platform-specific MongoDB

Both Railway and Render offer integrated MongoDB services that can be easily connected to your application.

## Security Checklist

✅ Secure authentication for admin dashboard  
✅ CSRF protection for admin routes  
✅ Rate limiting for sensitive endpoints  
✅ Helmet.js for secure HTTP headers  
✅ MongoDB connection with TLS/SSL  
✅ Strong CORS configuration  
✅ Secure session management  
✅ Environment-specific configurations  

## Post-Deployment Verification

After deployment, verify the following:

1. **Application Access**:
   - Confirm the application loads correctly
   - Test admin login at `/admin-direct`

2. **Database Connection**:
   - Check server logs for successful MongoDB connection
   - Verify the admin user was created successfully

3. **Security**:
   - Test admin login with incorrect credentials to verify rate limiting
   - Check HTTP headers for security headers

4. **Blockchain Integration**:
   - Verify connection to Polygon Mainnet
   - Test USDT contract interaction

## Troubleshooting

### Connection Issues
- Check MongoDB connection string is correct for production
- Verify Web3 provider is configured for Polygon Mainnet
- Check that environment variables are properly set

### Authentication Issues
- If admin login fails, use environment variable fallback login
- Check session configuration if sessions expire unexpectedly

### Security Alerts
- Review logs for any failed login attempts
- Monitor for any CSRF token validation failures

### Blockchain Transaction Failures
- Verify Infura API key is valid
- Check USDT contract address is correct for Polygon Mainnet
- Ensure project wallet has sufficient balance for transactions

## Regular Maintenance

- Update Node.js dependencies regularly
- Rotate API keys and secrets periodically
- Monitor database performance
- Back up the MongoDB database regularly
