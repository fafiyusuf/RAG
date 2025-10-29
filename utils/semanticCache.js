import pkg from "voyageai";
import { CacheModel } from "../models/dataModel.js";
import { rateLimitDelay } from "./rateLimiter.js";
const { VoyageAIClient } = pkg;

const voyageClient = new VoyageAIClient({
  apiKey: process.env.VOYAGE_API_KEY,
});

// Cosine similarity function
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    throw new Error("Invalid vectors for cosine similarity");
  }

  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

  return dot / (magA * magB);
}

/**
 * Embed text with retry logic for rate limiting
 * @param {string} input - Text to embed
 * @param {number} retries - Number of retries (default: 3)
 * @returns {Promise<Array>} - Embedding vector
 */
async function embedWithRetry(input, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Add rate limiting delay before making request
      await rateLimitDelay();
      
      const embeddedQuery = await voyageClient.embed({
        model: "voyage-3-large",
        input: input,
      });
      return embeddedQuery.data[0].embedding;
    } catch (error) {
      if (error.statusCode === 429 && attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff, max 10s
        console.log(`⚠️ Rate limit hit (attempt ${attempt}/${retries}), retrying after ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error; // Re-throw if not rate limit or final attempt
      }
    }
  }
}

/**
 * Check semantic cache for similar queries
 * @param {string} query - The user query
 * @param {number} threshold - Similarity threshold (default: 0.93)
 * @returns {Promise<{hit: boolean, answer?: string, queryEmbedding: Array}>}
 */
export async function checkSemanticCache(query, threshold = 0.93) {
  try {
    // 🚀 OPTIMIZATION: Check for exact match first (no embedding needed!)
    const exactMatch = await CacheModel.findOne({ query: query });
    if (exactMatch) {
      console.log(`⚡ Exact cache hit - no embedding needed!`);
      await CacheModel.updateOne({ _id: exactMatch._id }, { lastAccessed: new Date() });
      return { hit: true, answer: exactMatch.answer, queryEmbedding: exactMatch.embedding };
    }

    // If no exact match, embed the query for semantic matching
    const queryEmbedding = await embedWithRetry(query);

    // Retrieve all cached queries
    const cachedDocs = await CacheModel.find({});
    let bestMatch = null;
    let bestScore = 0;

    // Compare with each cached query using cosine similarity
    for (const doc of cachedDocs) {
      const score = cosineSimilarity(queryEmbedding, doc.embedding);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = doc;
      }
    }

    // If similarity is above threshold, return cached answer
    if (bestMatch && bestScore >= threshold) {
      console.log(`🧠 Semantic Cache Hit (Score: ${bestScore.toFixed(3)}) for: "${bestMatch.query}"`);
      // Update last accessed time
      await CacheModel.updateOne({ _id: bestMatch._id }, { lastAccessed: new Date() });
      return { hit: true, answer: bestMatch.answer, queryEmbedding };
    }

    console.log(`❌ Semantic cache miss (Best score: ${bestScore.toFixed(3)})`);
    return { hit: false, queryEmbedding };
  } catch (error) {
    console.error("Error checking semantic cache:", error);
    // Return miss on error to continue with normal flow
    return { hit: false, queryEmbedding: null };
  }
}

/**
 * Save query, embedding, and answer to semantic cache with TTL
 * @param {string} query - The user query
 * @param {Array} embedding - The query embedding vector
 * @param {string} answer - The generated answer
 */
export async function saveToSemanticCache(query, embedding, answer) {
  try {
    await CacheModel.create({
      query,
      embedding,
      answer,
      lastAccessed: new Date(),
    });
    console.log("✅ Saved to semantic cache with 24h TTL");
  } catch (error) {
    console.error("Failed to save to semantic cache:", error);
  }
}
