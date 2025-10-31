// utils/chunkText.js
import { encoding_for_model } from "tiktoken";

const tokenizer = encoding_for_model("gpt-3.5-turbo");

export const chunkText = (text, chunkSize = 200, overlap = 100) => {
  const tokens = tokenizer.encode(text);
  const chunks = [];

  for (let i = 0; i < tokens.length; i += chunkSize - overlap) {
    const chunkTokens = tokens.slice(i, i + chunkSize);
    const chunkText = tokenizer.decode(chunkTokens);
    chunks.push(chunkText);
  }
  tokenizer.free();
  return chunks;
};
