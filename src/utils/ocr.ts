// OCR.Space requires formData
export async function extractTextFromImage(imageFile: File): Promise<string> {
    if (!process.env.OCR_API_KEY) {
        throw new Error("OCR_API_KEY is not defined");
    }

    const formData = new FormData();
    formData.append("apikey", process.env.OCR_API_KEY);
    formData.append("language", "eng");
    formData.append("file", imageFile);

    try {
        const response = await fetch("https://api.ocr.space/parse/image", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`OCR API failed with status ${response.status}`);
        }

        const data = await response.json();

        if (data.IsErroredOnProcessing) {
            throw new Error(`OCR Processing Error: ${data.ErrorMessage?.join(', ')}`);
        }

        if (data.ParsedResults && data.ParsedResults.length > 0) {
            // Concatenate text from all pages
            const extractedText = data.ParsedResults.map((result: any) => result.ParsedText).join('\n');
            return extractedText;
        }

        return "";
    } catch (error) {
        console.error("Error connecting to OCR.Space:", error);
        throw error;
    }
}
