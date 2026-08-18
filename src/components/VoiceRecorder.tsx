import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import MicIcon from "@mui/icons-material/Mic";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";
import { api } from "../services/api";
import { addEntry } from "../services/library";
import { AudioRecorder } from "../services/recorder";

type SaveState = "idle" | "saving" | "done" | "error";

function formatClock(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function supportsSpeechRecognition() {
  return (
    typeof window !== "undefined" &&
    (!!window.SpeechRecognition || !!window.webkitSpeechRecognition)
  );
}

function liveCaptionsEnabled() {
  return window.localStorage.getItem("meetflow-live-captions") !== "false";
}

export default function VoiceRecorder({ onSaved }: { onSaved?: () => void }) {
  const navigate = useNavigate();
  const recorderRef = useRef<AudioRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const recordingRef = useRef(false);
  const captionsOnRef = useRef(true);

  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [captions, setCaptions] = useState<{ text: string; at: number }[]>([]);
  const [interim, setInterim] = useState("");

  const speechSupported = supportsSpeechRecognition();
  const [captionsOn, setCaptionsOn] = useState(liveCaptionsEnabled);

  useEffect(() => {
    captionsOnRef.current = captionsOn;
  }, [captionsOn]);

  const toggleCaptions = () => {
    const next = !captionsOn;
    setCaptionsOn(next);
    window.localStorage.setItem("meetflow-live-captions", String(next));
  };

  const startCaptions = () => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let interimText = "";
      const finals: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript || "";
        if (result.isFinal) finals.push(text.trim());
        else interimText += text;
      }
      if (finals.length > 0) {
        const now = Date.now();
        setCaptions((prev) => [
          ...prev,
          ...finals.filter(Boolean).map((text) => ({ text, at: now })),
        ]);
      }
      setInterim(interimText);
    };
    recognition.onerror = (event) => {
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        recordingRef.current = false;
        return;
      }
    };
    recognition.onend = () => {
      if (!recordingRef.current || !captionsOnRef.current) return;
      // Chrome silently stops recognition after ~60s of continuous listening.
      // Restart quickly (a fresh instance) so captions keep flowing.
      const Ctor2 = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Ctor2) return;
      const next = new Ctor2();
      next.continuous = true;
      next.interimResults = true;
      next.lang = "en-US";
      next.maxAlternatives = 1;
      next.onresult = recognition.onresult;
      next.onerror = recognition.onerror;
      next.onend = recognition.onend;
      recognitionRef.current = next;
      try {
        next.start();
      } catch {
        /* ignore */
      }
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      /* ignore */
    }
    // Belt-and-suspenders: force a fresh recognition instance every 25s so
    // long recordings never hit the Chrome ~60s stall.
    if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
    heartbeatRef.current = window.setInterval(() => {
      const current = recognitionRef.current;
      if (!current || !recordingRef.current || !captionsOnRef.current) return;
      try {
        current.stop();
      } catch {
        /* ignore */
      }
    }, 25_000);
  };

  const stopCaptions = () => {
    if (heartbeatRef.current) {
      window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
    }
  };

  const handleStart = async () => {
    setSaveError(null);
    setSaveState("idle");
    setCaptions([]);
    setInterim("");
    const recorder = new AudioRecorder();
    recorderRef.current = recorder;
    try {
      await recorder.start();
      setElapsedMs(0);
      recordingRef.current = true;
      setRecording(true);
      if (captionsOn && speechSupported) startCaptions();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Could not start the microphone",
      );
      recorderRef.current = null;
    }
  };

  const handleStop = async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recordingRef.current = false;
    setRecording(false);
    stopCaptions();
    try {
      const { blob, contentType, durationMs } = await recorder.stop();
      recorderRef.current = null;
      setSaving(true);
      setSaveState("saving");

      const dateLabel = new Date().toLocaleString([], {
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const meeting = await api.createMeeting(`Recorded · ${dateLabel}`);

      const fileExtension =
        contentType.split("/")[1]?.split(";")[0]?.trim() || "webm";

      const { recordingId, uploadUrl } = await api.requestUploadUrl(
        meeting.id,
        contentType,
        fileExtension,
      );
      await api.uploadBlob(uploadUrl, blob);
      // `complete` kicks off the server pipeline (Uploaded -> Processing ->
      // Ready). The meeting page picks the transcript up from there — on-device
      // captions are a live preview only and are never saved as the transcript.
      await api.completeRecording(meeting.id, recordingId, durationMs);

      // The API has no list endpoint, so remember the ids locally or this
      // meeting becomes unreachable once we navigate away. See services/library.
      addEntry({
        meetingId: meeting.id,
        recordingId,
        title: meeting.title,
        createdAt: meeting.createdAt || new Date().toISOString(),
        durationMs,
        contentType,
        folderId: null,
      });

      setSaveState("done");
      onSaved?.();
      navigate(`/meeting/${meeting.id}`);
    } catch (err) {
      console.error("Failed to save quick recording:", err);
      setSaveError(
        err instanceof Error ? err.message : "Failed to save recording",
      );
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = () => {
    if (recording) void handleStop();
    else void handleStart();
  };

  useEffect(() => {
    if (!recording) return;
    const startedAt = Date.now() - elapsedMs;
    const interval = setInterval(
      () => setElapsedMs(Date.now() - startedAt),
      250,
    );
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  useEffect(() => {
    return () => {
      recordingRef.current = false;
      stopCaptions();
      recorderRef.current?.dispose();
      recorderRef.current = null;
    };
  }, []);

  const hasCaptions = captions.length > 0 || interim.trim() !== "";

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2.5,
        py: 3,
      }}
    >
      <Box sx={{ position: "relative", width: 220, height: 220 }}>
        {recording && (
          <Box
            sx={{
              position: "absolute",
              inset: -10,
              borderRadius: "50%",
              border: "4px solid rgba(239,68,68,0.35)",
              animation: "meetflow-ping 1.4s cubic-bezier(0,0,0.2,1) infinite",
            }}
          />
        )}
        <Box
          role="button"
          aria-label={recording ? "Stop recording" : "Start recording"}
          onClick={handleToggle}
          sx={{
            position: "relative",
            width: 220,
            height: 220,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            userSelect: "none",
            transition: "transform 0.25s ease, box-shadow 0.25s ease",
            background: recording
              ? "radial-gradient(circle at 30% 30%, #ef4444, #b91c1c)"
              : "radial-gradient(circle at 30% 30%, #2E26A6, #231D8C)",
            boxShadow: recording
              ? "0 0 0 12px rgba(239,68,68,0.12), 0 18px 45px rgba(185,28,28,0.45)"
              : "0 0 0 12px rgba(35,29,140,0.08), 0 18px 45px rgba(35,29,140,0.35)",
            "&:hover": { transform: "scale(1.04)" },
            "&:active": { transform: "scale(0.98)" },
          }}
        >
          {saving ? (
            <CircularProgress sx={{ color: "#fff" }} size={64} />
          ) : recording ? (
            <StopCircleIcon sx={{ color: "#fff", fontSize: 84 }} />
          ) : (
            <MicIcon sx={{ color: "#fff", fontSize: 84 }} />
          )}
        </Box>
      </Box>

      <Box sx={{ textAlign: "center" }}>
        <Typography
          variant="h5"
          sx={{ fontWeight: 800, color: "text.primary" }}
        >
          {saving
            ? "Uploading…"
            : recording
              ? `Recording · ${formatClock(elapsedMs)}`
              : saveState === "done"
                ? "Recording saved"
                : "Tap to record"}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5, maxWidth: 420, mx: "auto" }}
        >
          {saving
            ? "Your audio is uploading — transcription starts as soon as it lands."
            : recording
              ? "Tap again to stop. Your recording will be saved automatically."
              : "Tap the circle to start recording — a live preview appears below."}
        </Typography>
        {recording && (
          <Chip
            size="small"
            color="error"
            icon={<GraphicEqIcon />}
            label="LIVE"
            sx={{ mt: 1, "& .MuiChip-icon": { fontSize: 18 } }}
          />
        )}
      </Box>

      {speechSupported && (
        <Chip
          size="small"
          variant={captionsOn ? "filled" : "outlined"}
          color={captionsOn ? "primary" : "default"}
          label={captionsOn ? "Live captions on" : "Live captions off"}
          onClick={toggleCaptions}
          sx={{ cursor: "pointer" }}
        />
      )}

      {saveError && (
        <Alert severity="error" onClose={() => setSaveError(null)}>
          {saveError}
        </Alert>
      )}

      <Box
        className="meetflow-fade-in"
        sx={{
          width: "100%",
          maxWidth: 640,
          maxHeight: 240,
          overflowY: "auto",
          px: 2,
          py: 1.5,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          minHeight: hasCaptions ? 0 : 64,
        }}
      >
        {hasCaptions ? (
          <>
            {captions.map((line, i) => (
              <Typography
                key={i}
                variant="body1"
                sx={{ color: "text.primary", mb: 0.75 }}
              >
                {line.text}
              </Typography>
            ))}
            {interim && (
              <Typography variant="body1" sx={{ color: "text.disabled" }}>
                {interim}
              </Typography>
            )}
          </>
        ) : (
          <Typography
            variant="body2"
            color="text.disabled"
            sx={{ textAlign: "center", py: 2 }}
          >
            {recording
              ? "Speak now — a live preview will appear here."
              : "A live preview appears here while you record. The saved transcript comes from the server after upload."}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
