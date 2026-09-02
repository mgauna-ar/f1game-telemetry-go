/**
 * Reads an SSE stream from a fetch Response, properly buffering across chunk boundaries,
 * parsing `data: ` payloads, ignoring `[DONE]`, and invoking the onChunk callback with text.
 * Returns the full accumulated string.
 */
export async function readSSEStream(
  response: Response,
  onChunk?: (text: string) => void
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const decoder = new TextDecoder('utf-8');
  let accumulated = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.substring(6);
          if (dataStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(dataStr);
            const chunk =
              parsed.text ??
              parsed.content ??
              parsed.delta?.content ??
              parsed.candidates?.[0]?.content?.parts?.[0]?.text ??
              '';
            if (chunk) {
              accumulated += chunk;
              onChunk?.(chunk);
            }
          } catch {
            if (dataStr) {
              accumulated += dataStr;
              onChunk?.(dataStr);
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return accumulated;
}
