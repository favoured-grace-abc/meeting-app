import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
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
import { getLiveKitToken, endMeeting } from '../services/livekit';
import VideoGrid, { EmptyVideoGrid } from '../components/meeting/VideoGrid';
import ChatPanel from '../components/meeting/ChatPanel';

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
      </Box>
    </Box>
  );
}
