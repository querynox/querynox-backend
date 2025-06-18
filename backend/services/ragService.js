const pdf = require('pdf-parse');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
        const response = await openai.embeddings.create({
            model: process.env.MODEL_EMBEDDING,
            input: chunks,
        });
        return response.data.map(item => item.embedding);
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
    
    getContextFromFiles: async (prompt, files) => {
        if (!files || files.length === 0) return '';
        let fileText = '';

        for (const file of files) {
            if (file.mimetype === 'application/pdf') {
                fileText += await ragService.getTextFromPDF(file.buffer);
            }
        }

        if (!fileText.trim()) return '';

        const chunks = ragService.chunkText(fileText);
        const chunkEmbeddings = await ragService.getEmbeddings(chunks);
        const promptEmbeddingResponse = await openai.embeddings.create({
            model: process.env.MODEL_EMBEDDING,
            input: prompt,
        });
        const promptEmbedding = promptEmbeddingResponse.data[0].embedding;
        
        const relevantChunks = ragService.findRelevantChunks(promptEmbedding, chunkEmbeddings, chunks);
        
        return `\n\n--- Relevant context from uploaded documents ---\n${relevantChunks.join('\n\n---\n')}`;
    }
};

module.exports = ragService; 