import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import EventIcon from '@mui/icons-material/Event';
import { scheduleMeeting } from '../services/livekit';

export default function ScheduleMeeting() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    scheduledAt: '',
    scheduledTime: '09:00',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) {
      setError('Session title is required.');
      return;
    }
    if (!form.scheduledAt) {
      setError('Date is required.');
      return;
    }

    setSubmitting(true);
    try {
      const scheduledAt = new Date(
        `${form.scheduledAt}T${form.scheduledTime || '09:00'}`,
      );
      await scheduleMeeting({
        title: form.title.trim(),
        description: form.description.trim(),
        scheduledAt: scheduledAt.toISOString(),
      });
      navigate('/dashboard');
    } catch (err) {
      console.error('Schedule meeting failed:', err);
      setError(err.message || 'Failed to schedule meeting.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto' }}>
      <Paper
        component="form"
        onSubmit={handleSubmit}
        sx={{ p: { xs: 2.5, md: 4 }, display: 'flex', flexDirection: 'column', gap: 3 }}
      >
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EventIcon fontSize="small" />
          Schedule a Recording Session
        </Typography>

        <TextField
          label="Session Title"
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="e.g., Sprint Planning"
          fullWidth
          required
        />

        <TextField
          label="Description (optional)"
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="Agenda, notes, or links..."
          multiline
          rows={3}
          fullWidth
        />

        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
          <TextField
            label="Date"
            name="scheduledAt"
            type="date"
            value={form.scheduledAt}
            onChange={handleChange}
            fullWidth
            required
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Time"
            name="scheduledTime"
            type="time"
            value={form.scheduledTime}
            onChange={handleChange}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </Box>

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, pt: 1 }}>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            sx={{ flex: 1 }}
          >
            {submitting ? 'Scheduling...' : 'Schedule Session'}
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate('/dashboard')}
            sx={{ flex: 1 }}
          >
            Cancel
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
