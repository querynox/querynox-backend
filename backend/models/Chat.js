const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true },
  title: { type: String, default: 'New Chat' },
  chatName: { type: String, required: true }, // set only at creation, never changes
  model: { type: String, required: true },
  systemPrompt: { type: String },
  webSearch: { type: Boolean, default: false },
  isShared: { type: Boolean, default: false },
  createdAt: { type: Number, default: Date.now },
  updatedAt: { type: Number, default: Date.now }
});

chatSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Chat', chatSchema); 