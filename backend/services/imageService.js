require("dotenv").config()
const OpenAI = require('openai');
const fs = require("fs")
const path = require("path");
const crypto = require("crypto")

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const imageService = {
    generateImage: async (prompt) => {
        try {
            const response = await openai.images.generate({
                model: process.env.MODEL_GPT_IMAGE,
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
                filename:file_name,
                previewUrl: `${process.env.BACKEND_HOST}/public/generated_images/${file_name}`,//TODO: Remove in Prod : Use S3 Public Preview URL
                downloadUrl:`${process.env.BACKEND_HOST}/api/v1/download/${file_name}`//Serving Images_generated (Mocking S3) //TODO: Remove in Prod : Use S3 Public Content Deposition Headder Link
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
};

module.exports = imageService; 