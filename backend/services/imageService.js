require("dotenv").config()
const OpenAI = require('openai');
const crypto = require("crypto")
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const r2client = require('../configs/R2Client');
const logger = require("../configs/loggerConfig");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const imageService = {
    generateImage: async (prompt,userId) => {
        try {
            const response = await openai.images.generate({
                model: process.env.MODEL_GPT_IMAGE,
                prompt: prompt,
                n: 1,
                size: '1024x1024',
                quality: "standard",
                response_format: "b64_json"
            });

            const image_bytes = Buffer.from(response.data[0].b64_json, "base64");
            const id = `${Date.now()}-${crypto.randomUUID()}.png`
            const key = `generation/${userId}/${id}`;

            // upload to R2
            await r2client.send(
                new PutObjectCommand({
                    Bucket: process.env.R2_BUCKET,
                    Key: key,
                    Body: image_bytes.buffer,
                    ContentType: 'image/png',
                }) 
            );

            // Public preview URL
            const previewUrl = `${process.env.PUBLIC_BUCKET_URL}/${key}`;

            // Public download URL with content-disposition
            const downloadUrl = `${process.env.BACKEND_HOST}/api/v1/public/images/download/${encodeURIComponent(key)}`;

            return {
                success: true,
                filename: id,
                key:key,
                previewUrl: previewUrl,
                downloadUrl: downloadUrl
            };

        } catch (error) {
            logger.error(error);
            return {
                success: false,
                error: error.message
            };
        }
    }
};

module.exports = imageService; 