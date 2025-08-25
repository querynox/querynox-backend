const mongoose = require('mongoose');

const chatQuerySchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  prompt: { type: String, required: true },
  model: { type: String, required: true },
  systemPrompt: { type: String },
  webSearch: { type: Boolean, default: false },
  response: { type: String, required: true },
  createdAt: { type: Number, default: Date.now },
  updatedAt: { type: Number, default: Date.now }
});

chatQuerySchema.index({ chatId: 1, createdAt: -1 }); 

module.exports = mongoose.model('ChatQuery', chatQuerySchema);