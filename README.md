# ASK-CSEC: AI-Powered RAG Assistant

ASK-CSEC is an intelligent information bot built for the CSEC ASTU community. It utilizes **Retrieval-Augmented Generation (RAG)** to provide accurate, context-aware answers about divisions, events, and sessions within the community.

## 🚀 How It Works (RAG Architecture)

The system operates in two primary phases: **Data Ingestion** and **Hybrid Retrieval**.

### 1. Data Ingestion (Knowledge Base Creation)
- **Chunking**: Large documents are broken down into smaller, manageable text chunks.
- **Embedding**: Each chunk is converted into a high-dimensional vector using **Voyage AI (`voyage-3-large`)**.
- **Deduplication**: Before saving, the system checks for semantic similarity. If a new chunk is too similar to an existing one (threshold > 0.90), the old one is marked as "superseded" and linked to the new version.
- **Storage**: Chunks and their embeddings are stored in **MongoDB Atlas** for vector search.

### 2. Query & Response (The Chat Experience)
- **Semantic Cache**: Before querying the LLM, the system checks a cache for similar previous questions using semantic similarity (threshold > 0.93). If a hit is found, it returns the cached answer instantly.
- **Hybrid Search**: When a cache miss occurs, the system performs a dual search:
    - **Vector Search**: Finds semantically similar chunks based on embeddings.
    - **Keyword Search**: Uses traditional text matching to ensure specific terms aren't missed.
- **Context Construction**: The top results are merged and passed to the LLM.
- **Generation**: **Google Gemini (`gemini-2.5-flash`)** generates a friendly, context-based response using a specialized system prompt.

## 🛠 Tech Stack

- **Frontend**: Vanilla JavaScript + Tailwind CSS (served via CDN).
- **Backend**: Node.js + Express.js.
- **Database**: MongoDB Atlas (Vector Search & Text Indexes).
- **AI Models**:
    - **Embeddings**: Voyage AI (`voyage-3-large`).
    - **LLM**: Google Gemini (`gemini-2.5-flash-preview-09-2025`).
- **Caching**: MongoDB-based semantic caching.

## ✨ Key Features

- **Multi-Session Chat**: Save and manage multiple conversations locally.
- **Smart Deduplication**: Automatically updates knowledge base without redundant data.
- **Hybrid Retrieval**: Combines the best of semantic and keyword search for high accuracy.
- **Mobile Friendly**: Responsive UI with a sidebar for chat history.
- **Admin Interface**: Dedicated `/admin` route for data management (internal use).

## ⚙️ Environment Setup

Create a `.env` file in the root directory:

```env
MONGO_URI=your_mongodb_atlas_uri
VOYAGE_API_KEY=your_voyage_api_key
GEMINI_API_KEY=your_google_gemini_api_key
