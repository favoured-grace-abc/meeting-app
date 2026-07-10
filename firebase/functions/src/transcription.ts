import OpenAI from 'openai';
import { config } from './config.js';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

export interface TranscriptionResult {
  text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
    speaker?: string;
  }>;
  language: string;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.warn(`Transcription attempt ${attempt} failed, retrying in ${Math.round(delay)}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unreachable');
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
): Promise<TranscriptionResult> {
  const fileExt = mimeType.split('/')[1] || 'webm';
  const fileName = `audio.${fileExt}`;

  const file = new File([new Uint8Array(audioBuffer)], fileName, { type: mimeType });

  const transcription = await withRetry(() =>
    openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    }),
  );

  const segments = (transcription.segments || []).map((seg) => ({
    start: seg.start,
    end: seg.end,
    text: seg.text,
    speaker: undefined as string | undefined,
  }));

  return {
    text: transcription.text,
    segments,
    language: transcription.language || 'en',
  };
}

export async function generateSummary(transcript: string): Promise<string> {
  const response = await withRetry(() =>
    openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'You are an AI assistant that summarizes meeting transcripts. ' +
            'Provide a concise summary covering key discussion points, decisions, ' +
            'action items, and any deadlines mentioned. Format as bullet points.',
        },
        {
          role: 'user',
          content: `Please summarize the following meeting transcript:\n\n${transcript}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  );

  return response.choices[0]?.message?.content || 'Summary unavailable.';
}
