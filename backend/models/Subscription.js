const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  // User Info
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: String,
  companyName: String,

  // Plan Info
  plan: { type: String, enum: ['Trial', 'Starter', 'Professional', 'Enterprise'], required: true },
  amount: { type: Number, required: true }, // Amount in Naira
  currency: { type: String, default: 'NGN' },

  // Payment Info
  paymentReference: String, // Paystack reference
  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed', 'expired'], default: 'pending' },
  paymentMethod: { type: String, default: 'paystack' },
  transactionId: String,

  // Subscription Period
  startDate: { type: Date, default: Date.now },
  expiryDate: Date,
  autoRenew: { type: Boolean, default: false },
  daysRemaining: Number,

  // Status
  active: { type: Boolean, default: false },
  trialUsed: Boolean,

  // POS Account
  posAccountId: mongoose.Schema.Types.ObjectId, // Reference to User model

  // Metadata
  metadata: Object,

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Index for paymentReference lookup
subscriptionSchema.index({ paymentReference: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
