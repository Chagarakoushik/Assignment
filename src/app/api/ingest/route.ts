import { NextRequest, NextResponse } from "next/server";
import { chunkText } from "@/utils/chunking";
import { generateEmbeddings } from "@/utils/embedding";
import { qdrantClient, COLLECTION_NAME, ensureCollectionExists } from "@/utils/qdrant";
import { extractTextFromImage } from "@/utils/ocr";

// Max duration for severless function
export const maxDuration = 60; // 60 seconds

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const textData = formData.get("text") as string | null;
        const imageFile = formData.get("image") as File | null;

        let fullText = "";

        if (imageFile) {
            // It's an image, run OCR
            fullText = await extractTextFromImage(imageFile);
        } else if (textData) {
            // It's direct text
            fullText = textData;
        } else {
            return NextResponse.json({ error: "No text or image provided" }, { status: 400 });
        }

        if (!fullText.trim()) {
            return NextResponse.json({ error: "Extracted text is empty or invalid" }, { status: 400 });
        }

        console.log("Extracted text length:", fullText.length);

        // 1. Chunk Text
        const chunks = chunkText(fullText, 500, 100);
        console.log(`Split into ${chunks.length} chunks.`);

        // 2. Generate Embeddings using HF Inference API
        // Ensure Qdrant collection is ready
        await ensureCollectionExists();

        const embeddings = await generateEmbeddings(chunks);

        // 3. Store in Qdrant
        const points = chunks.map((chunk, index) => ({
            id: crypto.randomUUID(), // unique ID for Qdrant point
            vector: embeddings[index],
            payload: { text: chunk }
        }));

        if (points.length > 0) {
            await qdrantClient.upsert(COLLECTION_NAME, {
                wait: true,
                points: points
            });
        }

        return NextResponse.json({
            success: true,
            message: `Ingested successfully. Stored ${points.length} chunks.`,
            chunksCount: points.length
        });

    } catch (error: any) {
        console.error("Ingest error:", error);
        return NextResponse.json({ error: error.message || "Something went wrong" }, { status: 500 });
    }
}
