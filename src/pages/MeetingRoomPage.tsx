import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Alert from "@mui/material/Alert";
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
import type { Meeting, Transcript, TranscriptSegment } from "../types";
import AppLayout from "../components/AppLayout";

type UploadState = "idle" | "processing" | "ready" | "failed";

function formatTimestamp(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
  const [loadError, setLoadError] = useState<string | null>(null);

  const hubRef = useRef<MeetingHubClient | null>(null);

  const [uploadState, setUploadState] = useState<UploadState>("idle");
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
    const [meet, recs, status, transcript] = await Promise.all([
      api.getMeeting(meetingId),
      api.listRecordings(meetingId).catch(() => []),
      api.getMeetingStatus(meetingId),
      api.getTranscript(meetingId).catch(() => null),
    ]);
    return { meet, recs, status, transcript };
  }, [meetingId]);

  useEffect(() => {
    let cancelled = false;
    loadMeeting()
      .then(({ meet, recs, status, transcript }) => {
        if (cancelled) return;
        setMeeting(meet);
        setMeetingStatus(status.status);
        if (recs.length > 0) setActiveRecordingId(recs[0].id);
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
        {uploadError && (
          <Alert severity="error" onClose={() => setUploadError(null)}>
            {uploadError}
          </Alert>
        )}

        {meetingStatus === "Failed" && (
          <Alert severity="error">
            This meeting failed to process. Try recording again.
          </Alert>
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
      </Stack>

      <Divider sx={{ my: 3 }} />
      <Typography variant="caption" color="text.disabled">
        Audio is uploaded securely to the MeetFlow backend using a short-lived
        signed URL.
      </Typography>
    </AppLayout>
  );
}
