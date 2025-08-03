const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  chats: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chat', default:[] }],
  createdAt: { type: Number, default: Date.now }
});

module.exports = mongoose.model('User', userSchema); 