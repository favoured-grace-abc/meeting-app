import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const CLOUDFLARE_API_BASE =
  `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run`;
const AUTH_HEADERS = {
  Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
};

async function runAI(model, input, contentType) {
  const opts = {
    method: 'POST',
    headers: { ...AUTH_HEADERS },
    ...(contentType ? { 'Content-Type': contentType } : {}),
  };

  if (contentType === 'application/json') {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(input);
  } else {
    opts.body = input;
  }

  const res = await fetch(`${CLOUDFLARE_API_BASE}/${model}`, opts);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Cloudflare AI error ${res.status}: ${errText}`);
  }
  return res;
}

app.post('/stt', async (req, res) => {
  try {
    const contentType = req.headers['content-type'] || 'audio/webm';
    const audioBuffer = req.body;

    if (!audioBuffer || Buffer.byteLength(audioBuffer, 'utf8') < 100) {
      return res.status(400).json({ error: 'No audio data received' });
    }

    const cfRes = await runAI('@cf/deepgram-whisper', audioBuffer, contentType);
    const result = await cfRes.json();
    res.json({ text: result.result?.text || '' });
  } catch (err) {
    console.error('STT error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/tts', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const cfRes = await runAI('@cf/deepgram-aura', { text: text.trim() }, 'application/json');
    const arrayBuffer = await cfRes.arrayBuffer();

    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': arrayBuffer.byteLength,
    });
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/llm', async (req, res) => {
  try {
    const { transcript, prompt } = req.body;
    if (!transcript && !prompt) {
      return res.status(400).json({ error: 'transcript or prompt required' });
    }

    const systemPrompt = prompt ||
      'You are a meeting assistant. Summarize the following meeting transcript. ' +
      'List key discussion points, decisions made, and action items with owners. ' +
      'Format as JSON with keys: summary (string), keyPoints (string[]), decisions (string[]), actionItems ({task:string, owner:string}[]).';

    const fullPrompt = `${systemPrompt}\n\nTranscript:\n${transcript || ''}`;

    const cfRes = await runAI(
      '@hf/google/gemma-7b-it',
      { prompt: fullPrompt, max_tokens: 1024 },
      'application/json',
    );
    const result = await cfRes.json();
    res.json({ output: result.result?.response || '' });
  } catch (err) {
    console.error('LLM error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`MeetFlow voice server running on http://localhost:${PORT}`);
});
