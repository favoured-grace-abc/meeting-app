import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());

app.get('/api/voice/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Voice server running on http://localhost:${PORT}`);
});