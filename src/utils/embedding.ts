// Dynamic loader for Transformers.js to prevent module-level import crashes on Vercel
let extractorPromise: any = null;

async function getExtractor() {
    if (!extractorPromise) {
        extractorPromise = (async () => {
            const { pipeline, env } = await import("@huggingface/transformers");

            // Serverless environments (Vercel / AWS Lambda) only allow writes in /tmp
            if (process.env.VERCEL || process.env.NODE_ENV === "production" || process.env.AWS_LAMBDA_FUNCTION_NAME) {
                const os = await import("os");
                const path = await import("path");
                const tmpCache = path.join(os.tmpdir(), ".transformers_cache");
                env.cacheDir = tmpCache;
                env.localModelPath = tmpCache;
            }

            return await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
        })();
    }
    return await extractorPromise;
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
    } catch (error: any) {
        console.error("Error generating embeddings via Transformers.js:", error);
        throw new Error(`Embedding model error: ${error.message || String(error)}`);
    }
}

export async function generateSingleEmbedding(text: string): Promise<number[]> {
    const embeddings = await generateEmbeddings([text]);
    return embeddings[0];
}
