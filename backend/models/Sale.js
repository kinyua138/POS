const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  method: { type: String, required: true },
  subtotal: { type: Number, required: true },
  tax: { type: Number, required: true },
  total: { type: Number, required: true },
  cashierId: mongoose.Schema.Types.ObjectId,
  cashierName: String,
  items: [{
    id: mongoose.Schema.Types.ObjectId,
    name: String,
    price: Number,
    cost: Number,
    quantity: Number
  }]
});

module.exports = mongoose.model('Sale', saleSchema);

