const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    _id: { type: String, alias: "productId" },
    name: { type: String, required: true },
    description: { type: String },
    metadata: {
      chatGenerationLimit: { type: Number, default: 10 },
      imageGenerationLimit: { type: Number, default: 5 },
      webSearchLimit: { type: Number, default: 5 },
      fileRagLimit: { type: Number, default: 5 },
      fileCountLimit: { type: Number, default: 5 }, 
    },
    recurringInterval: { type: String, enum: ["day", "week", "month", "year"], default: null },
    isRecurring: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    organizationId: { type: String },
    createdAt: { type: Number },
    modifiedAt: { type: Number },
    prices: { type: Array, default: [] },
    benefits: { type: Array, default: [] },
    medias: { type: Array, default: [] },
    attachedCustomFields: { type: Array, default: [] },
});

module.exports = mongoose.model("Product", productSchema);
