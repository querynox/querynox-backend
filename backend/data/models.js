const models = [
    // Original models
    { name: "Claude 3.5 Sonnet", fullName:"claude-3-5-sonnet-20240620",  category: "Text Generation", description: "Fast and efficient text generation", limit:200000, pro:true },
    { name: "llama-3.3-70b-versatile", fullName:"llama-3.3-70b-versatile", category: "Text Generation", description: "Powerful open-source model via Groq", limit:32768 , pro:false },
    { name: "gpt-3.5-turbo", fullName:"gpt-3.5-turbo", category: "Text Generation", description: "Reliable and versatile text generation", limit:16385, pro:false },
    { name: "gemini-1.5-flash", fullName:"gemini-1.5-flash", category: "Text Generation", description: "Google's advanced language model", limit:1000000, pro:false },
    { name: "dall-e-3", fullName:"dall-e-3", category: "Image Generation", description: "High-quality image generation", limit:4000, pro:false },
    
    // New OpenRouter models (model IDs are configured via environment variables)
    { name: "gpt-oss-120b", fullName:  "gpt-oss-120b", category: "Text Generation", description: "Openai Open Source 120B Model", limit:128000, pro:false },
    { name: "grok-3-mini", fullName: "grok-3-mini", category: "Text Generation", description: "X.AI Grok 3 Mini Model", limit:128000, pro:true }
];

module.exports = models