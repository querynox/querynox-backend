const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const imageService = {
    generateImage: async (prompt) => {
        try {
            const response = await openai.images.generate({
                model: process.env.MODEL_GPT_IMAGE,
                prompt: prompt,
                n: 1,
                size: "1024x1024",
                quality: "standard",
                response_format: "url"
            });

            return {
                success: true,
                imageUrl: response.data[0].url
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