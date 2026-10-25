import { pipeline, FeatureExtractionPipeline } from "@huggingface/transformers";

// Global singleton pipeline cache across requests
let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
    if (!extractorPromise) {
        extractorPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    }
    return extractorPromise;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    try {
        const extractor = await getExtractor();
        const output = await extractor(texts, { pooling: "mean", normalize: true });
        const list = output.tolist();

        // Ensure 2D number array format
        if (Array.isArray(list) && Array.isArray(list[0])) {
            return list as number[][];
        } else if (Array.isArray(list)) {
            return [list as unknown as number[]];
        }
        return [];
    } catch (error) {
        console.error("Error generating embeddings via Transformers.js:", error);
        throw error;
    }
}

export async function generateSingleEmbedding(text: string): Promise<number[]> {
    const embeddings = await generateEmbeddings([text]);
    return embeddings[0];
}
