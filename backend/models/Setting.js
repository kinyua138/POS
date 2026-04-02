const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'app' },
  companyName: String,
  currency: { type: String, default: '$' },
  taxRate: { type: Number, default: 0 },
  lowStockThreshold: { type: Number, default: 10 }
}, { collection: 'settings' });

module.exports = mongoose.model('Setting', settingSchema);

