const axios = require('axios');
const openRouterService = require('./openRouterService');

const webSearchService = {
    search: async (messages) => {
        try {
            // Check if required environment variables are set
            if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_SEARCH_ENGINE_ID) {
                return '';
            }

            // Use OpenRouter service for context generation
            const query = await openRouterService.generateContextForWebSearch(messages);

            const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
                params: {
                    key: process.env.GOOGLE_API_KEY,
                    cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
                    q: query,
                    num: 3, // Limit to 3 results
                },
                timeout: 10000, // 10 second timeout
            });

            const searchResults = response.data.items?.slice(0, 3).map(item => ({
                title: item.title,
                snippet: item.snippet,
                link: item.link
            }));

            if (!searchResults || searchResults.length === 0) {
                return '';
            }

            const context = searchResults.map(r => 
                `Title: ${r.title}\nSnippet: ${r.snippet}\nLink: ${r.link}`
            ).join('\n\n');

            return `\n\n--- Relevant information from web search ---\n${context}\n\n--- End of web search results ---`;
        } catch (error) {
            return ''; // Fail gracefully and continue without web context
        }
    }
};

module.exports = webSearchService;
