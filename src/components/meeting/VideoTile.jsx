import { useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import MicOffIcon from '@mui/icons-material/MicOff';

export default function VideoTile({ participant, isLocal }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!participant) return;

    let videoTrack;
    let audioTrack;

    participant.trackPublications.forEach((pub) => {
      if (pub.kind === 'video' && pub.track) videoTrack = pub.track;
      if (pub.kind === 'audio' && pub.track) audioTrack = pub.track;
    });

    if (videoRef.current && videoTrack) videoTrack.attach(videoRef.current);
    if (audioRef.current && audioTrack) audioTrack.attach(audioRef.current);

    return () => {
      if (videoRef.current && videoTrack) videoTrack.detach(videoRef.current);
      if (audioRef.current && audioTrack) audioTrack.detach(audioRef.current);
    };
  }, [participant]);

  if (!participant) return null;

  const name = participant.name || participant.identity || 'Unknown';
  const hasVideo = participant.isCameraEnabled ?? true;
  const isMuted = participant.isMicrophoneEnabled === false;

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 3,
        bgcolor: 'grey.900',
        minHeight: 0,
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: hasVideo ? 'block' : 'none',
        }}
      />
      <audio ref={audioRef} autoPlay playsInline muted={isLocal} />

      {!hasVideo && (
        <Box
          sx={{
            display: 'flex',
            height: '100%',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'absolute',
            inset: 0,
          }}
        >
          <Avatar
            sx={{
              width: 64,
              height: 64,
              bgcolor: 'grey.800',
              fontSize: 24,
              fontWeight: 600,
              color: 'grey.400',
            }}
          >
            {name.charAt(0).toUpperCase()}
          </Avatar>
        </Box>
      )}

      <Box
        sx={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
        }}
      >
        <Box
          sx={{
            px: 1,
            py: 0.3,
            borderRadius: 1,
            bgcolor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <Typography variant="caption" sx={{ color: 'white', fontSize: 11 }}>
            {name} {isLocal ? '(You)' : ''}
          </Typography>
        </Box>
        {isMuted && (
          <Box
            sx={{
              px: 0.75,
              py: 0.3,
              borderRadius: 1,
              bgcolor: 'rgba(239,68,68,0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <MicOffIcon sx={{ fontSize: 12, color: 'white' }} />
          </Box>
        )}
      </Box>

      {participant.isSpeaking && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: 3,
            border: '2px solid',
            borderColor: 'success.main',
            pointerEvents: 'none',
          }}
        />
      )}
    </Box>
  );
}
