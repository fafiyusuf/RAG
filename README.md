# RAG UI

A minimal Tailwind + vanilla JS UI for your existing RAG API.

## Endpoints

- POST `/api/embeddings/add` { "text": string }
- POST `/api/embeddings/query` { "query": string }

## Environment

Create a `.env` file with:

```
MONGO_URI=your-mongodb-uri
VOYAGE_API_KEY=your-voyageai-key
GEMINI_API_KEY=your-google-generative-language-key
```

## Run

```
pnpm install
pnpm dev
# open http://localhost:3000
```

If you prefer npm:

```
npm install
npm run dev
# open http://localhost:3000
```

## Notes

- UI is served from `public/`.
- Tailwind is loaded via CDN (no build step).
- The server will log DB connection status at startup.
