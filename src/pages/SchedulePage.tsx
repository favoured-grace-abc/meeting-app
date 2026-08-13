import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VideocamIcon from '@mui/icons-material/Videocam';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import { api, ApiError } from '../services/api';
import type { Meeting } from '../types';
import { toIso } from '../utils/date';
import AppLayout from '../components/AppLayout';
import NewMeetingDialog from '../components/NewMeetingDialog';
import { subscribeSearch } from '../utils/search';
import HorizontalCalendar from '../components/HorizontalCalendar';

function matchesQuery(meeting: Meeting, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const title = (meeting.title || '').toLowerCase();
  const hints = (meeting.participantHints || []).join(' ').toLowerCase();
  const status = (meeting.status || '').toLowerCase();
  return title.includes(query) || hints.includes(query) || status.includes(query);
}

export default function SchedulePage() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIso, setSelectedIso] = useState(() => toIso(new Date()));
  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);

  useEffect(() => {
    return subscribeSearch((query) => setSearchQuery(query));
  }, []);

  const filteredMeetings = useMemo(
    () => meetings.filter((m) => matchesQuery(m, searchQuery)),
    [meetings, searchQuery],
  );

  const load = useCallback(async () => {
    return api.listMeetings();
  }, []);

  const handleCreate = async (
    title: string,
    hints: string[],
    scheduledAt: string | null,
  ) => {
    const meeting = await api.createMeeting(title, hints, scheduledAt);
    window.dispatchEvent(new Event('meetflow:meetings-updated'));
    if (scheduledAt) {
      setSelectedIso(toIso(new Date(scheduledAt)));
    }
    await load().then(setMeetings).catch(() => undefined);
    if (!scheduledAt) {
      navigate(`/meeting/${meeting.id}`);
    }
  };

  const handleUpdate = async (
    title: string,
    hints: string[],
    scheduledAt: string | null,
  ) => {
    if (!editingMeeting) return;
    await api.updateMeeting(editingMeeting.id, { title, participantHints: hints, scheduledAt });
    setEditingMeeting(null);
    window.dispatchEvent(new Event('meetflow:meetings-updated'));
    if (scheduledAt) setSelectedIso(toIso(new Date(scheduledAt)));
    await load().then(setMeetings).catch(() => undefined);
  };

  const handleDelete = async (meeting: Meeting) => {
    await api.deleteMeeting(meeting.id);
    window.dispatchEvent(new Event('meetflow:meetings-updated'));
    await load().then(setMeetings).catch(() => undefined);
  };

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
          setError(err instanceof ApiError ? err.message : 'Failed to load meetings');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const scheduled = useMemo(
    () => filteredMeetings.filter((m) => m.scheduledAt),
    [filteredMeetings],
  );

  const upcoming = useMemo(() => {
    const now = new Date().getTime();
    return scheduled
      .filter((m) => new Date(m.scheduledAt as string).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.scheduledAt as string).getTime() -
          new Date(b.scheduledAt as string).getTime(),
      );
  }, [scheduled]);

  const selectedDayMeetings = useMemo(() => {
    return scheduled
      .filter((m) => toIso(new Date(m.scheduledAt as string)) === selectedIso)
      .sort(
        (a, b) =>
          new Date(a.scheduledAt as string).getTime() -
          new Date(b.scheduledAt as string).getTime(),
      );
  }, [scheduled, selectedIso]);

  return (
    <AppLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h4" sx={{ color: 'text.primary' }}>
              Log
            </Typography>
            <Typography variant="body1" color="text.secondary">
              See your scheduled sessions on the calendar and plan ahead.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{
              borderRadius: 12,
              backgroundImage: 'linear-gradient(135deg, #231D8C, #2E26A6)',
              textTransform: 'none',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            Add meeting
          </Button>
        </Box>

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {!loading && scheduled.length > 0 && (
          <Alert severity="info" variant="outlined">
            <Typography component="span" sx={{ fontWeight: 700 }}>
              {scheduled.length} scheduled session
              {scheduled.length === 1 ? '' : 's'}:
            </Typography>{' '}
            {upcoming.length > 0
              ? `Next up: ${upcoming[0].title} at ${formatScheduledTime(
                  upcoming[0].scheduledAt as string,
                )}`
              : 'No upcoming sessions yet.'}
          </Alert>
        )}

        {searchQuery.trim() !== '' &&
          !loading &&
          filteredMeetings.length === 0 && (
            <Alert severity="error">
              No results found for &quot;{searchQuery.trim()}&quot;
            </Alert>
          )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={{ xs: 3, md: 6 }}>
            <Grid size={{ xs: 12, md: 7 }}>
              <HorizontalCalendar
                meetings={filteredMeetings}
                selectedIso={selectedIso}
                onSelectDay={setSelectedIso}
              />

              <Box sx={{ mt: 4, mb: 1.5 }}>
                <Typography variant="h6" sx={{ color: 'text.primary' }}>
                  {selectedDayMeetings.length === 0
                    ? 'No sessions on this day'
                    : `${selectedDayMeetings.length} session${selectedDayMeetings.length === 1 ? '' : 's'} on this day`}
                </Typography>
              </Box>

              {selectedDayMeetings.length === 0 ? (
                <Card
                  variant="outlined"
                  sx={{
                    borderStyle: 'dashed',
                    py: 6,
                    textAlign: 'center',
                    bgcolor: 'transparent',
                  }}
                >
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      mx: 'auto',
                      mb: 2,
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'rgba(35,29,140,0.10)',
                    }}
                  >
                    <EventAvailableIcon sx={{ fontSize: 28, color: '#231D8C' }} />
                  </Box>
                  <Typography variant="body1" color="text.secondary">
                    No meetings scheduled for this day.
                  </Typography>
                </Card>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {selectedDayMeetings.map((meeting) => (
                    <Card key={meeting.id} variant="outlined">
                      <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
                        <CardActionArea onClick={() => navigate(`/meeting/${meeting.id}`)}>
                          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
                            <Box
                              sx={{
                                width: 44,
                                height: 44,
                                borderRadius: 2,
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: 'rgba(35,29,140,0.12)',
                              }}
                            >
                              <VideocamIcon sx={{ fontSize: 22, color: '#231D8C' }} />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 650, color: 'text.primary' }} noWrap>
                                {meeting.title}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {formatScheduledTime(meeting.scheduledAt)}
                              </Typography>
                              {meeting.participantHints &&
                                meeting.participantHints.length > 0 && (
                                  <Typography
                                    variant="caption"
                                    color="text.disabled"
                                    sx={{ display: 'block', mt: 0.25 }}
                                  >
                                    {meeting.participantHints.join(' · ')}
                                  </Typography>
                                )}
                            </Box>
                            <Chip
                              label={meeting.status}
                              size="small"
                              color={statusColor(meeting.status)}
                              variant={meeting.status === 'Ready' ? 'filled' : 'outlined'}
                              sx={{ flexShrink: 0 }}
                            />
                          </CardContent>
                        </CardActionArea>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            px: 1,
                            borderLeft: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <IconButton
                            size="small"
                            onClick={() => setEditingMeeting(meeting)}
                            title="Edit session"
                          >
                            <EditIcon sx={{ fontSize: 20, color: '#231D8C' }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(meeting)}
                            title="Delete session"
                          >
                            <DeleteIcon sx={{ fontSize: 20, color: '#dc2626' }} />
                          </IconButton>
                        </Box>
                      </Box>
                    </Card>
                  ))}
                </Box>
              )}
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" sx={{ color: 'text.primary', mb: 1.5 }}>
                    Upcoming scheduled meetings
                  </Typography>
                  {upcoming.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No upcoming scheduled meetings yet.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {upcoming.map((meeting) => (
                        <Box
                          key={meeting.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            py: 1,
                            px: 1,
                            borderRadius: 2,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
                          }}
                          onClick={() => navigate(`/meeting/${meeting.id}`)}
                        >
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: 2,
                              flexShrink: 0,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: 'rgba(35,29,140,0.10)',
                              color: '#231D8C',
                            }}
                          >
                            <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1, fontSize: 12 }}>
                              {formatDayBox(meeting.scheduledAt)}
                            </Typography>
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 650, color: 'text.primary' }} noWrap>
                              {meeting.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {formatScheduledTime(meeting.scheduledAt)}
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.25,
                              flexShrink: 0,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <IconButton
                              size="small"
                              onClick={() => setEditingMeeting(meeting)}
                              title="Edit session"
                            >
                              <EditIcon sx={{ fontSize: 18, color: '#231D8C' }} />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(meeting)}
                              title="Delete session"
                            >
                              <DeleteIcon sx={{ fontSize: 18, color: '#dc2626' }} />
                            </IconButton>
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </Box>

      <NewMeetingDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />

      <NewMeetingDialog
        key={editingMeeting ? editingMeeting.id : 'edit-empty'}
        open={Boolean(editingMeeting)}
        onClose={() => setEditingMeeting(null)}
        initial={
          editingMeeting
            ? {
                title: editingMeeting.title,
                hints: editingMeeting.participantHints || [],
                scheduledAt: editingMeeting.scheduledAt,
              }
            : null
        }
        onCreate={handleUpdate}
      />
    </AppLayout>
  );
}

function formatScheduledTime(value?: string | null): string {
  if (!value) return 'No scheduled time';
  return new Date(value).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDayBox(value?: string | null): string {
  if (!value) return '—';
  return new Date(value)
    .toLocaleString([], { month: 'short', day: 'numeric' })
    .split(' ')
    .join(' ');
}

function statusColor(status: string): 'success' | 'warning' | 'info' | 'error' | 'default' {
  switch (status) {
    case 'Ready':
      return 'success';
    case 'Recording':
      return 'info';
    case 'Failed':
      return 'error';
    case 'Processing':
    case 'Uploaded':
      return 'warning';
    default:
      return 'default';
  }
}