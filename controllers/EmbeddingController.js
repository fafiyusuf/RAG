import pkg from "voyageai";
import DataModel from "../models/dataModel.js";
const { VoyageAIClient } = pkg;
const client = new VoyageAIClient({
  apiKey: process.env.VOYAGE_API_KEY, // make sure this is set in your .env
});
const addDocument = async (req, res) => {
  if (!req.body) {
    return res.status(400).json({
        success: false,
        message: 'Bad Request: "text" field is required'
    });
  }
  const data = req.body;
  console.log("Received text:", data);

  try {
    const embeddedFormat = await client.embed({
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
    const embeddedQuestionFormat = await client.embed({
      model: "voyage-3-large",
      input: OurQuery.query, // ✅ fixed field
    });

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

    console.log("Query Result:", queryResult);

    return res.status(200).json({
      success: true,
      query: OurQuery.query,
      data: queryResult,
    });
  } catch (error) {
    console.error("Error querying document:", error);
    res.status(500).send("Internal Server Error");
  }
};

export { addDocument, queryDocument };
