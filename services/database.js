const mongoose = require('mongoose');

class DatabaseService {
  constructor() {
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxAttempts = 5;
    this.retryDelay = 5000; // 5 seconds
  }

  async connectDB() {
    if (this.isConnected) {
      console.log('Using existing MongoDB connection');
      return;
    }

    try {
      const options = {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4 // Use IPv4, skip trying IPv6
      };

      await mongoose.connect(process.env.MONGODB_URI, options);
      
      this.isConnected = true;
      this.connectionAttempts = 0;
      console.log('MongoDB connected successfully');

      mongoose.connection.on('error', this.handleConnectionError.bind(this));
      mongoose.connection.on('disconnected', this.handleDisconnection.bind(this));
    } catch (error) {
      await this.handleConnectionError(error);
    }
  }

  async handleConnectionError(error) {
    console.error('MongoDB connection error:', error);
    this.isConnected = false;

    if (this.connectionAttempts < this.maxAttempts) {
      this.connectionAttempts++;
      console.log(`Retrying connection (${this.connectionAttempts}/${this.maxAttempts}) in ${this.retryDelay/1000} seconds...`);
      
      setTimeout(async () => {
        await this.connectDB();
      }, this.retryDelay);
    } else {
      console.error('Max connection attempts reached. Exiting...');
      process.exit(1);
    }
  }

  async handleDisconnection() {
    console.log('MongoDB disconnected. Attempting to reconnect...');
    this.isConnected = false;
    await this.connectDB();
  }

  // Utility function to check collection status
  async checkCollections() {
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log('Available collections:', collections.map(c => c.name));
      return collections;
    } catch (error) {
      console.error('Error checking collections:', error);
      throw error;
    }
  }

  // Get connection status
  getStatus() {
    return {
      isConnected: this.isConnected,
      connectionAttempts: this.connectionAttempts,
      readyState: mongoose.connection.readyState
    };
  }
}

// Create singleton instance
const databaseService = new DatabaseService();

module.exports = databaseService;
