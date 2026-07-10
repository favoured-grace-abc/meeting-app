import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import LogoutIcon from '@mui/icons-material/Logout';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useAuth } from '../contexts/AuthContext';
import { useMeeting, useLiveKit } from '../hooks/useMeeting';
import { useVoice, useLLM } from '../hooks/useVoice';
import { getLiveKitToken, endMeeting } from '../services/livekit';
import AudioVisualizer, { EmptyAudioState } from '../components/meeting/VideoGrid';
import CaptionsOverlay from '../components/meeting/CaptionsOverlay';
import VoiceControls from '../components/meeting/VoiceControls';
import AudioParticipantTile from '../components/meeting/VideoTile';

export default function MeetingRoom() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { meeting, participants, loading, error } =
    useMeeting(meetingId);
  const { service, isConnected, connect, disconnect } = useLiveKit();

  const [connecting, setConnecting] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  const {
    captionsEnabled,
    currentCaption,
    captionsHistory,
    sttError,
    toggleCaptions,
    getTranscript,
  } = useVoice(participants);

  const {
    summarize,
    clear: clearSummary,
    processing: llmProcessing,
    result: llmResult,
    error: llmError,
  } = useLLM();

  useEffect(() => {
    if (!meeting || !user || isConnected || connecting) return;

    const joinMeeting = async () => {
      setConnecting(true);
      try {
        const { token, serverUrl } = await getLiveKitToken(
          meeting.roomName, user.id, user.displayName,
        );
        await connect(token, serverUrl);
        await service.toggleMic(true);
      } catch (err) {
        console.error('Failed to join meeting:', err);
      } finally {
        setConnecting(false);
      }
    };

    joinMeeting();
  }, [meeting, user, isConnected, connecting, connect, service]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleEndMeeting = async () => {
    try {
      if (captionsEnabled) toggleCaptions();
      await endMeeting(meetingId);
      disconnect();
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to end meeting:', err);
    }
  };

  const handleLeaveMeeting = () => {
    if (captionsEnabled) toggleCaptions();
    disconnect();
    navigate('/dashboard');
  };

  const toggleMic = async () => {
    await service.toggleMic(!micOn);
    setMicOn(!micOn);
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
    } else {
      setIsRecording(true);
      if (!captionsEnabled) toggleCaptions();
    }
  };

  const handleSummarize = async () => {
    setSummaryOpen(true);
    if (!llmResult) {
      const transcript = getTranscript();
      if (transcript.trim()) {
        await summarize(transcript);
      }
    }
  };

  const handleCloseSummary = () => {
    setSummaryOpen(false);
    clearSummary();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', height: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, bgcolor: 'background.default' }}>
        <Typography color="text.secondary">{error}</Typography>
        <Button variant="outlined" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {connecting ? (
          <Box sx={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ textAlign: 'center' }}>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography color="text.secondary">Connecting to recording session...</Typography>
            </Box>
          </Box>
        ) : (
          <>
            <Box
              sx={{
                px: { xs: 2, md: 4 },
                py: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" noWrap sx={{ fontWeight: 600 }}>
                  {meeting?.title || 'Recording Session'}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <AccessTimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      {formatTime(elapsed)}
                    </Typography>
                  </Box>
                  {isRecording && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'error.main', animation: 'pulse 1.5s ease-in-out infinite' }} />
                      <Typography variant="caption" color="error.main" sx={{ fontWeight: 600 }}>
                        REC
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>

            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', py: 4, px: { xs: 2, md: 4 }, overflow: 'auto' }}>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 700, mx: 'auto', width: '100%' }}>
                {isConnected ? <AudioVisualizer /> : <EmptyAudioState />}

                <Box sx={{ mt: 3, mb: 2 }}>
                  <CaptionsOverlay
                    currentCaption={currentCaption}
                    history={captionsHistory}
                  />
                </Box>
              </Box>
            </Box>
          </>
        )}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            py: 2.5,
            px: 4,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'rgba(0,0,0,0.3)',
          }}
        >
          <Tooltip title={micOn ? 'Mute' : 'Unmute'}>
            <IconButton
              onClick={toggleMic}
              sx={{
                width: { xs: 40, md: 48 },
                height: { xs: 40, md: 48 },
                bgcolor: micOn ? 'grey.800' : 'error.main',
                color: micOn ? 'grey.300' : 'white',
                '&:hover': { bgcolor: micOn ? 'grey.700' : 'error.dark' },
              }}
            >
              {micOn ? <MicIcon /> : <MicOffIcon />}
            </IconButton>
          </Tooltip>

          <Tooltip title={isRecording ? 'Stop Recording' : 'Start Recording'}>
            <IconButton
              onClick={toggleRecording}
              sx={{
                width: 56,
                height: 56,
                bgcolor: isRecording ? 'error.main' : 'grey.800',
                color: 'white',
                '&:hover': { bgcolor: isRecording ? 'error.dark' : 'grey.700' },
                border: '3px solid',
                borderColor: isRecording ? 'error.light' : 'grey.600',
              }}
            >
              {isRecording ? <StopIcon /> : <FiberManualRecordIcon />}
            </IconButton>
          </Tooltip>

          <VoiceControls
            captionsEnabled={captionsEnabled}
            sttError={sttError}
            onToggleCaptions={toggleCaptions}
            llmProcessing={llmProcessing}
            onSummarize={handleSummarize}
          />

          {meeting?.hostId === user?.id ? (
            <Button
              variant="contained"
              color="error"
              startIcon={<CallEndIcon />}
              onClick={handleEndMeeting}
              sx={{ borderRadius: 24, px: 3, ml: 1 }}
            >
              End
            </Button>
          ) : (
            <Button
              variant="contained"
              startIcon={<LogoutIcon />}
              onClick={handleLeaveMeeting}
              sx={{ borderRadius: 24, px: 3, ml: 1, bgcolor: 'grey.700', '&:hover': { bgcolor: 'grey.600' } }}
            >
              Leave
            </Button>
          )}
        </Box>
      </Box>

      <Box
        sx={{
          position: 'fixed',
          right: 16,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          maxHeight: '60vh',
          overflow: 'auto',
          zIndex: 10,
        }}
      >
        {participants.map((p) => (
          <AudioParticipantTile
            key={p.identity || p.id}
            participant={p}
            isLocal={p.isLocal}
          />
        ))}
      </Box>

      {sttError && (
        <Alert
          severity="warning"
          sx={{
            position: 'fixed',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            maxWidth: 400,
          }}
        >
          {sttError}
        </Alert>
      )}

      <Dialog open={summaryOpen} onClose={handleCloseSummary} maxWidth="md" fullWidth>
        <DialogTitle>AI Meeting Summary</DialogTitle>
        <DialogContent dividers>
          {llmProcessing ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : llmError ? (
            <Alert severity="error">{llmError}</Alert>
          ) : llmResult ? (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
              {llmResult}
            </Typography>
          ) : (
            <Typography color="text.secondary">
              No captions to summarize yet.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSummary}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
