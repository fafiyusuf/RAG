import pkg from "voyageai";
import DataModel from "../models/dataModel.js";
// Removed: import OpenAI from "openai";
// Note: We use the global 'fetch' API available in Node.js environments

const { VoyageAIClient } = pkg;

// Initialize Voyage AI Client (for embedding)
const voyageClient = new VoyageAIClient({
  apiKey: process.env.VOYAGE_API_KEY,
});

// The addDocument function remains unchanged
const addDocument = async (req, res) => {
  if (!req.body) {
    return res.status(400).json({
      success: false,
      message: 'Bad Request: "text" field is required',
    });
  }
  const data = req.body;
  console.log("Received text:", data);

  try {
    const embeddedFormat = await voyageClient.embed({
      model: "voyage-3-large",
      input: data.text,
    });
    await DataModel.create({
      text: data.text,
      embedding: embeddedFormat.data[0].embedding,
    });
    return res.status(200).json({
      success: true,
      data: embeddedFormat,
      text: embeddedFormat.data[0].embedding,
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
    // 1. EMBED THE QUERY (VoyageAI)
    const embeddedQuestionFormat = await voyageClient.embed({
      model: "voyage-3-large",
      input: OurQuery.query,
    });

    // 2. RETRIEVE DOCUMENTS (MongoDB Vector Search)
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

    // 3. CONSTRUCT THE CONTEXT AND PROMPT (RAG Core Logic)
    const context = queryResult.map((doc) => doc.text).join("\n---\n");

    // System instruction defines the LLM's behavior
    // This is your NEW, smarter system prompt
    const systemPrompt = `You are a helpful and supportive assistant for the CSEC Dev Division.
Your answer should be concise and directly address the user's question using ONLY the provided context.

Follow these rules exactly:
1.  If the provided context contains the answer, provide it directly.
2.  If the user's question is about other CSEC divisions (like AI, CP, Design, etc.) and the provided context is empty or does not contain the answer, you must reply with this exact text: 'hehe i guess other divisions don’t have an information bot yet—pretty sure they’re using word of mouth. I don’t know about them; ask them in person.'
3.  For ANY other question where the context does not contain the answer, you must state: 'I don't have that specific information in my current knowledge base.'
4.  Keep your tone light and engaging, adding a touch of humor where appropriate.
5. If its greeting, respond in a good manner.`;

    // User query includes the grounded context
    const userQuery = `Based on the following context, answer the user's question:

Context:
${context}

User Question: ${OurQuery.query}`;

    // 4. GENERATE THE ANSWER (Gemini LLM Call)
    const geminiApiKey = process.env.GEMINI_API_KEY || "";
    // Note: We use the preview model for grounding capabilities.
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`;

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
    };

    const response = await fetch(geminiApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Log the error response body if possible
      const errorBody = await response.text();
      console.error(
        `Gemini API request failed: ${response.status} - ${errorBody}`
      );
      throw new Error(
        `Gemini API request failed with status ${response.status}`
      );
    }

    const result = await response.json();
    let finalAnswer = "Could not generate an answer from the Gemini model.";

    // Safely extract the generated text
    const candidate = result.candidates?.[0];
    if (candidate && candidate.content?.parts?.[0]?.text) {
      finalAnswer = candidate.content.parts[0].text;
    }

    console.log("Query Result:", queryResult);
    console.log("Final Answer:", finalAnswer);

    // 5. SEND THE FINAL RESPONSE
    return res.status(200).json({
      success: true,
      query: OurQuery.query,
      retrieved_data: queryResult.map((doc) => doc.text),
      answer: finalAnswer,
    });
  } catch (error) {
    console.error("Error querying document or generating answer:", error);
    res.status(500).send("Internal Server Error");
  }
};

export { addDocument, queryDocument };

