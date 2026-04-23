const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    let uri = process.env.MONGO_URI;

    // Production: require a real URI, never use in-memory
    if (process.env.NODE_ENV === 'production') {
      if (!uri) throw new Error('MONGO_URI environment variable is required in production.');
      const conn = await mongoose.connect(uri);
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      return conn;
    }

    // Development: fall back to in-memory if no URI provided
    if (!uri) {
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create();
        uri = mongod.getUri();
        console.log('🧪 Using in-memory MongoDB (demo mode)');
        process.on('beforeExit', async () => { await mongod.stop(); });
      } catch {
        throw new Error('No MONGO_URI set and in-memory MongoDB unavailable. Add MONGO_URI to your .env file.');
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
