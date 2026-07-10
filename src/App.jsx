import { Routes, Route, Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import CircularProgress from '@mui/material/CircularProgress';
import GoogleIcon from '@mui/icons-material/Google';
import { useAuth } from './contexts/AuthContext';
import DashboardLayout from './components/layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import ScheduleMeeting from './pages/ScheduleMeeting';
import MeetingRoom from './pages/MeetingRoom';
import Recordings from './pages/Recordings';

function LandingPage() {
  const { signIn } = useAuth();

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Box sx={{ maxWidth: 400, textAlign: 'center' }}>
        <Avatar
          sx={{
            width: 72,
            height: 72,
            mx: 'auto',
            mb: 3,
            bgcolor: 'primary.main',
            borderRadius: 3,
            fontSize: 32,
            fontWeight: 700,
          }}
        >
          M
        </Avatar>
        <Typography variant="h2" sx={{ fontSize: { xs: 32, sm: 40 }, fontWeight: 700, mb: 1.5 }}>
          MeetFlow
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: 'text.secondary', mb: 4, lineHeight: 1.6 }}
        >
          AI-powered audio recording with real-time speaker identification and transcription.
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={signIn}
          startIcon={<GoogleIcon />}
          sx={{
            bgcolor: 'white',
            color: 'black',
            px: 5,
            py: 1.5,
            '&:hover': { bgcolor: 'grey.200' },
          }}
        >
          Sign in with Google
        </Button>
      </Box>
    </Box>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={user ? <Navigate to="/dashboard" /> : <LandingPage />}
      />
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/schedule" element={<ScheduleMeeting />} />
        <Route path="/recordings" element={<Recordings />} />
      </Route>
      <Route path="/meeting/:meetingId" element={<MeetingRoom />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
