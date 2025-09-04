const pdf = require('pdf-parse');
const OpenAI = require('openai');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const openRouterService = require('./openRouterService');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Function to check if file is an image
const isImageFile = (mimetype) => {
    return mimetype && mimetype.startsWith('image/');
};

// Helper to clean up eng.traineddata if it appears
function cleanupTesseractData() {
    const filePath = path.join(__dirname, '../eng.traineddata');
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        } catch (err) {
            // Silent fail
        }
    }
}

const ragService = {
    getTextFromPDF: async (pdfBuffer) => {
        const data = await pdf(pdfBuffer);
        return data.text;
    },

    chunkText: (text, chunkSize = 1000) => {
        const paragraphs = text.split(/\n\s*\n/);
        const chunks = [];
        let currentChunk = '';
        for (const paragraph of paragraphs) {
            if (currentChunk.length + paragraph.length > chunkSize) {
                chunks.push(currentChunk);
                currentChunk = '';
            }
            currentChunk += paragraph + '\n\n';
        }
        chunks.push(currentChunk);
        return chunks;
    },
    
    getEmbeddings: async (chunks) => {
        try {
            // Use OpenAI directly for embeddings (OpenRouter doesn't support embeddings)
            const response = await openai.embeddings.create({
                model: process.env.MODEL_EMBEDDING || 'text-embedding-3-small',
                input: chunks,
            });
            return response.data.map(item => item.embedding);
        } catch (error) {
            logger.error('Embedding generation error:', error);
            throw error;
        }
    },

    findRelevantChunks: (promptEmbedding, chunkEmbeddings, chunks, topK = 3) => {
        const cosSimilarity = (vecA, vecB) => {
            let dotProduct = 0;
            let normA = 0;
            let normB = 0;
            for (let i = 0; i < vecA.length; i++) {
                dotProduct += vecA[i] * vecB[i];
                normA += vecA[i] * vecA[i];
                normB += vecB[i] * vecB[i];
            }
            return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
        };

        const similarities = chunkEmbeddings.map(chunkVec => cosSimilarity(promptEmbedding, chunkVec));
        
        return similarities
            .map((score, index) => ({ score, chunk: chunks[index] }))
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .map(item => item.chunk);
    },
    
    getTextFromImage: async (imageBuffer, mimetype = 'image/jpeg') => {
        try {
            // Convert buffer to base64 data URL for Tesseract
            const base64Image = imageBuffer.toString('base64');
            const dataUrl = `data:${mimetype};base64,${base64Image}`;
            // Use Tesseract.js to extract text from image
            const result = await Tesseract.recognize(
                dataUrl,
                'eng',
                {
                    logger: () => {}
                }
            );
            // Clean up eng.traineddata if it appears
            cleanupTesseractData();
            const extractedText = result.data.text.trim();
            if (!extractedText) {
                return 'No text was found in this image.';
            }
            return `Extracted text from image:\n${extractedText}`;
        } catch (error) {
            cleanupTesseractData();
            return 'Unable to extract text from image due to processing error.';
        }
    },

    getContextFromFiles: async (prompt, files) => {
        if (!files || files.length === 0) return '';
        let fileText = '';
        for (const file of files) {
            try {
                if (file.mimetype === 'application/pdf') {
                    fileText += await ragService.getTextFromPDF(file.buffer);
                } else if (isImageFile(file.mimetype)) {
                    const imageText = await ragService.getTextFromImage(file.buffer, file.mimetype);
                    fileText += `\n\n${imageText}`;
                }
            } catch (error) {
                fileText += `\n\nError processing file ${file.originalname}: ${error.message}`;
            }
        }
        if (!fileText.trim()) return '';
        try {
            const chunks = ragService.chunkText(fileText);
            const chunkEmbeddings = await ragService.getEmbeddings(chunks);
            
            // Get prompt embedding using OpenAI directly
            const promptEmbeddingResponse = await openai.embeddings.create({
                model: process.env.MODEL_EMBEDDING || 'text-embedding-3-small',
                input: [prompt],
            });
            const promptEmbedding = promptEmbeddingResponse.data[0].embedding;
            
            const relevantChunks = ragService.findRelevantChunks(promptEmbedding, chunkEmbeddings, chunks);
            return `\n\n--- Relevant context from uploaded documents ---\n${relevantChunks.join('\n\n---\n')}`;
        } catch (error) {
            return `\n\n--- Document content ---\n${fileText}`;
        }
    }
};

module.exports = ragService;
