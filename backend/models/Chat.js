const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: 'New Chat' },
  chatName: { type: String, required: true }, // set only at creation, never changes
  model: { type: String, required: true },
  systemPrompt: { type: String },
  webSearch: { type: Boolean, default: false },
  createdAt: { type: Number, default: Date.now },
  updatedAt: { type: Number, default: Date.now }
});

module.exports = mongoose.model('Chat', ChatSchema); 