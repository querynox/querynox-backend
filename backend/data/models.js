const models = [
    { name: "Claude 3.5 Sonnet", fullName:"claude-3-5-sonnet-20240620",  category: "Text Generation", description: "Fast and efficient text generation", limit:200000 },
    { name: "llama3-70b-8192", fullName:"llama3-70b-8192", category: "Text Generation", description: "Powerful open-source model via Groq", limit:32768  },
    { name: "gpt-3.5-turbo", fullName:"gpt-3.5-turbo", category: "Text Generation", description: "Reliable and versatile text generation", limit:16385 },
    { name: "gemini-1.5-flash", fullName:"gemini-1.5-flash", category: "Text Generation", description: "Google's advanced language model", limit:1000000 },
    { name: "dall-e-3", fullName:"dall-e-3", category: "Image Generation", description: "High-quality image generation", limit:4000 }
];

module.exports = models