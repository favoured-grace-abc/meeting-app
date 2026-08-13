import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import MicIcon from '@mui/icons-material/Mic';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { api, ApiError } from '../services/api';
import type { Meeting, Recording } from '../types';
import AppLayout from '../components/AppLayout';
import { subscribeSearch } from '../utils/search';

interface RecordingRow extends Recording {
  meetingTitle: string;
}

function formatClock(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RecordingsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RecordingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    return subscribeSearch((query) => setSearchQuery(query));
  }, []);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        (row.meetingTitle || '').toLowerCase().includes(q) ||
        (row.status || '').toLowerCase().includes(q) ||
        (row.fileExtension || '').toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  const load = useCallback(async () => {
    const meetings = await api.listMeetings();
    const meetingsById = new Map(meetings.map((m) => [m.id, m]));
    const allRecordings = await Promise.all(
      meetings.map((m) => api.listRecordings(m.id).catch(() => [] as Recording[])),
    );
    const flattened: RecordingRow[] = [];
    allRecordings.forEach((recs, index) => {
      const meeting: Meeting | undefined = meetings[index];
      if (!meeting) return;
      for (const recording of recs) {
        flattened.push({
          ...recording,
          meetingTitle: meeting.title,
        });
      }
    });
    const unique = new Map<string, RecordingRow>();
    flattened.forEach((row) => unique.set(row.id, row));
    void meetingsById;
    return Array.from(unique.values()).sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1,
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((rows) => {
        if (!cancelled) setRows(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load recordings');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <AppLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
            Recordings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Audio captured during your sessions, ready to play back.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : filteredRows.length === 0 ? (
          rows.length === 0 ? (
            <Card variant="outlined" sx={{ borderStyle: 'dashed', py: 8, textAlign: 'center', bgcolor: 'transparent' }}>
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  mx: 'auto',
                  mb: 3,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(35,29,140,0.12)',
                }}
              >
                <FolderOpenIcon sx={{ fontSize: 34, color: '#231D8C' }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                No recordings yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Start a recording session and your audio will appear here.
              </Typography>
            </Card>
          ) : (
            <Card variant="outlined" sx={{ borderStyle: 'dashed', py: 8, textAlign: 'center', bgcolor: 'transparent' }}>
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  mx: 'auto',
                  mb: 3,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(220,38,38,0.10)',
                }}
              >
                <FolderOpenIcon sx={{ fontSize: 34, color: '#dc2626' }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main' }}>
                No results found for &quot;{searchQuery.trim()}&quot;
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Try a different search term or clear the search bar.
              </Typography>
            </Card>
          )
        ) : (
          <Stack spacing={2}>
            {filteredRows.map((row) => (
              <Card key={row.id}>
                <CardActionArea onClick={() => navigate(`/meeting/${row.meetingId}`)}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
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
                        <MicIcon sx={{ color: '#231D8C', fontSize: 22 }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 650 }} noWrap>
                          {row.meetingTitle}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {row.fileExtension.toUpperCase()} · {formatClock(row.durationMs)} · {formatDate(row.createdAt)}
                        </Typography>
                      </Box>
                    </Box>
                    <Chip
                      size="small"
                      label={row.status}
                      color={row.status === 'Ready' ? 'success' : row.status === 'Failed' ? 'error' : 'warning'}
                    />
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Stack>
        )}
      </Box>
    </AppLayout>
  );
}
