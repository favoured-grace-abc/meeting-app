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
import { api, ApiError } from "../services/api";
import type { Meeting } from "../types";
import AppLayout from "../components/AppLayout";

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
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await api.listMeetings();
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((list) => {
        if (cancelled) return;
        setMeetings(list);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Failed to load meetings",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    const handler = () => {
      void load()
        .then((list) => setMeetings(list))
        .catch(() => undefined);
    };
    window.addEventListener("meetflow:meetings-updated", handler);
    return () =>
      window.removeEventListener("meetflow:meetings-updated", handler);
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
            <VoiceRecorder
              onSaved={() => {
                void load()
                  .then(setMeetings)
                  .catch(() => undefined);
              }}
            />
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
                        key={meeting.id}
                        onClick={() => navigate("/recordings")}
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
                              label="Ready"
                              color="success"
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
