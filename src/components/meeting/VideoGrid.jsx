import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import VideoTile from './VideoTile';
import { useLiveKit } from '../../hooks/useMeeting';

export default function VideoGrid() {
  const { participants } = useLiveKit();

  const count = participants.length;
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 1.5,
        height: '100%',
        p: 1.5,
      }}
    >
      {participants.map((p) => (
        <VideoTile key={p.identity} participant={p} isLocal={p.isLocal} />
      ))}
    </Box>
  );
}

export function EmptyVideoGrid() {
  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box sx={{ textAlign: 'center' }}>
        <Avatar
          sx={{
            width: 80,
            height: 80,
            mx: 'auto',
            mb: 2,
            bgcolor: 'grey.900',
          }}
        >
          <VideocamOffIcon sx={{ fontSize: 32, color: 'grey.600' }} />
        </Avatar>
        <Typography variant="h6" color="grey.400">
          Waiting for participants...
        </Typography>
        <Typography variant="body2" color="grey.600" sx={{ mt: 0.5 }}>
          Share the meeting link to invite others.
        </Typography>
      </Box>
    </Box>
  );
}
