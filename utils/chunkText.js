
import { encoding_for_model } from "tiktoken";

// Robust chunking helper
// - Tries to use tiktoken if available
// - Falls back to word-based chunking on any tokenizer / wasm errors
// chunkSize / overlap semantics:
// - If tokenizer is available: interpreted as token counts (best-effort)
// - If fallback: interpreted as word counts
export const chunkText = (text, chunkSize = 200, overlap = 100) => {
  if (!text || typeof text !== "string") return [];

  // Defensive clamps
  chunkSize = Math.max(10, Math.floor(chunkSize));
  overlap = Math.max(0, Math.min(Math.floor(overlap), chunkSize - 1));

  // Try tokenization path (best-effort). Use try/catch to avoid wasm null-pointer crashes.
  try {
    const encoder = encoding_for_model("gpt-3.5-turbo");
    const tokens = encoder.encode(text);
    const chunks = [];

    for (let i = 0; i < tokens.length; i += chunkSize - overlap) {
      const chunkTokens = tokens.slice(i, i + chunkSize);
      let chunkText = null;
      try {
        chunkText = encoder.decode(chunkTokens);
        // decoder may return Uint8Array in some builds — convert to string if needed
        if (chunkText && typeof chunkText !== 'string') {
          try {
            // Buffer is available in Node environments
            chunkText = Buffer.from(chunkText).toString('utf8');
          } catch (convErr) {
            // if conversion fails, treat as a decode failure
            chunkText = null;
          }
        }
      } catch (e) {
        // decode may fail for some token slices; fall back
        chunkText = null;
      }

      if (chunkText) {
        chunks.push(chunkText);
      } else {
        // Something went wrong decoding this slice; bail to fallback
        break;
      }
    }

    // free encoder resources if available
    try {
      if (typeof encoder.free === "function") encoder.free();
    } catch (e) {
      // ignore free errors
    }

    if (chunks.length > 0) return chunks;
  } catch (err) {
    // Log tokenizer errors for debugging but don't crash the app
    // Keep logs concise
    // (Common failure: wasm null-pointer in some Windows environments / old node/tooling)
    // Fallthrough to safe fallback below
    // eslint-disable-next-line no-console
    console.warn("chunkText: tokenizer failed, falling back to word-chunking:", err && err.message ? err.message : err);
  }

  // Fallback: robust word-based chunking (safe, deterministic)
  const words = text.split(/\s+/).filter(Boolean);
  const fallbackChunks = [];
  if (words.length === 0) return [];

  let start = 0;
  while (start < words.length) {
    const end = Math.min(words.length, start + chunkSize);
    fallbackChunks.push(words.slice(start, end).join(" "));
    if (end === words.length) break;
    start = start + chunkSize - overlap;
  }

  return fallbackChunks;
};
