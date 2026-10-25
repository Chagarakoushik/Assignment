import { NextResponse } from "next/server";
import { qdrantClient, COLLECTION_NAME } from "@/utils/qdrant";
import Groq from "groq-sdk";

export const dynamic = "force-dynamic";

export async function GET() {
    const envCheck = {
        GROQ_API_KEY: Boolean(process.env.GROQ_API_KEY),
        QDRANT_URL: Boolean(process.env.QDRANT_URL),
        QDRANT_API_KEY: Boolean(process.env.QDRANT_API_KEY),
        OCR_API_KEY: Boolean(process.env.OCR_API_KEY),
        TAVILY_API_KEY: Boolean(process.env.TAVILY_API_KEY),
    };

    let qdrantStatus = "unknown";
    try {
        if (process.env.QDRANT_URL && process.env.QDRANT_API_KEY) {
            const collections = await qdrantClient.getCollections();
            qdrantStatus = `connected (collections: ${collections.collections.length})`;
        } else {
            qdrantStatus = "skipped (missing env vars)";
        }
    } catch (e: any) {
        qdrantStatus = `error: ${e.message}`;
    }

    let groqStatus = "unknown";
    try {
        if (process.env.GROQ_API_KEY) {
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
            await groq.models.list();
            groqStatus = "connected";
        } else {
            groqStatus = "skipped (missing env var)";
        }
    } catch (e: any) {
        groqStatus = `error: ${e.message}`;
    }

    return NextResponse.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        environment: envCheck,
        services: {
            qdrant: qdrantStatus,
            groq: groqStatus,
        }
    });
}
