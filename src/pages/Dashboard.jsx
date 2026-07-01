import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import VideocamIcon from '@mui/icons-material/Videocam';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { useAuth } from '../contexts/AuthContext';
import { getUserMeetings, getDocs } from '../services/firebase';
import { createInstantMeeting } from '../services/livekit';

function formatDate(meeting) {
  const ts = meeting.scheduledAt || meeting.createdAt;
  return ts?.toDate
    ? ts.toDate().toLocaleString()
    : 'Now';
}

const statusConfig = {
  active: { label: 'Active', color: 'success' },
  scheduled: { label: 'Scheduled', color: 'warning' },
  ended: { label: 'Ended', color: 'default' },
};

function StatCard({ label, count, color }) {
  return (
    <Card
      sx={{
        borderLeft: 4,
        borderLeftColor: `${color}.main`,
        bgcolor: 'rgba(255,255,255,0.02)',
      }}
    >
      <CardContent sx={{ py: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h3" sx={{ mt: 0.5, fontWeight: 700 }}>
          {count}
        </Typography>
      </CardContent>
    </Card>
  );
}

function MeetingCard({ meeting }) {
  const navigate = useNavigate();
  const config = statusConfig[meeting.status] || statusConfig.ended;

  return (
    <Card
      sx={{
        borderLeft: 4,
        borderLeftColor: `${config.color}.main`,
        transition: 'border-color 0.2s, bgcolor 0.2s',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
      }}
    >
      <CardActionArea onClick={() => navigate(`/meeting/${meeting.id}`)}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" noWrap>
                {meeting.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {formatDate(meeting)}
              </Typography>
            </Box>
            <Chip
              label={config.label}
              size="small"
              color={config.color === 'default' ? undefined : config.color}
              variant={config.color === 'default' ? 'outlined' : 'filled'}
              sx={{ ml: 1, flexShrink: 0 }}
            />
          </Box>
          {meeting.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 1.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {meeting.description}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchMeetings = async () => {
      try {
        const q = getUserMeetings(user.id);
        const snapshot = await getDocs(q);
        const list = [];
        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
        setMeetings(list);
        setFetchError(null);
      } catch (err) {
        console.error('Failed to fetch meetings:', err);
        setFetchError(err.message || 'Failed to load meetings.');
      } finally {
        setLoading(false);
      }
    };
    fetchMeetings();
  }, [user]);

  const handleInstantMeeting = async () => {
    setCreating(true);
    try {
      const data = await createInstantMeeting(user.id);
      navigate(`/meeting/${data.meetingId}`);
    } catch (err) {
      console.error('Failed to create meeting:', err);
    } finally {
      setCreating(false);
    }
  };

  const activeMeetings = meetings.filter((m) => m.status === 'active');
  const scheduledMeetings = meetings.filter((m) => m.status === 'scheduled');
  const pastMeetings = meetings.filter((m) => m.status === 'ended');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Button
          variant="contained"
          size="large"
          startIcon={creating ? <CircularProgress size={18} color="inherit" /> : <VideocamIcon />}
          onClick={handleInstantMeeting}
          disabled={creating}
          sx={{ px: 4, py: 1.5, width: { xs: '100%', sm: 'auto' } }}
        >
          {creating ? 'Creating...' : 'New Instant Meeting'}
        </Button>
        <Button
          variant="outlined"
          size="large"
          startIcon={<CalendarMonthIcon />}
          onClick={() => navigate('/schedule')}
          sx={{ px: 4, py: 1.5, width: { xs: '100%', sm: 'auto' } }}
        >
          Schedule
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={4}>
          <StatCard label="Active" count={activeMeetings.length} color="success" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard label="Scheduled" count={scheduledMeetings.length} color="warning" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard label="Total" count={meetings.length} color="primary" />
        </Grid>
      </Grid>

      {fetchError && (
        <Alert severity="error" onClose={() => setFetchError(null)}>
          {fetchError}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : meetings.length === 0 ? (
        <Card
          variant="outlined"
          sx={{
            borderStyle: 'dashed',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 8,
            bgcolor: 'transparent',
          }}
        >
          <Typography variant="h6" color="text.secondary">
            No meetings yet
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
            Start an instant meeting or schedule one for later.
          </Typography>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {activeMeetings.length > 0 && (
            <Box>
              <Typography
                variant="overline"
                sx={{ color: 'text.secondary', mb: 2, display: 'block', letterSpacing: 1 }}
              >
                Active
              </Typography>
              <Grid container spacing={2}>
                {activeMeetings.map((m) => (
                  <Grid key={m.id} item xs={12} sm={6} lg={4}>
                    <MeetingCard meeting={m} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {scheduledMeetings.length > 0 && (
            <Box>
              <Typography
                variant="overline"
                sx={{ color: 'text.secondary', mb: 2, display: 'block', letterSpacing: 1 }}
              >
                Upcoming
              </Typography>
              <Grid container spacing={2}>
                {scheduledMeetings.map((m) => (
                  <Grid key={m.id} item xs={12} sm={6} lg={4}>
                    <MeetingCard meeting={m} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {pastMeetings.length > 0 && (
            <Box>
              <Typography
                variant="overline"
                sx={{ color: 'text.secondary', mb: 2, display: 'block', letterSpacing: 1 }}
              >
                Past
              </Typography>
              <Grid container spacing={2}>
                {pastMeetings.map((m) => (
                  <Grid key={m.id} item xs={12} sm={6} lg={4}>
                    <MeetingCard meeting={m} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
