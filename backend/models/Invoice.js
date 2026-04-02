const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  invoiceDate: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  paymentTerms: String,
  notes: String,
  status: { type: String, enum: ['PENDING', 'PAID'], default: 'PENDING' },
  subtotal: { type: Number, required: true },
  tax: { type: Number, required: true },
  total: { type: Number, required: true },
  items: [{
    description: String,
    quantity: { type: Number, min: 0 },
    price: { type: Number, min: 0 },
    total: Number
  }]
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);

