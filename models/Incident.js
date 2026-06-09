const mongoose = require('mongoose');

const IncidentSchema = new mongoose.Schema({
  rawLogs: {
    type: String,
    required: true
  },
  diagnosis: {
    type: String,
    default: ''
  },
  proposedFix: {
    type: String,
    default: ''
  },
  blockchainTxHash: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Incident', IncidentSchema);
