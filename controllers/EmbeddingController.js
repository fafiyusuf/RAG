import pkg from "voyageai";
import { CacheModel, DataModel } from "../models/dataModel.js";
import { chunkText } from "../utils/chunkText.js";

// Removed: import OpenAI from "openai";
// Note: We use the global 'fetch' API available in Node.js environments

const { VoyageAIClient } = pkg;

// Initialize Voyage AI Client (for embedding)
const voyageClient = new VoyageAIClient({
  apiKey: process.env.VOYAGE_API_KEY,
});

// The addDocument function remains unchanged
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

     // 2️⃣ Normalize chunks to strings (chunkText might return objects)
    const normalizedChunks = (Array.isArray(chunks) ? chunks : [chunks])
      .map((chunk, i) => {
        // string already
        if (typeof chunk === "string") return chunk.trim();

        // Buffer / Uint8Array -> decode to UTF-8 string
        if (typeof Buffer !== "undefined" && (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array)) {
          try {
            const str = Buffer.from(chunk).toString("utf8").trim();
            return str.length ? str : null;
          } catch (e) {
            console.warn(`Failed to decode binary chunk at index ${i}:`, e);
            return null;
          }
        }

        // object with common text fields
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

    const embeddings = embeddedFormat.data.map((item, idx) => ({
      text: normalizedChunks[idx],
      embedding: item.embedding,
    }));

    // 4️⃣ Save all chunks to DB
    await DataModel.insertMany(embeddings);

    return res.status(200).json({
      success: true,
      message: "Text chunked and embedded successfully",
      chunks: embeddings.length,
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

    // 1️⃣ Embed the query (correct model name)
    const embeddedQuestionFormat = await voyageClient.embed({
      model: "voyage-3-large",
      input: OurQuery.query,
    });

    // 2️⃣ Retrieve documents
    const queryResult = await DataModel.aggregate([
      {
        $vectorSearch: {
          index: "vector_indexx",
          path: "embedding",
          queryVector: embeddedQuestionFormat.data[0].embedding,
          numCandidates: 100,
          limit: 3,
        },
      },
    ]);

    // 3️⃣ Construct context
    const context = queryResult.map((doc) => doc.text).join("\n---\n");

    // 4️⃣ Prepare prompt
   const systemPrompt = `You are the CSEC Dev Division information bot.
Follow these rules in order:
1) If the user asks who/what you are, your name, or what you do, reply exactly:
"I'm the CSEC Dev Division information bot. I answer questions about the CSEC Dev Division—sessions, events, resources, and internal info."
2) If the provided context contains the answer, provide it directly and concisely.
3) If the user's question is about other CSEC divisions (AI, CP, Design, etc.) and the context is empty or irrelevant, reply exactly:
"hehe i guess other divisions don’t have an information bot yet—pretty sure they’re using word of mouth. I don’t know about them; ask them in person."
4) For any other question where the context lacks the answer, reply:
"I don't have that specific information in my current knowledge base."
5) If it's a greeting, respond briefly and warmly.`;

    const userQuery = `Based on the following context, answer the user's question:

Context:
${context}

User Question: ${OurQuery.query}`;

    // 5️⃣ Call Gemini
    const geminiApiKey = process.env.GEMINI_API_KEY || "";
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`;

    const payload = {
      contents: [{ role: "user", parts: [{ text: userQuery }] }],
      // In the REST API, the field is system_instruction (underscore). Keeping both for safety:
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

    // 6️⃣ Save to cache
    try {
      await CacheModel.create({ query: OurQuery.query, answer: finalAnswer });
    } catch (e) {
      console.error("Cache save failed:", e);
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

