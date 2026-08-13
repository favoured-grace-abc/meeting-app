import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MicIcon from "@mui/icons-material/Mic";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { api, ApiError } from "../services/api";
import { AudioRecorder } from "../services/recorder";
import { MeetingHubClient } from "../services/signalr";
import type {
  Meeting,
  Recording,
  Transcript,
  TranscriptSegment,
} from "../types";
import AppLayout from "../components/AppLayout";

type UploadState =
  | "idle"
  | "recording"
  | "uploading"
  | "processing"
  | "ready"
  | "failed";

function formatClock(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatTimestamp(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function statusChipColor(status: string) {
  switch (status) {
    case "Ready":
      return "success" as const;
    case "Failed":
      return "error" as const;
    case "Recording":
      return "info" as const;
    default:
      return "warning" as const;
  }
}

function SegmentRow({
  segment,
  meetingId,
  onSegment,
}: {
  segment: TranscriptSegment;
  meetingId: string;
  onSegment: (updated: TranscriptSegment) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(segment.speakerLabel);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.renameSpeaker(
        meetingId,
        segment.speakerId,
        label.trim() || segment.speakerLabel,
      );
      onSegment({
        ...segment,
        speakerLabel: label.trim() || segment.speakerLabel,
      });
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
                {segment.speakerLabel}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setEditing(true)}
                title="Rename speaker"
              >
                <EditIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </>
          )}
        </Box>
        <Typography variant="body2" sx={{ mt: 0.5, color: "text.primary" }}>
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
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const hubRef = useRef<MeetingHubClient | null>(null);

  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(
    null,
  );
  const [uploadError, setUploadError] = useState<string | null>(null);

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
    const [meet, recs, status] = await Promise.all([
      api.getMeeting(meetingId),
      api.listRecordings(meetingId).catch(() => []),
      api.getMeetingStatus(meetingId),
    ]);
    return { meet, recs, status };
  }, [meetingId]);

  useEffect(() => {
    let cancelled = false;
    loadMeeting()
      .then(async ({ meet, recs, status }) => {
        if (cancelled) return;
        setMeeting(meet);
        setRecordings(recs);
        setMeetingStatus(status.status);
        if (recs.length > 0) setActiveRecordingId(recs[0].id);
        if (status.status === "Ready") {
          await refreshTranscript();
        } else if (
          status.status === "Uploaded" ||
          status.status === "Processing"
        ) {
          setUploadState("processing");
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
  }, [loadMeeting, refreshTranscript]);

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
          if (payload.status === "Failed") setUploadState("failed");
        },
        onSegment: (segment) => {
          setTranscript((prev) => {
            if (!prev) {
              return {
                id: "",
                meetingId,
                createdAt: new Date().toISOString(),
                segments: [segment],
              };
            }
            if (prev.segments.some((s) => s.id === segment.id)) return prev;
            return { ...prev, segments: [...prev.segments, segment] };
          });
        },
      })
      .catch(() => {
        /* hub optional; polling fallback covers it */
      });

    return () => {
      void hub.disconnect();
      hubRef.current = null;
    };
  }, [meetingId, refreshTranscript]);

  // Polling fallback while processing.
  useEffect(() => {
    if (
      uploadState !== "processing" &&
      meetingStatus !== "Uploaded" &&
      meetingStatus !== "Processing"
    ) {
      return;
    }
    const interval = setInterval(async () => {
      try {
        const status = await api.getMeetingStatus(meetingId);
        setMeetingStatus(status.status);
        if (status.status === "Ready") {
          await refreshTranscript();
        } else if (status.status === "Failed") {
          setUploadState("failed");
        }
      } catch {
        /* keep polling */
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [uploadState, meetingStatus, meetingId, refreshTranscript]);

  // Load audio playback once transcript is ready.
  useEffect(() => {
    if (uploadState === "ready" && activeRecordingId && !audioUrl) {
      api
        .getAudioUrl(meetingId, activeRecordingId)
        .then(({ url }) => setAudioUrl(url))
        .catch(() => setAudioUrl(null));
    }
  }, [uploadState, activeRecordingId, audioUrl, meetingId]);

  // Timer while recording.
  useEffect(() => {
    if (uploadState !== "recording") return;
    const startedAt = Date.now() - elapsedMs;
    const interval = setInterval(
      () => setElapsedMs(Date.now() - startedAt),
      250,
    );
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadState]);

  useEffect(() => {
    return () => {
      recorderRef.current?.dispose();
    };
  }, []);

  const handleToggleRecording = async () => {
    setUploadError(null);
    if (uploadState === "recording") {
      const recorder = recorderRef.current;
      if (!recorder) return;
      try {
        const { blob, contentType, durationMs } = await recorder.stop();
        recorderRef.current = null;
        setElapsedMs(0);
        setUploadState("uploading");

        const fileExtension =
          contentType.split("/")[1]?.split(";")[0]?.trim() || "webm";

        const { recordingId, uploadUrl } = await api.requestUploadUrl(
          meetingId,
          contentType,
          fileExtension,
        );
        setActiveRecordingId(recordingId);
        await api.uploadBlob(uploadUrl, blob);
        await api.completeRecording(meetingId, recordingId, durationMs);
        setUploadState("processing");
        setMeetingStatus("Processing");
      } catch (err) {
        console.error("Recording upload failed:", err);
        setUploadError(
          err instanceof Error ? err.message : "Failed to upload recording",
        );
        setUploadState("failed");
      }
      return;
    }

    const recorder = new AudioRecorder();
    recorderRef.current = recorder;
    try {
      await recorder.start();
      setElapsedMs(0);
      setUploadState("recording");
      setMeetingStatus("Recording");
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Could not start microphone",
      );
      recorderRef.current = null;
    }
  };

  const handleExport = async (format: "srt" | "vtt" | "txt") => {
    const base =
      meeting?.title?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "meeting";
    await api.exportTranscript(meetingId, format, `${base}.${format}`);
  };

  const handleSegmentUpdate = (updated: TranscriptSegment) => {
    setTranscript((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        segments: prev.segments.map((s) => (s.id === updated.id ? updated : s)),
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

  const isRecording = uploadState === "recording";
  const isBusy = uploadState === "uploading" || uploadState === "processing";

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
        <Card
          sx={{
            p: { xs: 2, md: 3 },
            borderRadius: 3,
            background:
              "linear-gradient(135deg, rgba(35,29,140,0.10), rgba(6,182,212,0.08))",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <Box>
              <Typography
                variant="h5"
                sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}
              >
                {meeting?.title || "Meeting"}
              </Typography>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}
              >
                <Chip
                  size="small"
                  label={isBusy ? "Processing…" : meetingStatus}
                  color={statusChipColor(meetingStatus)}
                />
                {isRecording && (
                  <Chip size="small" color="error" label="● REC" />
                )}
              </Box>
            </Box>

            <Button
              variant={isRecording ? "contained" : "contained"}
              color={isRecording ? "error" : "primary"}
              size="large"
              disabled={isBusy}
              startIcon={
                isBusy ? (
                  <CircularProgress size={20} color="inherit" />
                ) : isRecording ? (
                  <StopCircleIcon />
                ) : (
                  <MicIcon />
                )
              }
              onClick={handleToggleRecording}
              sx={{ borderRadius: 12, px: 4 }}
            >
              {isBusy
                ? "Processing…"
                : isRecording
                  ? `Stop & Save (${formatClock(elapsedMs)})`
                  : "Record"}
            </Button>
          </Box>

          {uploadError && (
            <Alert
              severity="error"
              onClose={() => setUploadError(null)}
              sx={{ mt: 2 }}
            >
              {uploadError}
            </Alert>
          )}

          {meetingStatus === "Failed" && (
            <Alert severity="error" sx={{ mt: 2 }}>
              This meeting failed to process. Try recording again.
            </Alert>
          )}
        </Card>

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
                  value="txt"
                  onChange={(e) =>
                    handleExport(e.target.value as "srt" | "vtt" | "txt")
                  }
                  displayEmpty
                >
                  <MenuItem value="txt">TXT</MenuItem>
                  <MenuItem value="srt">SRT</MenuItem>
                  <MenuItem value="vtt">VTT</MenuItem>
                </Select>
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={() => handleExport("txt")}
                >
                  Download
                </Button>
              </Box>
            </Box>

            <Card variant="outlined">
              <CardContent sx={{ px: { xs: 2, md: 3 }, py: 1 }}>
                {transcript.segments.map((segment) => (
                  <SegmentRow
                    key={segment.id}
                    segment={segment}
                    meetingId={meetingId}
                    onSegment={handleSegmentUpdate}
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

        {!isRecording && !isBusy && recordings.length > 0 && (
          <Box>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ mb: 1 }}
            >
              Past recordings ({recordings.length})
            </Typography>
            <Stack spacing={1}>
              {recordings.map((recording) => (
                <Card key={recording.id} variant="outlined">
                  <CardContent
                    sx={{
                      py: 1.5,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Typography variant="body2">
                      {recording.fileExtension.toUpperCase()} ·{" "}
                      {formatClock(recording.durationMs)}
                    </Typography>
                    <Chip
                      size="small"
                      label={recording.status}
                      color={
                        recording.status === "Ready" ? "success" : "default"
                      }
                    />
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
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
