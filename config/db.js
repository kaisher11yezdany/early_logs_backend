const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    let uri = process.env.MONGO_URI;

    // Use in-memory MongoDB only in development when no real URI is set
    if (!uri || (uri.includes('localhost') && process.env.NODE_ENV !== 'production')) {
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create();
        uri = mongod.getUri();
        console.log('🧪 Using in-memory MongoDB (demo mode)');
        process.on('beforeExit', async () => { await mongod.stop(); });
      } catch (memErr) {
        console.warn('⚠️  Could not start in-memory MongoDB:', memErr.message);
      }
    }

    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
