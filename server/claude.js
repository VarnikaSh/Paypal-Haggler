require("dotenv").config();

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "llama3.2:3b";

async function askClaude(systemPrompt, userPrompt) {
    try {
        const response = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: MODEL,
                stream: false,
                format: "json",
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: userPrompt
                    }
                ],
                options: {
                    temperature: 0.1
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Ollama API error:", errorText);
            throw new Error(`Ollama request failed (${response.status}).`);
        }

        const data = await response.json();

        if (!data.message || !data.message.content) {
            throw new Error("Ollama returned an empty response.");
        }

        // IMPORTANT: Return the AI-generated response
        return data.message.content;

    } catch (error) {
        console.error("Local AI request failed:", error.message);
        throw error;
    }
}

module.exports = { askClaude };