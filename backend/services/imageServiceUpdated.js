require("dotenv").config()
const OpenAI = require('openai');
require('dotenv').config();
const fs = require("fs")
const path = require("path");
const crypto = require("crypto")
const openRouterService = require('./openRouterService');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const imageService = {
    generateImage: async (prompt) => {
        try {
            // For now, we'll use the existing OpenAI DALL-E service
            // You can extend this to use other image generation APIs through OpenRouter if available
            const response = await openai.images.generate({
                model: process.env.MODEL_GPT_IMAGE || 'dall-e-3',
                prompt: prompt,
                n: 1,
                size: '1024x1024',
                quality: "standard",
                response_format: "b64_json"
            });

            //Mocking S3
            const image_bytes = Buffer.from(response.data[0].b64_json, "base64");

            const file_name = `${crypto.randomUUID()}.png`;
            const file_path = path.join(__dirname, "..", "public", "generated_images" ,file_name);

            fs.writeFileSync(file_path, image_bytes);

            return {
                success: true,
                filename: file_name,
                previewUrl: `${process.env.BACKEND_HOST}/public/generated_images/${file_name}`,
                downloadUrl: `${process.env.BACKEND_HOST}/api/v1/download/${file_name}`
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    },

    // New method to generate image using OpenRouter (if image generation models become available)
    generateImageWithOpenRouter: async (prompt, model = 'dall-e-3') => {
        try {
            // This is a placeholder for future OpenRouter image generation
            // For now, fallback to the existing method
            return await this.generateImage(prompt);
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
};

module.exports = imageService;
