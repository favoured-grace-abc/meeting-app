import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import CircularProgress from '@mui/material/CircularProgress';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import SummarizeIcon from '@mui/icons-material/Summarize';

export default function VoiceControls({
  captionsEnabled,
  sttError,
  onToggleCaptions,
  llmProcessing,
  onSummarize,
}) {
  return (
    <>
      <Tooltip title={captionsEnabled ? 'Disable Captions' : 'Enable Captions'}>
        <IconButton
          onClick={onToggleCaptions}
          sx={{
            width: 48,
            height: 48,
            bgcolor: captionsEnabled ? (sttError ? 'warning.main' : 'primary.main') : 'grey.800',
            color: captionsEnabled ? 'white' : 'grey.300',
            '&:hover': { bgcolor: captionsEnabled ? (sttError ? 'warning.dark' : 'primary.dark') : 'grey.700' },
          }}
        >
          <SubtitlesIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title="AI Summary">
        <IconButton
          onClick={onSummarize}
          disabled={llmProcessing}
          sx={{
            width: 48,
            height: 48,
            bgcolor: 'grey.800',
            color: 'grey.300',
            '&:hover': { bgcolor: 'grey.700' },
            '&.Mui-disabled': { bgcolor: 'grey.900', color: 'grey.600' },
          }}
        >
          {llmProcessing ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            <SummarizeIcon />
          )}
        </IconButton>
      </Tooltip>
    </>
  );
}
