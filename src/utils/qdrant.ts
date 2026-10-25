import { QdrantClient } from "@qdrant/js-client-rest";

const qdrantUrl = process.env.QDRANT_URL;
const qdrantApiKey = process.env.QDRANT_API_KEY;

if (!qdrantUrl || !qdrantApiKey) {
    console.warn("Qdrant variables are not set. Ensure QDRANT_URL and QDRANT_API_KEY are provided in .env.");
}

export const qdrantClient = new QdrantClient({
    url: qdrantUrl || "",
    apiKey: qdrantApiKey || "",
    checkCompatibility: false,
});

export const COLLECTION_NAME = "multimodal_rag_chatbot";
export const VECTOR_SIZE = 384; // size for sentence-transformers/all-MiniLM-L6-v2

export async function ensureCollectionExists() {
    try {
        const collections = await qdrantClient.getCollections();
        const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);

        if (exists) {
            const info = await qdrantClient.getCollection(COLLECTION_NAME);
            const currentSize = (info.config?.params?.vectors as { size?: number })?.size;
            if (currentSize && currentSize !== VECTOR_SIZE) {
                console.log(`Re-creating collection ${COLLECTION_NAME} because vector size changed from ${currentSize} to ${VECTOR_SIZE}`);
                await qdrantClient.deleteCollection(COLLECTION_NAME);
                await qdrantClient.createCollection(COLLECTION_NAME, {
                    vectors: {
                        size: VECTOR_SIZE,
                        distance: "Cosine",
                    },
                });
            }
        } else {
            await qdrantClient.createCollection(COLLECTION_NAME, {
                vectors: {
                    size: VECTOR_SIZE,
                    distance: "Cosine",
                },
            });
            console.log(`Collection ${COLLECTION_NAME} created.`);
        }
    } catch (error) {
        console.error("Error creating/checking Qdrant collection:", error);
    }
}
