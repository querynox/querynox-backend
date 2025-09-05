const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  _id: { type: String },
  chats: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chat', default:[] }],
  bookmarkedChats: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chat', default:[] }],
  createdAt: { type: Number, default: Date.now },
  productId: { type: String, ref: 'Product', default:null },
  usedChatGeneration: { type: Number, default:0},
  usedImageGeneration: { type: Number, default:0 },
  usedWebSearch: { type: Number, default:0 },
  usedFileRag: { type: Number, default:0 },
  limitsUpdatedAt: {type:Number, default:Date.now}
},{_id:false});

userSchema.index({ productId: 1 });

module.exports = mongoose.model('User', userSchema); 