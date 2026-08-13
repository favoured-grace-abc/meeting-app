import zlib from 'node:zlib';

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

function normalize(seg) {
  const start = seg.startMs != null ? seg.startMs / 1000 : (seg.start ?? 0);
  const end = seg.endMs != null ? seg.endMs / 1000 : (seg.end ?? start);
  return {
    start,
    end,
    speaker: seg.speakerLabel || seg.speaker || null,
    text: seg.text,
  };
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatSRT(segments) {
  return segments
    .map((raw, idx) => {
      const seg = normalize(raw);
      const start = formatTimestamp(seg.start).replace('.', ',');
      const end = formatTimestamp(seg.end).replace('.', ',');
      const speaker = seg.speaker ? `[${seg.speaker}] ` : '';
      return `${idx + 1}\n${start} --> ${end}\n${speaker}${seg.text}\n`;
    })
    .join('\n');
}

export function formatVTT(segments) {
  const header = 'WEBVTT\n\n';
  const body = segments
    .map((raw) => {
      const seg = normalize(raw);
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
    .map((raw) => {
      const seg = normalize(raw);
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

  for (const raw of segments) {
    const seg = normalize(raw);
    const time = formatTimestamp(seg.start);
    const speaker = seg.speaker ? `[${seg.speaker}]` : '[Unknown]';
    lines.push(`(${time}) ${speaker}: ${seg.text}`);
  }

  lines.push('');
  lines.push(SEPARATOR);
  lines.push(`Total segments: ${segments.length}`);

  const uniqueSpeakers = [...new Set(segments.map((s) => normalize(s).speaker).filter(Boolean))];
  if (uniqueSpeakers.length > 0) {
    lines.push(`Speakers detected: ${uniqueSpeakers.join(', ')}`);
  }

  return lines.join('\n');
}

export function formatJSON(transcript) {
  return JSON.stringify(transcript, null, 2);
}

// ── Minimal DOCX (OOXML) writer ─────────────────────
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime() {
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  return { time, date };
}

function makeZip(files) {
  const { time, date } = dosDateTime();
  const local = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const raw = file.data;
    const compressed = zlib.deflateRawSync(raw);
    const crc = crc32(raw);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 flag
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(raw.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    local.push(localHeader, name, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(raw.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    central.push(centralHeader, name);
    offset += localHeader.length + name.length + compressed.length;
  }

  const centralStart = offset;
  const centralBuffer = Buffer.concat(central);
  const centralSize = centralBuffer.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralStart, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...local, centralBuffer, eocd]);
}

function formatDOCX(segments) {
  const paragraphs = [
    '<w:p><w:pPr><w:jc w:val="center"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>MeetFlow Meeting Transcript</w:t></w:r></w:p>',
  ];

  for (const raw of segments) {
    const seg = normalize(raw);
    const speaker = seg.speaker ? `[${seg.speaker}] ` : '';
    const time = formatTimestamp(seg.start);
    paragraphs.push(
      '<w:p><w:r><w:rPr><w:b/><w:color w:val="555555"/></w:rPr>' +
        `<w:t xml:space="preserve">(${time}) ${escapeXml(speaker)}:</w:t></w:r>` +
        `<w:r><w:t xml:space="preserve"> ${escapeXml(seg.text)}</w:t></w:r></w:p>`,
    );
  }

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${paragraphs.join('')}
<w:sectPr/></w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  return makeZip([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rels, 'utf8') },
    { name: 'word/document.xml', data: Buffer.from(document, 'utf8') },
  ]);
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
    case 'docx':
      return {
        buffer: formatDOCX(segments),
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: 'docx',
        content: null,
      };
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