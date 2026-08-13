import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import VideocamIcon from "@mui/icons-material/Videocam";
import AlarmIcon from "@mui/icons-material/Alarm";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import TodayIcon from "@mui/icons-material/Today";
import HorizontalCalendar from "../components/HorizontalCalendar";
import {
  formatDayHeader,
  formatShortDate,
  formatTime,
  formatFullDateTime,
  toIso,
} from "../utils/date";
import { api, ApiError } from "../services/api";
import type { Meeting } from "../types";
import AppLayout from "../components/AppLayout";
import { subscribeSearch } from "../utils/search";

const STATUS_COLORS: Record<
  string,
  "success" | "warning" | "info" | "error" | "default"
> = {
  Recording: "info",
  Uploaded: "warning",
  Processing: "warning",
  Ready: "success",
  Failed: "error",
};

function statusColor(status: string) {
  return STATUS_COLORS[status] || "default";
}

// ── Meeting row shared between the day activities and all-sessions lists ──
function MeetingListRow({
  meeting,
  subtitle,
  onOpen,
}: {
  meeting: Meeting;
  subtitle: string;
  onOpen: () => void;
}) {
  return (
    <Card>
      <CardActionArea onClick={onOpen}>
        <CardContent
          sx={{ display: "flex", alignItems: "center", gap: 2, py: 2 }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "rgba(35,29,140,0.12)",
            }}
          >
            <VideocamIcon sx={{ fontSize: 26, color: "#231D8C" }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 650, color: 'text.primary' }}
              noWrap
            >
              {meeting.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
            {meeting.participantHints &&
              meeting.participantHints.length > 0 && (
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{ display: 'block', mt: 0.25 }}
                >
                  {meeting.participantHints.join(" · ")}
                </Typography>
              )}
          </Box>
          <Chip
            label={meeting.status}
            size="small"
            color={statusColor(meeting.status)}
            variant={meeting.status === "Ready" ? "filled" : "outlined"}
            sx={{ flexShrink: 0 }}
          />
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function EmptyDayCard({ message }: { message: string }) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderStyle: "dashed",
        py: 6,
        textAlign: "center",
        bgcolor: "transparent",
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          mx: "auto",
          mb: 2,
          borderRadius: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "rgba(35,29,140,0.10)",
        }}
      >
        <EventAvailableIcon sx={{ fontSize: 28, color: "#231D8C" }} />
      </Box>
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
    </Card>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIso, setSelectedIso] = useState(() => toIso(new Date()));
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    return subscribeSearch((query) => setSearchQuery(query));
  }, []);

  const filteredMeetings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return meetings;
    return meetings.filter((m) => {
      const title = (m.title || "").toLowerCase();
      const hints = (m.participantHints || []).join(" ").toLowerCase();
      const status = (m.status || "").toLowerCase();
      return title.includes(q) || hints.includes(q) || status.includes(q);
    });
  }, [meetings, searchQuery]);

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

  const { todayIso, meetingsToday, startingSoon, upcoming } = useMemo(() => {
    const now = new Date();
    const today = toIso(now);
    const scheduled = filteredMeetings.filter((m) => m.scheduledAt);
    const sortByDate = (a: Meeting, b: Meeting) =>
      new Date(a.scheduledAt as string).getTime() -
      new Date(b.scheduledAt as string).getTime();

    const todayList = scheduled
      .filter((m) => toIso(new Date(m.scheduledAt as string)) === today)
      .sort(sortByDate);

    const soon = scheduled
      .filter((m) => {
        const t = new Date(m.scheduledAt as string).getTime();
        return t > now.getTime() && t <= now.getTime() + 60 * 60 * 1000;
      })
      .sort(sortByDate);

    const nextUp = scheduled
      .filter(
        (m) => new Date(m.scheduledAt as string).getTime() >= now.getTime(),
      )
      .sort(sortByDate);

    return {
      todayIso: today,
      meetingsToday: todayList,
      startingSoon: soon,
      upcoming: nextUp,
    };
  }, [filteredMeetings]);

  const selectedDayMeetings = useMemo(() => {
    return filteredMeetings
      .filter(
        (m) => m.scheduledAt && toIso(new Date(m.scheduledAt)) === selectedIso,
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledAt as string).getTime() -
          new Date(b.scheduledAt as string).getTime(),
      );
  }, [filteredMeetings, selectedIso]);

  return (
    <AppLayout>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {/* Reminder alerts */}
        {startingSoon.length > 0 && (
          <Alert severity="warning" variant="outlined" icon={<AlarmIcon />}>
            <Typography component="span" sx={{ fontWeight: 700 }}>
              Reminder — starting soon:
            </Typography>{" "}
            {startingSoon
              .map((m) => `${m.title} at ${formatTime(m.scheduledAt)}`)
              .join(" · ")}
          </Alert>
        )}
        {meetingsToday.length > 0 && (
          <Alert severity="info" variant="outlined" icon={<TodayIcon />}>
            <Typography component="span" sx={{ fontWeight: 700 }}>
              {meetingsToday.length} meeting
              {meetingsToday.length === 1 ? "" : "s"} today:
            </Typography>{" "}
            {meetingsToday
              .map((m) => `${m.title} at ${formatTime(m.scheduledAt)}`)
              .join(" · ")}
          </Alert>
        )}

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {searchQuery.trim() !== "" && !loading && (
          <Alert
            severity={filteredMeetings.length > 0 ? "success" : "error"}
            variant="outlined"
          >
            {filteredMeetings.length > 0 ? (
              <>
                <Typography component="span" sx={{ fontWeight: 700 }}>
                  {filteredMeetings.length} result
                  {filteredMeetings.length === 1 ? "" : "s"} found for{" "}
                </Typography>{" "}
                &quot;{searchQuery.trim()}&quot;
              </>
            ) : (
              <>
                <Typography component="span" sx={{ fontWeight: 700 }}>
                  No results found for{" "}
                </Typography>{" "}
                &quot;{searchQuery.trim()}&quot;
              </>
            )}
          </Alert>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <HorizontalCalendar
            meetings={meetings}
            selectedIso={selectedIso}
            onSelectDay={setSelectedIso}
          />

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 1.5,
                }}
              >
                <Typography variant="h6" sx={{ color: 'text.primary' }}>
                  {selectedIso === todayIso ? "Today" : "Meetings on"} ·{" "}
                  {formatDayHeader(selectedIso)}
                </Typography>
              </Box>
              {selectedDayMeetings.length === 0 ? (
                <EmptyDayCard message="No meetings scheduled for this day." />
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {selectedDayMeetings.map((meeting) => (
                    <MeetingListRow
                      key={meeting.id}
                      meeting={meeting}
                      subtitle={`${formatTime(meeting.scheduledAt)} · scheduled ${formatShortDate(meeting.scheduledAt)}`}
                      onOpen={() => navigate(`/meeting/${meeting.id}`)}
                    />
                  ))}
                </Box>
              )}

              <Box
                id="recording-header"
                sx={{
                  mt: 4,
                  mb: 1.5,
                  position: "sticky",
                  top: 100,
                  zIndex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                  bgcolor: "background.default",
                  py: 1,
                }}
              >
                <Typography variant="h4" sx={{ color: 'text.primary' }}>
                  {searchQuery.trim()
                    ? `Search results for "${searchQuery.trim()}"`
                    : "Recordings"}
                </Typography>
                {filteredMeetings.length > 0 && (
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => navigate("/recordings")}
                    sx={{
                      borderRadius: 10,
                      px: 2,
                      fontSize: 13,
                      backgroundImage: 'linear-gradient(135deg, #231D8C, #2E26A6)',
                      textTransform: "none",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    View all
                  </Button>
                )}
              </Box>
              {filteredMeetings.length === 0 ? (
                <EmptyDayCard
                  message={
                    searchQuery
                      ? "No sessions match your search."
                      : "No sessions yet — start or schedule your first one."
                  }
                />
              ) : (
                <Box
                  id="recording-list"
                  sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                >
                  {filteredMeetings.slice(0, 3).map((meeting) => (
                    <MeetingListRow
                      key={meeting.id}
                      meeting={meeting}
                      subtitle={
                        meeting.scheduledAt
                          ? `${formatFullDateTime(meeting.scheduledAt)} · created ${formatShortDate(meeting.createdAt)}`
                          : `Created ${formatShortDate(meeting.createdAt) || "recently"}`
                      }
                      onOpen={() => navigate(`/meeting/${meeting.id}`)}
                    />
                  ))}
                </Box>
              )}

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" sx={{ color: 'text.primary', mb: 1.5 }}>
                    Upcoming meetings
                  </Typography>
                  {upcoming.length === 0 ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontSize: 15 }}
                    >
                      No upcoming meetings.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {upcoming.slice(0, 6).map((meeting) => (
                        <Box
                          key={meeting.id}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                            py: 1,
                            px: 2,
                            borderRadius: 2,
                            cursor: "pointer",
                            "&:hover": { bgcolor: "rgba(0,0,0,0.05)" },
                          }}
                          onClick={() => navigate(`/meeting/${meeting.id}`)}
                        >
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: 2,
                              flexShrink: 0,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              bgcolor: "rgba(35,29,140,0.10)",
                              color: "#231D8C",
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 800,
                                lineHeight: 1,
                                fontSize: 13,
                              }}
                            >
                              {new Date(meeting.scheduledAt as string)
                                .toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                })
                                .split(" ")
                                .join(" ")}
                            </Typography>
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 650, color: 'text.primary' }}
                              noWrap
                            >
                              {meeting.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {formatFullDateTime(meeting.scheduledAt)}
                            </Typography>
                          </Box>
                          <ArrowForwardIcon
                            sx={{ fontSize: 15, color: "text.disabled" }}
                          />
                        </Box>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </Box>
      </Box>
    </AppLayout>
  );
}
