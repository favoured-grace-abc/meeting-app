import { useState, useEffect, useCallback } from 'react';
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
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon from '@mui/icons-material/Chat';
import CallEndIcon from '@mui/icons-material/CallEnd';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../contexts/AuthContext';
import { useMeeting, useLiveKit } from '../hooks/useMeeting';
import { useVoice, useLLM } from '../hooks/useVoice';
import { getLiveKitToken, endMeeting } from '../services/livekit';
import VideoGrid, { EmptyVideoGrid } from '../components/meeting/VideoGrid';
import ChatPanel from '../components/meeting/ChatPanel';
import CaptionsOverlay from '../components/meeting/CaptionsOverlay';
import VoiceControls from '../components/meeting/VoiceControls';

export default function MeetingRoom() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { meeting, participants, messages, loading, error, sendMessage } =
    useMeeting(meetingId);
  const { service, isConnected, connect, disconnect } = useLiveKit();

  const [connecting, setConnecting] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenShareOn, setScreenShareOn] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const {
    captionsEnabled,
    caption,
    captionsHistory,
    sttError,
    toggleCaptions,
  } = useVoice();

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
      } catch (err) {
        console.error('Failed to join meeting:', err);
      } finally {
        setConnecting(false);
      }
    };

    joinMeeting();
  }, [meeting, user, isConnected, connecting, connect]);

  const handleEndMeeting = async () => {
    try {
      await endMeeting(meetingId);
      disconnect();
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to end meeting:', err);
    }
  };

  const handleLeaveMeeting = () => {
    disconnect();
    navigate('/dashboard');
  };

  const toggleMic = async () => {
    await service.toggleMic(!micOn);
    setMicOn(!micOn);
  };

  const toggleCamera = async () => {
    await service.toggleCamera(!camOn);
    setCamOn(!camOn);
  };

  const toggleScreenShare = async () => {
    await service.toggleScreenShare();
    setScreenShareOn(!screenShareOn);
  };

  const handleSummarize = async () => {
    setSummaryOpen(true);
    if (!llmResult && messages.length > 0) {
      const transcript = messages
        .filter((m) => m.type === 'text')
        .map((m) => `${m.senderName}: ${m.content}`)
        .join('\n');
      await summarize(transcript);
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

  const controlBtnSx = (isOn) => ({
    width: { xs: 40, md: 48 },
    height: { xs: 40, md: 48 },
    bgcolor: isOn ? 'grey.800' : 'error.main',
    color: isOn ? 'grey.300' : 'white',
    '&:hover': {
      bgcolor: isOn ? 'grey.700' : 'error.dark',
    },
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'black' }}>
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Box sx={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ flex: 1, position: 'relative' }}>
            {connecting ? (
              <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{ textAlign: 'center' }}>
                  <CircularProgress sx={{ mb: 2 }} />
                  <Typography color="text.secondary">Connecting to meeting...</Typography>
                </Box>
              </Box>
            ) : isConnected ? (
              <VideoGrid />
            ) : (
              <EmptyVideoGrid />
            )}
            {captionsEnabled && (
              <CaptionsOverlay
                caption={caption}
                history={captionsHistory}
              />
            )}
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              py: 2.5,
              px: 4,
              background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
            }}
          >
            <Tooltip title={micOn ? 'Mute' : 'Unmute'}>
              <IconButton onClick={toggleMic} sx={controlBtnSx(micOn)}>
                {micOn ? <MicIcon /> : <MicOffIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title={camOn ? 'Camera Off' : 'Camera On'}>
              <IconButton onClick={toggleCamera} sx={controlBtnSx(camOn)}>
                {camOn ? <VideocamIcon /> : <VideocamOffIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title={screenShareOn ? 'Stop Sharing' : 'Share Screen'}>
              <IconButton
                onClick={toggleScreenShare}
                sx={{
                  width: 48,
                  height: 48,
                  bgcolor: screenShareOn ? 'primary.main' : 'grey.800',
                  color: screenShareOn ? 'white' : 'grey.300',
                  '&:hover': { bgcolor: screenShareOn ? 'primary.dark' : 'grey.700' },
                }}
              >
                {screenShareOn ? <StopScreenShareIcon /> : <ScreenShareIcon />}
              </IconButton>
            </Tooltip>
            <VoiceControls
              captionsEnabled={captionsEnabled}
              sttError={sttError}
              onToggleCaptions={toggleCaptions}
              llmProcessing={llmProcessing}
              onSummarize={handleSummarize}
            />

            <Tooltip title={showChat ? 'Hide Chat' : 'Show Chat'}>
              <IconButton
                onClick={() => setShowChat(!showChat)}
                sx={{
                  width: 48,
                  height: 48,
                  bgcolor: showChat ? 'primary.main' : 'grey.800',
                  color: showChat ? 'white' : 'grey.300',
                  '&:hover': { bgcolor: showChat ? 'primary.dark' : 'grey.700' },
                }}
              >
                <ChatIcon />
              </IconButton>
            </Tooltip>

            {meeting?.hostId === user?.id ? (
              <Button
                variant="contained"
                color="error"
                startIcon={<CallEndIcon />}
                onClick={handleEndMeeting}
                sx={{ borderRadius: 24, px: 3, ml: 1 }}
              >
                End Meeting
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

        {showChat && (
          <Box
            sx={{
              width: { xs: '100%', md: 320 },
              borderLeft: { md: '1px solid' },
              borderColor: 'divider',
              bgcolor: 'rgba(9,9,11,0.8)',
              display: 'flex',
              flexDirection: 'column',
              position: { xs: 'absolute', md: 'static' },
              inset: 0,
              zIndex: { xs: 10, md: 'auto' },
            }}
          >
            <ChatPanel messages={messages} onSendMessage={sendMessage} />
          </Box>
        )}

        {sttError && (
          <Alert
            severity="warning"
            sx={{
              position: 'absolute',
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
      </Box>

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
              No messages to summarize yet.
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
