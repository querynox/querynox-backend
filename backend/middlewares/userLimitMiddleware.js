const Product = require("../models/Product.js");
const DEFAULT_LIMITS = require("../data/defaultLimit.js");
const models = require("../data/models.js");

const userLimitMiddleware = () => {
  return async (req, res, next) => {
    const user = req.user;
    const { chatId } = req.params;
    const { model, webSearch } = req.body;
    const isImageModel = models.find(m => model == m.name) || models.find(m => "gpt-3.5-turbo" == m.name).category == "Image Generation";

    const now = new Date();
    const lastUpdated = new Date(user.limitsUpdatedAt);

    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const lastMonth = lastUpdated.getMonth();
    const lastYear = lastUpdated.getFullYear();

    // If last update was not this month -> reset
    if (currentMonth !== lastMonth || currentYear !== lastYear) {
        user.usedChatGeneration = 0;
        user.usedFileRag = 0;
        user.usedImageGeneration = 0;
        user.usedWebSearch = 0;
        user.limitsUpdatedAt = Date.now();
        user.updatedAt = Date.now();
        await user.save();
    }

    if(user.productId){

        let product = await Product.findById(user.productId);
        if (!product) {
            return res.status(404).json({ error: "Subscribed product not found" });
        }

        let error = "";

        // Check each usage type against product limits
        if (user.usedChatGeneration >= product.metadata.chatGenerationLimit) {
            error += `Chat generation limit exceeded. Allowed usage is ${product.metadata.chatGenerationLimit} queries.\n`
        }

        if (req.files && user.usedFileRag >= product.metadata.fileRagLimit) {
            error += `File RAG limit exceeded. Allowed usage is ${product.metadata.fileRagLimit} queries.\n`
        }

        if (isImageModel && user.usedImageGeneration >= product.metadata.imageGenerationLimit) {
            error += `Image generation limit exceeded. Allowed usage is ${product.metadata.imageGenerationLimit} images.\n`
        }

        if ((webSearch =="true" || webSearch==true) && user.usedWebSearch >= product.metadata.webSearchLimit) {
            error += `Web search limit exceeded. Allowed usage is ${product.metadata.webSearchLimit} searches.\n`
        }

        if (req.files && req.files.length > product.metadata.fileCountLimit) {
            error += `File upload count exceeded. Allowed usage is ${product.metadata.fileCountLimit} files.\n`
        }

        if(error.trim()){
            return res.status(429).json({ error: error, chatid: chatId ?? ""});
        }

    }else{
        let error = "";

        //default limit
        if (user.usedChatGeneration >= DEFAULT_LIMITS.chatGenerationLimit) {
            error += `Chat generation limit exceeded. Allowed usage is ${DEFAULT_LIMITS.chatGenerationLimit} queries (free tier).\n`;
        }

        if (req.files && user.usedFileRag >= DEFAULT_LIMITS.fileRagLimit) {
            error += `File RAG limit exceeded. Allowed usage is ${DEFAULT_LIMITS.fileRagLimit} queries (free tier).\n`;
        }

        if (isImageModel && user.usedImageGeneration >= DEFAULT_LIMITS.imageGenerationLimit) {
            error += `Image generation limit exceeded. Allowed usage is ${DEFAULT_LIMITS.imageGenerationLimit} images (free tier).\n`;
        }

        if ((webSearch =="true" || webSearch==true) && user.usedWebSearch >= DEFAULT_LIMITS.webSearchLimit) {
            error += `Web search limit exceeded. Allowed usage is ${DEFAULT_LIMITS.webSearchLimit} searches (free tier).\n`;
        }

        if (req.files && req.files.length > DEFAULT_LIMITS.fileCountLimit) {
            error += `File upload count exceeded. Allowed usage is ${DEFAULT_LIMITS.fileCountLimit} files (free tier).\n`;
        }

        if(error.trim()){
            return res.status(429).json({ error: error, chatid: chatId ?? ""});
        }
    }

    next();
  };
};

module.exports = userLimitMiddleware;
