import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import MicIcon from "@mui/icons-material/Mic";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import VoiceRecorder from "../components/VoiceRecorder";
import { api } from "../services/api";
import {
  LIBRARY_UPDATED_EVENT,
  listEntries,
  type LibraryEntry,
} from "../services/library";
import type { MeetingStatus } from "../types";
import AppLayout from "../components/AppLayout";

interface Row extends LibraryEntry {
  status: MeetingStatus | null;
}

const STATUS_COLOR: Record<
  MeetingStatus,
  "success" | "warning" | "error" | "default"
> = {
  Recording: "default",
  Uploaded: "warning",
  Processing: "warning",
  Ready: "success",
  Failed: "error",
};

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function displayTitle(value?: string | null) {
  const t = value || "";
  return t.replace(/^Recording(?=[\s·]|$)/, "Recorded");
}

export default function HomePage() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The API is addressed by id only, so the list comes from the local library
  // and each row's live status is fetched per meeting.
  const load = useCallback(async () => {
    const entries = listEntries();
    return Promise.all(
      entries.map(async (entry) => {
        const status = await api
          .getMeetingStatus(entry.meetingId)
          .then((s) => s.status)
          .catch(() => null);
        return { ...entry, status };
      }),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      load()
        .then((rows) => {
          if (cancelled) return;
          setMeetings(rows);
          setError(null);
        })
        .catch((err) => {
          if (!cancelled) {
            setError(
              err instanceof Error ? err.message : "Failed to load meetings",
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    run();
    window.addEventListener(LIBRARY_UPDATED_EVENT, run);
    return () => {
      cancelled = true;
      window.removeEventListener(LIBRARY_UPDATED_EVENT, run);
    };
  }, [load]);

  return (
    <AppLayout>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <Card
            sx={{
              borderRadius: 4,
              background:
                "linear-gradient(135deg, rgba(35,29,140,0.10), rgba(6,182,212,0.08))",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <VoiceRecorder />
          </Card>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Card
              sx={{
                borderRadius: 4,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 1.5,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Your work
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    {meetings.length}{" "}
                    {meetings.length === 1 ? "meeting" : "meetings"}
                  </Typography>
                </Box>
                {meetings.length === 0 ? (
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ py: 1 }}
                  >
                    No meetings yet. Tap the record button above to create one.
                  </Typography>
                ) : (
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                  >
                    {meetings.map((meeting) => (
                      <Card
                        key={meeting.meetingId}
                        onClick={() =>
                          navigate(`/meeting/${meeting.meetingId}`)
                        }
                        variant="outlined"
                        sx={{ cursor: "pointer" }}
                      >
                        <CardContent sx={{ py: 1.25, px: 2 }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                            }}
                          >
                            <Box
                              sx={{
                                width: 38,
                                height: 38,
                                borderRadius: 2,
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                bgcolor: "rgba(35,29,140,0.12)",
                              }}
                            >
                              <MicIcon
                                sx={{ color: "#231D8C", fontSize: 20 }}
                              />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography
                                variant="subtitle2"
                                sx={{ fontWeight: 650 }}
                                noWrap
                              >
                                {displayTitle(meeting.title)}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {formatDate(meeting.createdAt)}
                              </Typography>
                            </Box>
                            <Chip
                              size="small"
                              label={meeting.status ?? "Unavailable"}
                              color={
                                meeting.status
                                  ? STATUS_COLOR[meeting.status]
                                  : "default"
                              }
                              sx={{ flexShrink: 0 }}
                            />
                            <PlayArrowIcon
                              sx={{ color: "text.disabled", fontSize: 20 }}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          )}
        </Box>
      </Box>
    </AppLayout>
  );
}
