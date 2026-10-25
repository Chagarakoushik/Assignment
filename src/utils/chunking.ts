export function chunkText(text: string, chunkSize: number = 1000, chunkOverlap: number = 200): string[] {
  if (!text || text.trim().length === 0) return [];

  const chunks: string[] = [];
  let index = 0;
  
  while (index < text.length) {
    const chunk = text.slice(index, index + chunkSize);
    chunks.push(chunk);
    index += chunkSize - chunkOverlap;
  }
  
  return chunks;
}
