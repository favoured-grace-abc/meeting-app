import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function CaptionsOverlay({ currentCaption, history }) {
  const recent = history.slice(-5);

  if (recent.length === 0 && !currentCaption) return null;

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 640,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        px: 2,
      }}
    >
      {recent.map((entry) => (
        <Box
          key={entry.id}
          className={entry === currentCaption ? 'caption-fade-in' : ''}
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
            '@keyframes fadeIn': {
              from: { opacity: 0, transform: 'translateY(8px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
            '&.caption-fade-in': {
              animation: 'fadeIn 0.3s ease',
            },
          }}
        >
          <Box
            sx={{
              px: 1,
              py: 0.3,
              borderRadius: 1,
              bgcolor: entry.speaker?.color || 'grey.600',
              flexShrink: 0,
              mt: 0.3,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: 'white',
                fontWeight: 600,
                fontSize: 10,
                lineHeight: 1.4,
                whiteSpace: 'nowrap',
              }}
            >
              {entry.speaker?.name || 'Speaker'}
            </Typography>
          </Box>
          <Box
            sx={{
              bgcolor: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(6px)',
              borderRadius: 1.5,
              px: 1.5,
              py: 1,
              flex: 1,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: 'grey.100',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {entry.text}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
