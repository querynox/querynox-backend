const mongoose = require('mongoose');

const ChatQuerySchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  prompt: { type: String, required: true },
  model: { type: String, required: true },
  systemPrompt: { type: String },
  webSearch: { type: Boolean, default: false },
  response: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ChatQuery', ChatQuerySchema);