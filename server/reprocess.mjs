import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processRecording } from './lib/transcriber.js';
import { listRecordings, getMeeting } from './lib/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEETINGS_DIR = path.join(__dirname, 'data', 'meetings');

const meetingFiles = fs
  .readdirSync(MEETINGS_DIR)
  .filter((f) => f.endsWith('.json'));

let processed = 0;
let failed = 0;

for (const file of meetingFiles) {
  const meeting = JSON.parse(
    fs.readFileSync(path.join(MEETINGS_DIR, file), 'utf8'),
  );
  const recordings = await listRecordings(meeting.id);
  for (const rec of recordings) {
    try {
      await processRecording(
        {
          meetingId: meeting.id,
          recordingId: rec.id,
          durationMs: rec.durationMs || 0,
        },
        () => {},
      );
      const after = await getMeeting(meeting.id);
      if (after?.status === 'Ready') {
        console.log(`OK ${meeting.title} / ${rec.id}`);
        processed += 1;
      } else {
        console.error(`FAIL ${meeting.title} / ${rec.id}: ${after?.failureMessage || 'not ready'}`);
        failed += 1;
      }
    } catch (err) {
      console.error(`ERR ${meeting.title} / ${rec.id}: ${err.message}`);
      failed += 1;
    }
  }
}

console.log(`Done. processed=${processed} failed=${failed}`);