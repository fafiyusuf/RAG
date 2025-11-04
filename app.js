// app.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import router from './routes/EmbeddingRoutes.js';
import feedbackRouter from './routes/FeedbackRoutes.js';

const app = express();
const port = 3000;

// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

connectDB()
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });
app.use(express.json());

// Serve static UI from /public
app.use(express.static(path.join(__dirname, 'public')));
// Serve admin UI from /admin route (keep local, don't deploy)
app.use('/admin', express.static(path.join(__dirname, 'admin')));
// Admin route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});


// Root serves the UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.use('/api/embeddings', router);
app.use('/api/feedback', feedbackRouter);



app.listen(port, () => {
  console.log(`Express app listening at http://localhost:${port}`);
});
