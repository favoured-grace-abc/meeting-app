const VOICE_SERVER = import.meta.env.VITE_VOICE_SERVER || 'http://localhost:4001';

export async function speechToText(audioBlob) {
  const res = await fetch(`${VOICE_SERVER}/stt`, {
    method: 'POST',
    headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
    body: audioBlob,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'STT failed');
  }
  const data = await res.json();
  return data.text;
}

export async function textToSpeech(text) {
  const res = await fetch(`${VOICE_SERVER}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'TTS failed');
  }
  return res.blob();
}

export async function processTranscript(transcript, prompt) {
  const res = await fetch(`${VOICE_SERVER}/llm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, prompt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'LLM processing failed');
  }
  return res.json();
}
