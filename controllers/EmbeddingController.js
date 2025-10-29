import pkg from "voyageai";
import { CacheModel, DataModel } from "../models/dataModel.js";
import { chunkText } from "../utils/chunkText.js";

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

// --- Helper function for finding existing similar documents in the DB ---
// NOTE: This function's sole purpose is to retrieve candidates for deduplication.
// It should NOT contain $match or $limit for RAG context filtering.
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

    // 3️⃣ Embed all chunks in one request
    const embeddedFormat = await voyageClient.embed({
      model: "voyage-3-large",
      input: normalizedChunks,
    });

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
    // 0️⃣ Check cache first
    const cachedAnswer = await CacheModel.findOne({ query: OurQuery.query });
    if (cachedAnswer) {
      console.log("Cache hit ✅");
      return res.status(200).json({
        success: true,
        query: OurQuery.query,
        retrieved_data: [],
        answer: cachedAnswer.answer,
        cached: true,
      });
    }

    // 1️⃣ Embed the query
    const embeddedQuestionFormat = await voyageClient.embed({
      model: "voyage-3-large",
      input: OurQuery.query,
    });

    // 2️⃣ Retrieve documents, filtering out superseded ones
    const queryResult = await DataModel.aggregate([
      {
        $vectorSearch: {
          index: "vector_indexx",
          path: "embedding",
          queryVector: embeddedQuestionFormat.data[0].embedding,
          numCandidates: 500,
          limit: 10, 
        },
      },
      // --- Filter out superseded chunks to get current information ---
      {
        $match: {
          is_superseded: false, 
        },
      },
      // --- FIX: Re-limit to 5 relevant, non-superseded documents (WAS 3) ---
      {
        $limit: 5,
      },
    ]);

    // 3️⃣ Construct context
    const context = queryResult.map((doc) => doc.text).join("\n---\n");

    // 4️⃣ Prepare prompt
    const systemPrompt = `You are the official CSEC ASTU information bot.

Follow these rules carefully:
1) If the user asks who/what you are, your name, or what you do, reply exactly:
"I'm the CSEC ASTU information bot. I answer questions about the CSEC community — including divisions, events, sessions, and general updates."

2) If the provided context contains the answer, provide it directly, accurately, and concisely.

3) If the user asks about a specific division (like Dev, CPD, CBD, Data science, Cyber, etc.) and the context includes information about that division, answer clearly based on the context.


4) For any other question where the context lacks the answer, reply exactly:
"I don’t have that specific information in my current knowledge base."

5) If it’s a greeting or casual chat, respond briefly and warmly while staying professional.`;

    const userQuery = `Based on the following context, answer the user's question:

Context:
${context}

User Question: ${OurQuery.query}`;


    // 5️⃣ Call Gemini
    const geminiApiKey = process.env.GEMINI_API_KEY || "";
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`;

    const payload = {
      contents: [{ role: "user", parts: [{ text: userQuery }] }],
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
    let finalAnswer =
      result.candidates?.[0]?.content?.parts?.[0]?.text || "Could not generate an answer.";

   // 6️⃣ Selective caching with standard answer exception (THE FIX)
    try {
      // Compute retrieval confidence using cosine similarity to the top match
      let retrievalScore = null;
      const topChunk = queryResult?.[0];
      const queryVec = embeddedQuestionFormat?.data?.[0]?.embedding;
      if (topChunk?.embedding && queryVec) {
        retrievalScore = cosineSimilarity(queryVec, topChunk.embedding);
      }

      const lower = String(finalAnswer).toLowerCase();
      
      // Identify ambiguous/fallback answers
      const isAmbiguous =
        lower.includes("i don't have that specific information in my current knowledge base") ||
        lower.includes("could not generate an answer") ||
        lower.includes("i don't know") ||
        lower.includes("unsure");

      // Identify Simple, Standard Responses (based on System Prompt rules)
      const simpleResponses = [
        "hello! how can i help you today?", 
        "hello! how may i help you today?", // Added to cover your specific final answer
        "hi! how can i assist you today?",
        "i'm the csec astu information bot. i answer questions about the csec community — including divisions, events, sessions, and general updates." 
      ];
      // Use .some(r => lower.includes(r)) for better matching robustness
      const isSimpleStandardAnswer = simpleResponses.some(r => lower.includes(r));
      
      const THRESHOLD = 0.85; 

      // Decision to Cache: Not ambiguous AND (Retrieval Score is high OR it's a simple, standard response)
      const shouldCache = !isAmbiguous && 
                          (
                            (retrievalScore !== null && retrievalScore >= THRESHOLD) || 
                            isSimpleStandardAnswer
                          );

      if (shouldCache) {
        await CacheModel.create({ query: OurQuery.query, answer: finalAnswer });
        console.log(
          `Cached (Reason: ${isSimpleStandardAnswer ? 'Standard Answer' : 'High Retrieval Score: ' + retrievalScore.toFixed(3)})`
        );
      } else {
        console.log(
          `Skip cache. ambiguous=${isAmbiguous}, retrievalScore=${retrievalScore ?? "n/a"}`
        );
      }
    } catch (e) {
      console.error("Selective cache step failed:", e);
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

