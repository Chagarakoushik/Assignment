import { NextRequest, NextResponse } from "next/server";
import { qdrantClient, COLLECTION_NAME, ensureCollectionExists } from "@/utils/qdrant";

export async function POST(req: NextRequest) {
    try {
        // 1. Delete the existing collection
        await qdrantClient.deleteCollection(COLLECTION_NAME);

        // 2. Re-create the empty collection
        await ensureCollectionExists();

        return NextResponse.json({
            success: true,
            message: "Database cleared successfully."
        });

    } catch (error: any) {
        console.error("Clear DB error:", error);
        return NextResponse.json({ error: error.message || "Failed to clear database" }, { status: 500 });
    }
}
