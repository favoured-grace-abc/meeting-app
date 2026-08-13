import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Grid from '@mui/material/Grid';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CloseIcon from '@mui/icons-material/Close';
import MicIcon from '@mui/icons-material/Mic';
import { isoToDate } from '../utils/date';

function isoFor(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function NewMeetingDialog({
  open,
  onClose,
  onCreate,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (
    title: string,
    hints: string[],
    scheduledAt: string | null,
  ) => Promise<void>;
  initial?: {
    title: string;
    hints: string[];
    scheduledAt?: string | null;
  } | null;
}) {
  const [title, setTitle] = useState(initial?.title || '');
  const [hints, setHints] = useState((initial?.hints || []).join(', '));
  const [mode, setMode] = useState<'now' | 'schedule'>(
    initial?.scheduledAt ? 'schedule' : 'now',
  );
  const [date, setDate] = useState(() =>
    isoFor(
      initial?.scheduledAt ? new Date(initial.scheduledAt) : new Date(),
    ),
  );
  const [time, setTime] = useState(() => {
    const base = initial?.scheduledAt ? new Date(initial.scheduledAt) : new Date();
    base.setMinutes(base.getMinutes() + 60 - (base.getMinutes() % 15));
    return `${String(base.getHours()).padStart(2, '0')}:${String(
      base.getMinutes(),
    ).padStart(2, '0')}`;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const participantHints = hints
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);

      let scheduledAt: string | null = null;
      if (mode === 'schedule') {
        const base = isoToDate(date);
        const [hours, minutes] = time.split(':').map((part) => Number(part));
        base.setHours(hours, minutes, 0, 0);
        scheduledAt = base.toISOString();
      }

      await onCreate(trimmed, participantHints, scheduledAt);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create meeting');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {initial
          ? 'Edit session'
          : mode === 'now'
            ? 'New recording session'
            : 'Schedule a session'}
        <IconButton onClick={onClose} size="small" sx={{ ml: 1 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Meeting title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            autoFocus
            placeholder="e.g. Weekly sync"
          />
          <TextField
            label="Participant names (comma separated)"
            value={hints}
            onChange={(e) => setHints(e.target.value)}
            fullWidth
            placeholder="e.g. Alice, Bob"
            helperText="Used to label speakers in the transcript"
          />

          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={mode}
            onChange={(_e, next: 'now' | 'schedule' | null) => {
              if (next) setMode(next);
            }}
          >
            <ToggleButton value="now">Start now</ToggleButton>
            <ToggleButton value="schedule">Schedule</ToggleButton>
          </ToggleButtonGroup>

          {mode === 'schedule' && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 7 }}>
                <TextField
                  label="Date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 5 }}>
                <TextField
                  label="Time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
            </Grid>
          )}

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!title.trim() || busy}
          startIcon={
            busy ? (
              <CircularProgress size={16} color="inherit" />
            ) : initial ? null : (
              <MicIcon />
            )
          }
        >
          {initial ? 'Save' : mode === 'schedule' ? 'Schedule' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}