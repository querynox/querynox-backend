const axios = require('axios');

const webSearchService = {
    search: async (query) => {
        try {
            const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
                params: {
                    key: process.env.GOOGLE_API_KEY,
                    cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
                    q: query,
                },
            });

            const searchResults = response.data.items?.slice(0, 3).map(item => ({
                title: item.title,
                snippet: item.snippet
            }));
            
            if (!searchResults || searchResults.length === 0) return '';
            
            const context = searchResults.map(r => `Title: ${r.title}\nSnippet: ${r.snippet}`).join('\n\n');
            return `\n\n--- Relevant information from a web search ---\n${context}`;
        } catch (error) {
            console.error('Web search failed:', error.message);
            return ''; // Fail gracefully and continue without web context
        }
    }
};

module.exports = webSearchService; 