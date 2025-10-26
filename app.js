// app.js
import express from 'express';
import { connectDB } from './config/db.js';
import router from './routes/EmbeddingRoutes.js';

const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello World from Express!');
});

connectDB()
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });
app.use(express.json());

app.use('/api/embeddings', router);



app.listen(port, () => {
  console.log(`Express app listening at http://localhost:${port}`);
});
