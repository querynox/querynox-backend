const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  _id: { type: String },
  chats: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chat', default:[] }],
  createdAt: { type: Number, default: Date.now },
},{_id:false});

module.exports = mongoose.model('User', userSchema); 