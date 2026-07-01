import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function CaptionsOverlay({ caption, history }) {
  const recent = caption || history.slice(-3).join(' ');

  if (!recent) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '80%',
        zIndex: 20,
        pointerEvents: 'none',
      }}
    >
      <Box
        sx={{
          bgcolor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          borderRadius: 2,
          px: 2.5,
          py: 1.5,
          textAlign: 'center',
        }}
      >
        <Typography
          variant="body1"
          sx={{
            color: 'white',
            fontSize: { xs: 14, md: 16 },
            lineHeight: 1.5,
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
        >
          {recent}
        </Typography>
      </Box>
    </Box>
  );
}
