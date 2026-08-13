// Transcript formatting and export utilities

const SEPARATOR = '─'.repeat(60);

export function formatTimestamp(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

export function formatSRT(segments) {
  return segments
    .map((seg, idx) => {
      const start = formatTimestamp(seg.start);
      const end = formatTimestamp(seg.end);
      const speaker = seg.speaker ? `[${seg.speaker}] ` : '';
      return `${idx + 1}\n${start} --> ${end}\n${speaker}${seg.text}\n`;
    })
    .join('\n');
}

export function formatVTT(segments) {
  const header = 'WEBVTT\n\n';
  const body = segments
    .map((seg) => {
      const start = formatTimestamp(seg.start).replace('.', ',');
      const end = formatTimestamp(seg.end).replace('.', ',');
      const speaker = seg.speaker ? `<v ${seg.speaker}>` : '';
      const closeSpeaker = seg.speaker ? '</v>' : '';
      return `${start} --> ${end}\n${speaker}${seg.text}${closeSpeaker}\n`;
    })
    .join('\n');
  return header + body;
}

export function formatPlainText(segments) {
  return segments
    .map((seg) => {
      const speaker = seg.speaker ? `[${seg.speaker}]` : '';
      return `${speaker} ${seg.text}`;
    })
    .join('\n')
    .trim();
}

export function formatTranscriptWithTimestamps(segments) {
  const lines = [];
  lines.push('═'.repeat(60));
  lines.push('                MEETFLOW MEETING TRANSCRIPT');
  lines.push('═'.repeat(60));
  lines.push('');

  for (const seg of segments) {
    const time = formatTimestamp(seg.start);
    const speaker = seg.speaker ? `[Speaker ${seg.speaker}]` : '[Unknown]';
    lines.push(`(${time}) ${speaker}: ${seg.text}`);
  }

  lines.push('');
  lines.push(SEPARATOR);
  lines.push(`Total segments: ${segments.length}`);

  const uniqueSpeakers = [...new Set(segments.map((s) => s.speaker).filter(Boolean))];
  if (uniqueSpeakers.length > 0) {
    lines.push(`Speakers detected: ${uniqueSpeakers.join(', ')}`);
  }

  return lines.join('\n');
}

export function formatJSON(transcript) {
  return JSON.stringify(transcript, null, 2);
}

export function generateTranscriptBlob(segments, format = 'txt') {
  let content;
  let mimeType;
  let extension;

  switch (format) {
    case 'srt':
      content = formatSRT(segments);
      mimeType = 'text/plain; charset=utf-8';
      extension = 'srt';
      break;
    case 'vtt':
      content = formatVTT(segments);
      mimeType = 'text/vtt; charset=utf-8';
      extension = 'vtt';
      break;
    case 'json':
      content = formatJSON({ segments });
      mimeType = 'application/json; charset=utf-8';
      extension = 'json';
      break;
    case 'txt':
    default:
      content = formatTranscriptWithTimestamps(segments);
      mimeType = 'text/plain; charset=utf-8';
      extension = 'txt';
      break;
  }

  return {
    buffer: Buffer.from(content, 'utf-8'),
    mimeType,
    extension,
    content,
  };
}
