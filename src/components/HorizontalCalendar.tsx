import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import TodayIcon from "@mui/icons-material/Today";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { isoToDate, toIso } from "../utils/date";
import type { Meeting } from "../types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS = 7;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day);
}

function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function formatShortWeekday(date: Date): string {
  return WEEKDAYS[date.getDay()];
}

export interface HorizontalCalendarProps {
  meetings: Meeting[];
  selectedIso: string;
  onSelectDay: (iso: string) => void;
}

interface DayCell {
  iso: string;
  date: Date;
  weekday: string;
  dayNum: number;
}

export default function HorizontalCalendar({
  meetings,
  selectedIso,
  onSelectDay,
}: HorizontalCalendarProps) {
  const today = startOfDay(new Date());
  const todayIso = toIso(today);
  const selectedDate = isoToDate(selectedIso);
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = addDays(startOfWeek(selectedDate), weekOffset * DAYS);

  const days = useMemo<DayCell[]>(() => {
    return Array.from({ length: DAYS }, (_, index) => {
      const date = addDays(weekStart, index);
      return {
        iso: toIso(date),
        date,
        weekday: formatShortWeekday(date),
        dayNum: date.getDate(),
      };
    });
  }, [weekStart]);

  const meetingsByDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const meeting of meetings) {
      if (!meeting.scheduledAt) continue;
      const iso = toIso(new Date(meeting.scheduledAt));
      const list = map.get(iso) || [];
      list.push(meeting);
      map.set(iso, list);
    }
    return map;
  }, [meetings]);

  const selectedCount = meetingsByDay.get(selectedIso)?.length || 0;

  const goToday = () => {
    setWeekOffset(0);
    onSelectDay(todayIso);
  };

  const shiftWindow = (direction: 1 | -1) => {
    setWeekOffset((current) => current + direction);
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: { xs: 2, md: 3 },
          pt: { xs: 2, md: 3 },
          pb: 1,
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 900,
            fontSize: 20,
            color: "text.primary",
            letterSpacing: "-0.02em",
          }}
        >
          Calendar
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<TodayIcon />}
            onClick={goToday}
            sx={{ mr: 1, textTransform: "none", fontWeight: 700 }}
          >
            Today
          </Button>
          <IconButton
            size="small"
            onClick={() => shiftWindow(-1)}
            title="Scroll earlier"
            sx={{
              color: "text.secondary",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <ChevronLeftIcon />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => shiftWindow(1)}
            title="Scroll later"
            sx={{
              color: "text.secondary",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <ChevronRightIcon />
          </IconButton>
        </Box>
      </Box>

      <CardContent sx={{ px: 0, pb: 0 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            px: { xs: 2, md: 3 },
            pb: 2,
          }}
        >
          <IconButton
            size="small"
            onClick={() => shiftWindow(-1)}
            sx={{
              color: "text.secondary",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <ChevronLeftIcon />
          </IconButton>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: 0.75,
              flex: 1,
            }}
          >
            {days.map((day) => {
              const dayMeetings = meetingsByDay.get(day.iso) || [];
              const isToday = day.iso === todayIso;
              const isSelected = day.iso === selectedIso;
              const isPast = day.date.getTime() < today.getTime();

              return (
                <Box
                  key={day.iso}
                  onClick={() => onSelectDay(day.iso)}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.75,
                    py: 1.25,
                    borderRadius: 3,
                    cursor: "pointer",
                    transition: "all 120ms ease",
                    background: isSelected
                      ? "#231D8C"
                      : isToday
                        ? "rgba(35,29,140,0.08)"
                        : "transparent",
                    color: isSelected
                      ? "#fff"
                      : isPast
                        ? "text.disabled"
                        : "text.primary",
                    border: isSelected
                      ? "1px solid #231D8C"
                      : isToday
                        ? "1px solid rgba(35,29,140,0.16)"
                        : "1px solid transparent",
                    "&:hover": {
                      background: isSelected
                        ? "#231D8C"
                        : "rgba(35,29,140,0.12)",
                    },
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      fontSize: 11,
                      textTransform: "uppercase",
                      color: isSelected
                        ? "rgba(255,255,255,0.85)"
                        : "text.secondary",
                    }}
                  >
                    {day.weekday}
                  </Typography>
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      bgcolor: isSelected
                        ? "#fff"
                        : isToday
                          ? "rgba(35,29,140,0.18)"
                          : "rgba(0,0,0,0.03)",
                      color: isSelected
                        ? "#231D8C"
                        : isPast
                          ? "text.disabled"
                          : "text.primary",
                      fontWeight: 900,
                      fontSize: 16,
                    }}
                  >
                    {day.dayNum}
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.25 }}>
                    {Array.from({
                      length: Math.min(dayMeetings.length, 2),
                    }).map((_, i) => (
                      <Box
                        key={`${day.iso}-dot-${i}`}
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          bgcolor: isSelected ? "#fff" : "#231D8C",
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              );
            })}
          </Box>
          <IconButton
            size="small"
            onClick={() => shiftWindow(1)}
            sx={{
              color: "text.secondary",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <ChevronRightIcon />
          </IconButton>
        </Box>
      </CardContent>

      <CardContent sx={{ px: { xs: 2, md: 3 }, pt: 0, pb: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {selectedCount} meeting{selectedCount === 1 ? "" : "s"}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={goToday}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Today
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
