const mongoose = require('mongoose');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const User = require('./models/User');
const Product = require('./models/Product');
// ... (import all models)

const DB_PATH = path.join(__dirname, 'hardware_pos.db');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hardware_pos';

let mongoConnected = false;

async function connectMongo() {
  try {
    await mongoose.connect(MONGO_URI);
    mongoConnected = true;
    console.log('✅ MongoDB connected');
    
    // Run migration if needed
    await migrateData();
  } catch (err) {
    console.error('MongoDB connection failed:', err);
  }
}

async function migrateData() {
  // Check if Mongo has data
  const userCount = await User.countDocuments();
  if (userCount > 0) return console.log('Migration skipped - Mongo has data');

  console.log('🔄 Migrating SQLite → MongoDB...');

  const db = new sqlite3.Database(DB_PATH);

  // Migrate users
  const users = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM users', [], (err, rows) => err ? reject(err) : resolve(rows));
  });
  for (const u of users) {
    await User.findOneAndUpdate({username: u.username}, u, {upsert: true});
  }

  // TODO: Migrate all tables (products, sales, etc.)

  db.close();
  console.log('✅ Migration complete');
}

module.exports = { connectMongo, mongoConnected };

