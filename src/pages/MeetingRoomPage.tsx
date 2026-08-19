import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { api, ApiError } from "../services/api";
import { MeetingHubClient } from "../services/signalr";
import { getEntry, updateEntry } from "../services/library";
import type { ExportFormat, Meeting, Transcript, TranscriptSegment } from "../types";
import AppLayout from "../components/AppLayout";

type UploadState = "idle" | "processing" | "ready" | "failed";

// The pipeline the backend walks a recording through after `complete`.
const PIPELINE_COPY: Record<string, string> = {
  Recording: "Waiting for the recording to finish uploading…",
  Uploaded: "Audio received — queued for transcription.",
  Processing: "Transcribing your audio. This usually takes a few seconds.",
};

// REST fallback cadence for meeting status, used only while the hub is down.
// A flat 2.5s tick billed a Cloud Run request every 2.5s for as long as the tab
// stayed open — ~1,400 an hour on a meeting that had already stopped changing.
// Back off instead, sleep while the tab is hidden, and stop asking once the budget
// is spent; the user can ask again by hand.
const POLL_MIN_MS = 3_000;
const POLL_MAX_MS = 30_000;
const POLL_BACKOFF = 1.6;
const POLL_BUDGET_MS = 10 * 60_000;

function formatTimestamp(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function SegmentRow({
  segment,
  meetingId,
  showSpeaker,
  onSpeakerRenamed,
}: {
  segment: TranscriptSegment;
  meetingId: string;
  showSpeaker: boolean;
  onSpeakerRenamed: (speakerId: string, label: string) => void;
}) {
  // Speaker fields are nullable server-side; fall back to a neutral label and
  // disable renaming when there is no speaker id to rename.
  const displayLabel = segment.speakerLabel ?? "Speaker";
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(displayLabel);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!segment.speakerId) return;
    const next = label.trim() || displayLabel;
    setSaving(true);
    try {
      await api.renameSpeaker(meetingId, segment.speakerId, next);
      onSpeakerRenamed(segment.speakerId, next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: "flex", gap: 2, py: 1.5 }}>
      <Typography
        variant="caption"
        color="text.disabled"
        sx={{
          width: 48,
          flexShrink: 0,
          mt: 0.5,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatTimestamp(segment.startMs)}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {showSpeaker && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {editing ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <TextField
                size="small"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                autoFocus
                sx={{ "& .MuiInputBase-root": { fontSize: 15 } }}
              />
              <IconButton
                size="small"
                color="primary"
                onClick={save}
                disabled={saving}
              >
                <CheckIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <>
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, color: "#231D8C" }}
              >
                {displayLabel}
              </Typography>
              {segment.speakerId && (
                <IconButton
                  size="small"
                  onClick={() => setEditing(true)}
                  title="Rename speaker"
                >
                  <EditIcon sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            </>
          )}
        </Box>
        )}
        <Typography
          variant="body2"
          sx={{ mt: showSpeaker ? 0.5 : 0, color: "text.primary" }}
        >
          {segment.text}
        </Typography>
      </Box>
    </Box>
  );
}

export default function MeetingRoomPage() {
  const { meetingId = "" } = useParams();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const hubRef = useRef<MeetingHubClient | null>(null);

  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(
    null,
  );
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("Txt");

  // The hub is the primary update channel; polling only covers the window where it
  // is not connected (the API runs without a SignalR backplane, so a push can land
  // on an instance this browser is not attached to).
  const [hubLive, setHubLive] = useState(false);
  const [pollingExhausted, setPollingExhausted] = useState(false);
  const [meetingStatus, setMeetingStatus] = useState<string>("Recording");
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const refreshTranscript = useCallback(async () => {
    try {
      const t = await api.getTranscript(meetingId);
      setTranscript(t);
      setUploadState("ready");
      setMeetingStatus("Ready");
    } catch {
      /* transcript not ready yet */
    }
  }, [meetingId]);

  const loadMeeting = useCallback(async () => {
    const [meet, status, transcript] = await Promise.all([
      api.getMeeting(meetingId),
      api.getMeetingStatus(meetingId),
      api.getTranscript(meetingId).catch(() => null),
    ]);
    // The API has no recordings-list endpoint, so the recording id comes from
    // the local library entry written when the recording was uploaded.
    return { meet, recordingId: getEntry(meetingId)?.recordingId ?? null, status, transcript };
  }, [meetingId]);

  useEffect(() => {
    let cancelled = false;
    loadMeeting()
      .then(({ meet, recordingId, status, transcript }) => {
        if (cancelled) return;
        setMeeting(meet);
        setMeetingStatus(status.status);
        if (recordingId) setActiveRecordingId(recordingId);
        // Keep the library's copy of the title in step with the server's.
        updateEntry(meetingId, { title: meet.title });
        if (transcript) {
          setTranscript(transcript);
          setUploadState("ready");
          setMeetingStatus("Ready");
        } else if (status.status === "Ready") {
          void refreshTranscript();
        } else if (
          status.status === "Uploaded" ||
          status.status === "Processing"
        ) {
          setUploadState("processing");
        } else if (status.status === "Failed") {
          setUploadState("failed");
          setFailureMessage(status.failureMessage ?? null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(
            err instanceof ApiError ? err.message : "Failed to load meeting",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadMeeting, refreshTranscript, meetingId]);

  // Live updates via SignalR hub + polling fallback.
  useEffect(() => {
    const hub = new MeetingHubClient();
    hubRef.current = hub;
    hub
      .connect(meetingId, {
        onStatus: (payload) => {
          setMeetingStatus(payload.status);
          if (payload.status === "Ready") void refreshTranscript();
          if (
            payload.status === "Processing" ||
            payload.status === "Uploaded"
          ) {
            setUploadState("processing");
          }
          if (payload.status === "Failed") {
            setUploadState("failed");
            // Hub events carry no failure detail — fetch it over REST.
            void api
              .getMeetingStatus(meetingId)
              .then((s) => setFailureMessage(s.failureMessage ?? null))
              .catch(() => undefined);
          }
        },
        onSegments: (segments) => {
          if (segments.length === 0) return;
          setTranscript((prev) => {
            const base = prev ?? {
              id: "",
              meetingId,
              createdAt: new Date().toISOString(),
              segments: [],
            };
            const seen = new Set(base.segments.map((s) => s.id));
            const added = segments.filter((s) => !seen.has(s.id));
            if (added.length === 0) return prev;
            return { ...base, segments: [...base.segments, ...added] };
          });
        },
        onConnectionChange: setHubLive,
      })
      .catch(() => {
        setHubLive(false);
      });

    return () => {
      void hub.disconnect();
      hubRef.current = null;
    };
  }, [meetingId, refreshTranscript]);

  const checkStatusOnce = useCallback(async () => {
    const status = await api.getMeetingStatus(meetingId);
    setMeetingStatus(status.status);
    if (status.status === "Ready") {
      await refreshTranscript();
    } else if (status.status === "Failed") {
      setUploadState("failed");
      setFailureMessage(status.failureMessage ?? null);
    }
    return status.status;
  }, [meetingId, refreshTranscript]);

  // Polling fallback while processing. Only runs when the hub is not delivering.
  useEffect(() => {
    const processing =
      uploadState === "processing" ||
      meetingStatus === "Uploaded" ||
      meetingStatus === "Processing";
    if (!processing || hubLive || pollingExhausted) return;

    let cancelled = false;
    let timer: number | undefined;
    let delay = POLL_MIN_MS;
    const startedAt = Date.now();

    const schedule = () => {
      if (cancelled) return;
      timer = window.setTimeout(tick, delay);
      delay = Math.min(Math.round(delay * POLL_BACKOFF), POLL_MAX_MS);
    };

    const tick = async () => {
      if (cancelled) return;
      if (Date.now() - startedAt > POLL_BUDGET_MS) {
        // Ten minutes of Processing means something is stuck, not slow. Asking on
        // forever only bills requests, so hand it back to the user rather than
        // leave an abandoned tab talking to Cloud Run all day.
        setPollingExhausted(true);
        return;
      }
      // A backgrounded tab has nobody to show the answer to.
      if (document.hidden) {
        schedule();
        return;
      }
      try {
        const status = await checkStatusOnce();
        if (cancelled || status === "Ready" || status === "Failed") return;
      } catch {
        /* keep polling */
      }
      schedule();
    };

    const onVisibilityChange = () => {
      if (cancelled || document.hidden) return;
      // Returning to the tab is the one moment a fresh check is worth paying for.
      window.clearTimeout(timer);
      delay = POLL_MIN_MS;
      void tick();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    schedule();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [
    uploadState,
    meetingStatus,
    hubLive,
    pollingExhausted,
    checkStatusOnce,
  ]);

  // Load audio playback once transcript is ready.
  useEffect(() => {
    if (uploadState === "ready" && activeRecordingId && !audioUrl) {
      api
        .getAudioUrl(meetingId, activeRecordingId)
        .then(({ url }) => setAudioUrl(url))
        .catch(() => setAudioUrl(null));
    }
  }, [uploadState, activeRecordingId, audioUrl, meetingId]);

  const handleExport = async (format: ExportFormat) => {
    const base =
      meeting?.title?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "meeting";
    await api.exportTranscript(
      meetingId,
      format,
      `${base}.${format.toLowerCase()}`,
    );
  };

  const handleRetry = async () => {
    if (!activeRecordingId) return;
    setRetrying(true);
    try {
      await api.retryMeeting(meetingId, activeRecordingId);
      setFailureMessage(null);
      setMeetingStatus("Processing");
      setUploadState("processing");
      setPollingExhausted(false);
    } catch (err) {
      setFailureMessage(
        err instanceof ApiError ? err.message : "Could not retry processing",
      );
    } finally {
      setRetrying(false);
    }
  };

  // Restarts the fallback poller after it gave up, and answers immediately so a
  // meeting that finished while nobody was asking shows up on the first click.
  const handleCheckAgain = () => {
    setPollingExhausted(false);
    void checkStatusOnce().catch(() => undefined);
  };

  // Renaming is per speaker, not per segment — relabel every segment that
  // belongs to the renamed speaker, the same way the server does.
  const handleSpeakerRenamed = (speakerId: string, label: string) => {
    setTranscript((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        segments: prev.segments.map((s) =>
          s.speakerId === speakerId ? { ...s, speakerLabel: label } : s,
        ),
      };
    });
  };

  if (loadError) {
    return (
      <AppLayout>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/")}
          sx={{ mb: 2 }}
        >
          Back
        </Button>
        <Alert severity="error">{loadError}</Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/")}
        sx={{ mb: 2 }}
      >
        Back to dashboard
      </Button>

      <Stack spacing={3}>
        {meetingStatus === "Failed" && (
          <Alert
            severity="error"
            action={
              activeRecordingId ? (
                <Button
                  color="inherit"
                  size="small"
                  disabled={retrying}
                  onClick={handleRetry}
                >
                  {retrying ? "Retrying…" : "Retry"}
                </Button>
              ) : undefined
            }
          >
            {failureMessage
              ? `This meeting failed to process: ${failureMessage}`
              : "This meeting failed to process. Try recording again."}
          </Alert>
        )}

        {uploadState !== "ready" && meetingStatus !== "Failed" && (
          <Card variant="outlined">
            <CardContent
              sx={{ display: "flex", alignItems: "center", gap: 2, py: 3 }}
            >
              {!pollingExhausted && <CircularProgress size={28} />}
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  {pollingExhausted
                    ? "Still processing"
                    : meetingStatus === "Ready"
                      ? "Finishing up…"
                      : "Processing recording"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {pollingExhausted
                    ? "This is taking longer than usual. We stopped checking automatically — check again when you are ready."
                    : (PIPELINE_COPY[meetingStatus] ??
                      "Almost there — fetching the transcript.")}
                </Typography>
              </Box>
              {pollingExhausted && (
                <Button size="small" onClick={handleCheckAgain}>
                  Check again
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {uploadState === "ready" && transcript && (
          <>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <AutoAwesomeIcon sx={{ color: "#231D8C" }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Transcript
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Select
                  size="small"
                  value={exportFormat}
                  onChange={(e) =>
                    setExportFormat(e.target.value as ExportFormat)
                  }
                >
                  <MenuItem value="Txt">TXT</MenuItem>
                  <MenuItem value="Srt">SRT</MenuItem>
                  <MenuItem value="Vtt">VTT</MenuItem>
                  <MenuItem value="Docx">DOCX</MenuItem>
                </Select>
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={() => handleExport(exportFormat)}
                >
                  Download
                </Button>
              </Box>
            </Box>

            <Card variant="outlined">
              <CardContent sx={{ px: { xs: 2, md: 3 }, py: 1 }}>
                {transcript.segments.map((segment, i) => (
                  <SegmentRow
                    key={segment.id}
                    segment={segment}
                    meetingId={meetingId}
                    showSpeaker={
                      i === 0 ||
                      transcript.segments[i - 1].speakerId !== segment.speakerId
                    }
                    onSpeakerRenamed={handleSpeakerRenamed}
                  />
                ))}
              </CardContent>
            </Card>

            {audioUrl && (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
                    <PlayArrowIcon sx={{ verticalAlign: "middle", mr: 0.5 }} />
                    Playback
                  </Typography>
                  <audio controls src={audioUrl} style={{ width: "100%" }} />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Stack>

      <Divider sx={{ my: 3 }} />
      <Typography variant="caption" color="text.disabled">
        Audio is uploaded securely to the MeetFlow backend using a short-lived
        signed URL.
      </Typography>
    </AppLayout>
  );
}
