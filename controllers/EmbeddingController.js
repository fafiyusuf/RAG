import pkg from "voyageai";
import { CacheModel, DataModel } from "../models/dataModel.js";
import { chunkText } from "../utils/chunkText.js";
import { rateLimitDelay } from "../utils/rateLimiter.js";
import { checkSemanticCache, saveToSemanticCache } from "../utils/semanticCache.js";

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    throw new Error("Invalid vectors for cosine similarity");
  }

  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

  return dot / (magA * magB);
}

const { VoyageAIClient } = pkg;

// Initialize Voyage AI Client (for embedding)
const voyageClient = new VoyageAIClient({
  apiKey: process.env.VOYAGE_API_KEY,
});

// --- Helper: Embed with retry logic for rate limiting ---
async function embedWithRetry(input, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Add rate limiting delay before making request
      await rateLimitDelay();
      
      return await voyageClient.embed({
        model: "voyage-3-large",
        input: input,
      });
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
// -------------------------------------------------------

// --- Helper function for finding existing similar documents in the DB ---
// NOTE: This is only used for deduplication logic in addDocument.
async function findSimilarChunks(embeddingVector, numCandidates = 100, limit = 5) {
  try {
    return await DataModel.aggregate([
      {
        $vectorSearch: {
          index: "vector_indexx",
          path: "embedding",
          queryVector: embeddingVector,
          numCandidates: numCandidates,
          limit: limit, // Only retrieve up to 'limit' candidates
        },
      },
    ]);
  } catch (e) {
    console.error("Vector search failed during deduplication check:", e);
    return []; 
  }
}
// ------------------------------------------------------------------------


const addDocument = async (req, res) => {
  if (!req.body || !req.body.text) {
    return res.status(400).json({
      success: false,
      message: 'Bad Request: "text" field is required',
    });
  }

  const { text } = req.body;
  console.log("Received text:", text);

  try {
    // 1️⃣ Chunk the text
    const chunks = chunkText(text);

    // 2️⃣ Normalize chunks to strings
    const normalizedChunks = (Array.isArray(chunks) ? chunks : [chunks])
      .map((chunk, i) => {
        if (typeof chunk === "string") return chunk.trim();
        if (typeof Buffer !== "undefined" && (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array)) {
          try {
            const str = Buffer.from(chunk).toString("utf8").trim();
            return str.length ? str : null;
          } catch (e) {
            console.warn(`Failed to decode binary chunk at index ${i}:`, e);
            return null;
          }
        }
        if (chunk && typeof chunk === "object") {
          if (typeof chunk.text === "string") return chunk.text.trim();
          if (typeof chunk.content === "string") return chunk.content.trim();
        }
        console.warn(`Dropping non-string chunk at index ${i}:`, chunk);
        return null;
      })
      .filter((c) => c && c.length > 0);

    if (normalizedChunks.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid text chunks were produced from the input.",
      });
    }

    // 3️⃣ Embed all chunks in one request (with retry logic)
    const embeddedFormat = await embedWithRetry(normalizedChunks);

    const newDocuments = embeddedFormat.data.map((item, idx) => ({
      text: normalizedChunks[idx],
      embedding: item.embedding,
    }));

    const finalDocsToInsert = [];
    const THRESHOLD = 0.90; // High similarity threshold for replacement

    // --- Soft-Update / Deduplication Logic ---
    let chunksToSupersede = []; 
    
    // 4️⃣ Iterate over new chunks for semantic deduplication
    for (const newDoc of newDocuments) {
      // Find potential semantic matches in the DB
      const similarChunks = await findSimilarChunks(newDoc.embedding, 100, 3);

      for (const oldDoc of similarChunks) {
        const score = cosineSimilarity(newDoc.embedding, oldDoc.embedding);
        
        if (score >= THRESHOLD && !oldDoc.is_superseded) {
          console.log(`Potential superseded chunk found (ID: ${oldDoc._id}, Score: ${score.toFixed(3)})`);
          chunksToSupersede.push({ old_id: oldDoc._id, new_doc_temp: newDoc });
          break; 
        }
      }
      finalDocsToInsert.push(newDoc);
    }
    // ----------------------------------------

    // 5️⃣ Save all *new* chunks to DB
    const insertedDocs = await DataModel.insertMany(finalDocsToInsert);

    // 6️⃣ Complete the linking for superseded documents
    let supersededCount = 0;
    for (const link of chunksToSupersede) {
        // Match the inserted document by comparing the temporary object reference/data
        const newDocIndex = finalDocsToInsert.findIndex(d => d === link.new_doc_temp);
        if (newDocIndex === -1) continue; 

        const insertedDocId = insertedDocs[newDocIndex]._id;

        // Mark the old document as superseded and link it to the new version
        await DataModel.updateOne(
          { _id: link.old_id },
          { $set: { is_superseded: true, new_version_id: insertedDocId } }
        );
        supersededCount++;
    }

    // 7️⃣ Clear cache because knowledge base changed
    try {
      await CacheModel.deleteMany({});
      console.log("Cache cleared after new data upload ✅");
    } catch (e) {
      console.error("Failed to clear cache:", e);
    }

    return res.status(200).json({
      success: true,
      message: "Text chunked and embedded successfully",
      chunks_inserted: insertedDocs.length,
      superseded_old_chunks: supersededCount,
    });
  } catch (error) {
    console.error("Error embedding text:", error);
    res.status(500).send("Internal Server Error");
  }
};


const queryDocument = async (req, res) => {
  if (!req.body || !req.body.query) {
    return res.status(400).send('Bad Request: "query" field is required');
  }

  const OurQuery = req.body;
  console.log("Received query:", OurQuery);

  try {
    // 0️⃣ Check semantic cache first (with cosine similarity ≥ 0.93)
    const cacheResult = await checkSemanticCache(OurQuery.query, 0.93);
    
    if (cacheResult.hit) {
      console.log("🎯 Semantic cache hit - skipping Voyage & Gemini API calls");
      return res.status(200).json({
        success: true,
        query: OurQuery.query,
        retrieved_data: [],
        answer: cacheResult.answer,
        cached: true,
        semantic_cache: true,
      });
    }

    // 1️⃣ Embed the query (reuse embedding from cache check if available)
    let queryVector = cacheResult.queryEmbedding;
    
    if (!queryVector) {
      const embeddedQuestionFormat = await embedWithRetry(OurQuery.query);
      queryVector = embeddedQuestionFormat.data?.[0]?.embedding;
    }

    // 2️⃣ Hybrid retrieval: knnBeta (vector) + keyword (text)
    
    // a) Vector candidates (Semantic Search)
    const vectorCandidates = await DataModel.aggregate([
      {
        $search: {
          index: "hybrid_search_index", // Assuming this index supports vector search
          knnBeta: {
            vector: queryVector,
            path: "embedding",
            k: 50,
          },
        },
      },

      {
        $match: { is_superseded: false } 
      },
      {
        $project: {
          _id: 1,
          text: 1,
          embedding: 1,
          vScore: { $meta: "searchScore" },
        },
      },
      { $limit: 50 },
    ]);

    // b) Text candidates (Keyword Search)
    const textCandidates = await DataModel.aggregate([
      {
        $search: {
          index: "hybrid_search_index", // Assuming this index supports text search
          text: {
            query: OurQuery.query,
            path: "text",
          },
        },
      },
      // 🚨 FIX: Filter superseded documents
      {
        $match: { is_superseded: false } 
      },
      {
        $project: {
          _id: 1,
          text: 1,
          embedding: 1,
          tScore: { $meta: "searchScore" },
        },
      },
      { $limit: 50 },
    ]);

    // Merge candidates by _id and retain embeddings when available
    const map = new Map();
    for (const doc of vectorCandidates) {
      const id = String(doc._id);
      map.set(id, {
        id,
        text: doc.text,
        embedding: doc.embedding,
        vScore: doc.vScore || 0,
        tScore: 0,
      });
    }
    for (const doc of textCandidates) {
      const id = String(doc._id);
      if (map.has(id)) {
        const entry = map.get(id);
        entry.tScore = doc.tScore || 0;
        // keep embedding if we didn't have it before
        if (!entry.embedding && doc.embedding) entry.embedding = doc.embedding;
      } else {
        map.set(id, {
          id,
          text: doc.text,
          embedding: doc.embedding,
          vScore: 0,
          tScore: doc.tScore || 0,
        });
      }
    }

    const keywordBoost = 2.0; // Boost keyword score since the problem was keyword-based
    const combined = Array.from(map.values()).map((d) => ({
      ...d,
      // Simple RRF approximation: combine scores with a boost for text search
      score: (d.vScore || 0) + (d.tScore || 0) * keywordBoost,
    }));

    combined.sort((a, b) => b.score - a.score);

    // Keep top 5 as final retrieved context
    const queryResult = combined.slice(0, 5);

    // 3️⃣ Construct context
    const context = queryResult.map((doc) => doc.text).join("\n---\n");

    // 4️⃣ Prepare prompts
    const systemPrompt = `Hey there! You’re the official CSEC ASTU Information Bot — a cheerful and helpful guide for anyone curious about the CSEC community. 
Your goal is to make students feel welcome while sharing accurate info.if someone asked you who built you reply with  "this informational bot is built by  Fetiya Yusuf , Tsion Birhanu and Siham Kassim."

Here’s how you should respond:

1. **Who You Are** — If someone asks who or what you are, your name, or what you do, say exactly:
   "I'm the CSEC ASTU information bot. I answer questions about the CSEC community — including divisions, events, sessions, and general updates."

2. **Answer from Context** — If the provided context already includes the answer, share it directly, clearly, and in a friendly tone. Keep it short and easy to understand.

3. **Division Questions** — If the user asks about a specific division (like Dev, CPD, CBD, Data Science, or Cyber), and the context includes info about it, explain it clearly and naturally, as if you’re chatting with a friend.

4. **No Info Available** — If the context doesn’t have the answer, say exactly:
   "I don’t have that specific information in my current knowledge base."

5. **Unrelated Questions** — If the user asks about something completely unrelated to CSEC ASTU or its community, say exactly:
   "I’m only here to provide information about the CSEC ASTU community — including its divisions, events, and updates."

6. **Greetings & Small Talk** — If it’s just a greeting or a casual chat, reply warmly and keep it light — for example:
   "Hey! Nice to see you 👋 How can I help today?" or "Hi there! Hope you’re doing great — what would you like to know about CSEC ASTU?"`;

const userQuery = `Based on the following context, answer the user's question:

Context:
${context}

User Question: ${OurQuery.query}`;


    // 5️⃣ Call Gemini (Generative Language API)
    const geminiApiKey = process.env.GEMINI_API_KEY || "";
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`;

    const payload = {
      // Standard structure requires 'role: "user"'
      contents: [{ role: "user", parts: [{ text: userQuery }] }], 
      // Use snake_case for the API field
      system_instruction: { parts: [{ text: systemPrompt }] },
    };

    const response = await fetch(geminiApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Gemini API request failed: ${response.status} - ${errorBody}`);
      throw new Error(`Gemini API request failed with status ${response.status}`);
    }

    const result = await response.json();
    let finalAnswer = "Could not generate an answer from the Gemini model.";
    const candidate = result.candidates?.[0];
    if (candidate && candidate.content?.parts?.[0]?.text) {
      finalAnswer = candidate.content.parts[0].text;
    }

    // 6️⃣ Save to semantic cache with embedding and TTL (24 hours)
    try {
      // Compute retrieval confidence using cosine similarity to the top match
      let retrievalScore = null;
      const topChunk = queryResult?.[0];
      if (topChunk?.embedding && queryVector) {
        retrievalScore = cosineSimilarity(queryVector, topChunk.embedding);
      }

      const lower = String(finalAnswer).toLowerCase();
      
      // Check if the answer is ambiguous/uncertain
      const isAmbiguous =
        lower.includes("i don't have that specific information in my current knowledge base") ||
        lower.includes("could not generate an answer") ||
        lower.includes("i don't know") ||
        lower.includes("unsure");

      // Check if it's a standard greeting/info response
      const simpleResponses = [
        "hello! how can i help you today?",
        "hello! how may i help you today?",
        "hi! how can i assist you today?",
        "i'm the csec astu information bot. i answer questions about the csec community — including divisions, events, sessions, and general updates.",
      ];
      const isSimpleStandardAnswer = simpleResponses.some((r) => lower.includes(r));

      // More lenient caching strategy for semantic cache:
      // Cache if answer is NOT ambiguous (semantic matching will handle similar queries)
      const shouldCache = !isAmbiguous;

      if (shouldCache) {
        // Save with semantic cache (includes embedding and TTL)
        await saveToSemanticCache(OurQuery.query, queryVector, finalAnswer);
        const reason = isSimpleStandardAnswer 
          ? 'Standard Answer' 
          : `Retrieval Score: ${retrievalScore?.toFixed(3) ?? 'n/a'}`;
        console.log(`💾 Saved to semantic cache (${reason})`);
      } else {
        console.log(`⏭️ Skip cache - answer is ambiguous/uncertain`);
      }
    } catch (e) {
      console.error("Semantic cache save failed:", e);
    }

    console.log("Query Result:", queryResult);
    console.log("Final Answer:", finalAnswer);

    // 7️⃣ Send response
    return res.status(200).json({
      success: true,
      query: OurQuery.query,
      retrieved_data: queryResult.map((doc) => doc.text),
      answer: finalAnswer,
      cached: false,
    });
  } catch (error) {
    console.error("Error querying document or generating answer:", error);
    res.status(500).send("Internal Server Error");
  }
};

export { addDocument, queryDocument };

