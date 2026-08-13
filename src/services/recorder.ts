const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const candidate of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return '';
}

export interface RecordedAudio {
  blob: Blob;
  contentType: string;
  durationMs: number;
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;

  get isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }

  async start(): Promise<void> {
    if (this.isRecording) return;
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('Recording is not supported in this browser');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickMimeType();
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(
      this.stream,
      mimeType ? { mimeType } : undefined,
    );
    this.mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size > 0) this.chunks.push(event.data);
    });
    this.mediaRecorder.start(250);
    this.startedAt = Date.now();
  }

  stop(): Promise<RecordedAudio> {
    return new Promise((resolve, reject) => {
      const recorder = this.mediaRecorder;
      if (!recorder || recorder.state === 'inactive') {
        reject(new Error('No active recording'));
        return;
      }
      recorder.addEventListener(
        'stop',
        () => {
          const contentType = recorder.mimeType || 'audio/webm';
          const blob = new Blob(this.chunks, { type: contentType });
          const durationMs = Date.now() - this.startedAt;
          this.cleanup();
          resolve({ blob, contentType, durationMs });
        },
        { once: true },
      );
      recorder.stop();
    });
  }

  dispose(): void {
    const recorder = this.mediaRecorder;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }
}
