import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import MicIcon from '@mui/icons-material/Mic';

const COLORS = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb923c', '#2dd4dd', '#f87171'];

export default function AudioParticipantTile({ participant, isLocal }) {
  if (!participant) return null;

  const name = participant.name || participant.identity || 'Unknown';
  const isSpeaking = participant.isSpeaking;
  const colorIdx = name.length % COLORS.length;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1.5,
        borderRadius: 2,
        bgcolor: isSpeaking ? 'rgba(96,165,250,0.1)' : 'transparent',
        border: '1px solid',
        borderColor: isSpeaking ? 'primary.main' : 'transparent',
        transition: 'all 0.2s',
      }}
    >
      <Avatar
        sx={{
          width: 40,
          height: 40,
          bgcolor: COLORS[colorIdx],
          fontSize: 16,
          fontWeight: 600,
        }}
      >
        {name.charAt(0).toUpperCase()}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: isSpeaking ? 600 : 400 }}>
          {name} {isLocal ? '(You)' : ''}
        </Typography>
        {isSpeaking && (
          <Typography variant="caption" sx={{ color: 'success.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <MicIcon sx={{ fontSize: 12 }} />
            Speaking
          </Typography>
        )}
      </Box>
    </Box>
  );
}
