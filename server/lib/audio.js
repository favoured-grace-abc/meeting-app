const VALID_AUDIO_TYPES = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/mpeg', 'audio/mp4'];

function stripMimeParams(mimeType) {
  return mimeType ? mimeType.split(';')[0].trim() : '';
}

export function isValidAudioType(contentType) {
  return VALID_AUDIO_TYPES.includes(stripMimeParams(contentType));
}

export function validateAudioBuffer(buffer) {
  if (!buffer || Buffer.byteLength(buffer, 'utf8') < 100) {
    throw new Error('No audio data received or file too small');
  }
}

export function getFileExtension(contentType) {
  const map = {
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'audio/mp3': 'mp3',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'mp4',
  };
  return map[stripMimeParams(contentType)] || 'webm';
}

export function extractAudioFeatures(pcmBuffer, sampleRate = 16000) {
  const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 2);
  if (samples.length === 0) return { rms: 0, zcr: 0, spectralCentroid: 0, energy: 0 };

  let sumSquares = 0;
  let zeroCrossings = 0;

  for (let i = 0; i < samples.length; i++) {
    const normalized = samples[i] / 32768;
    sumSquares += normalized * normalized;
    if (i > 0 && ((samples[i] >= 0 && samples[i - 1] < 0) || (samples[i] < 0 && samples[i - 1] >= 0))) {
      zeroCrossings++;
    }
  }

  const rms = Math.sqrt(sumSquares / samples.length);
  const energy = sumSquares / samples.length;
  const zcr = zeroCrossings / samples.length;

  return { rms, zcr, spectralCentroid: rms * 1000, energy };
}

export function detectVoiceActivity(pcmBuffer, sampleRate = 16000) {
  const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 2);
  const frameSize = Math.floor(sampleRate * 0.03);
  const hopSize = Math.floor(sampleRate * 0.01);
  const energyThreshold = 0.005;

  const activeFrames = [];

  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    let sumSquares = 0;
    for (let i = start; i < start + frameSize && i < samples.length; i++) {
      const normalized = samples[i] / 32768;
      sumSquares += normalized * normalized;
    }
    const energy = sumSquares / frameSize;
    activeFrames.push({ start: start / sampleRate, energy, isSpeech: energy > energyThreshold });
  }

  const segments = [];
  let segStart = null;

  for (const frame of activeFrames) {
    if (frame.isSpeech && segStart === null) {
      segStart = frame.start;
    } else if (!frame.isSpeech && segStart !== null) {
      segments.push({ start: segStart, end: frame.start });
      segStart = null;
    }
  }
  if (segStart !== null) {
    segments.push({ start: segStart, end: activeFrames[activeFrames.length - 1].start });
  }

  return segments;
}

export function extractPcmSegment(pcmBuffer, startSec, endSec, sampleRate = 16000) {
  const startSample = Math.floor(startSec * sampleRate) * 2;
  const endSample = Math.min(Math.floor(endSec * sampleRate) * 2, pcmBuffer.length);

  if (startSample >= pcmBuffer.length || startSample >= endSample) {
    return null;
  }

  return pcmBuffer.subarray(startSample, endSample);
}
