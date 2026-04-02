const mongoose = require('mongoose');

const logoSchema = new mongoose.Schema({
  data: String
}, { collection: 'logo' });

module.exports = mongoose.model('Logo', logoSchema);

