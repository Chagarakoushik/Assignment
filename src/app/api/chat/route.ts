import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { tavily } from "@tavily/core";
import { generateSingleEmbedding } from "@/utils/embedding";
import { qdrantClient, COLLECTION_NAME } from "@/utils/qdrant";

// Max duration for severless function
export const maxDuration = 60; // 60 seconds
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "dummy" });
        const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY || "dummy" });

        const { messages, useWebSearch } = await req.json();
        const lastMessage = messages[messages.length - 1];
        const userQuery = lastMessage.content;

        // 1. Embed user query
        const queryEmbedding = await generateSingleEmbedding(userQuery);

        // 2. Search Qdrant for context
        let contextText = "";
        try {
            const searchResult = await qdrantClient.search(COLLECTION_NAME, {
                vector: queryEmbedding,
                limit: 3, // Top 3 relevant chunks
            });

            if (searchResult && searchResult.length > 0) {
                contextText = searchResult.map(res => (res.payload as { text: string }).text).join("\n\n");
            }
        } catch (err) {
            console.warn("Could not retrieve context from Qdrant:", err);
        }

        // 2.5 Optional Web Search via Tavily
        if (useWebSearch) {
            try {
                const searchResponse = await tvly.search(userQuery, {
                    searchDepth: "basic",
                    maxResults: 3
                });

                if (searchResponse.results && searchResponse.results.length > 0) {
                    const webContext = searchResponse.results.map(r => `${r.title}\n${r.content}`).join("\n\n");
                    contextText += `\n\n--- WEB SEARCH RESULTS ---\n\n${webContext}`;
                }
            } catch (err) {
                console.warn("Could not retrieve context from Tavily:", err);
            }
        }

        // 3. Construct System Prompt
        const systemPrompt = `You are an intelligent multimodal assistant. 
Use the provided retrieved context to answer the user's question. 
If the context doesn't contain the answer, say so, but still try to be helpful based on the user's current query.
Keep answers concise and well formatted.

RETRIEVED CONTEXT:
${contextText}
`;

        // 4. Update messages with system prompt at the beginning
        const groqMessages = [
            { role: "system", content: systemPrompt },
            ...messages.map((m: any) => ({
                role: m.role,
                content: m.content
            }))
        ];

        const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

        let stream;
        try {
            stream = await groq.chat.completions.create({
                messages: groqMessages,
                model: model,
                temperature: 0.5,
                max_tokens: 1024,
                stream: true,
            });
        } catch (err: any) {
            // Groq decommissioned older models; fallback to an available model if 404/model_not_found
            if (err?.status === 404 || err?.error?.code === "model_not_found") {
                console.warn(`Model "${model}" not found or decommissioned on Groq. Falling back to "openai/gpt-oss-120b".`);
                stream = await groq.chat.completions.create({
                    messages: groqMessages,
                    model: "openai/gpt-oss-120b",
                    temperature: 0.5,
                    max_tokens: 1024,
                    stream: true,
                });
            } else {
                throw err;
            }
        }

        const encoder = new TextEncoder();
        const customStream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of stream) {
                        const content = chunk.choices[0]?.delta?.content || "";
                        if (content) {
                            controller.enqueue(encoder.encode(content));
                        }
                    }
                } catch (error) {
                    controller.error(error);
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(customStream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: any) {
        console.error("Chat API error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
