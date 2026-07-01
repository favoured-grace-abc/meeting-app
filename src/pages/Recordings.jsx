import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Collapse from '@mui/material/Collapse';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useAuth } from '../contexts/AuthContext';
import { getUserRecordings, getDocs } from '../services/firebase';

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const statusConfig = {
  processing: { label: 'Processing', color: 'warning' },
  ready: { label: 'Ready', color: 'success' },
  failed: { label: 'Failed', color: 'error' },
};

export default function Recordings() {
  const { user } = useAuth();
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!user) return;
    const fetchRecordings = async () => {
      try {
        const q = getUserRecordings(user.id);
        const snapshot = await getDocs(q);
        const list = [];
        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
        setRecordings(list);
      } catch (err) {
        console.error('Failed to fetch recordings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecordings();
  }, [user]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : recordings.length === 0 ? (
        <Card
          variant="outlined"
          sx={{
            borderStyle: 'dashed',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 8,
            bgcolor: 'transparent',
          }}
        >
          <Typography variant="h6" color="text.secondary">
            No recordings yet
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
            Recordings from your meetings will appear here.
          </Typography>
        </Card>
      ) : (
        recordings.map((rec) => {
          const config = statusConfig[rec.status] || statusConfig.ready;
          const isExpanded = expandedId === rec.id;

          return (
            <Card key={rec.id} variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                      <Typography variant="subtitle1" noWrap>
                        {rec.title || rec.meetingTitle || 'Untitled'}
                      </Typography>
                      <Chip
                        label={config.label}
                        size="small"
                        color={config.color}
                        sx={{ flexShrink: 0 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(rec.createdAt)}
                      </Typography>
                      {rec.duration && (
                        <Typography variant="body2" color="text.secondary">
                          {formatDuration(rec.duration)}
                        </Typography>
                      )}
                      {rec.fileSize && (
                        <Typography variant="body2" color="text.secondary">
                          {(rec.fileSize / (1024 * 1024)).toFixed(1)} MB
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 2, flexShrink: 0 }}>
                    {rec.status === 'ready' && rec.url && (
                      <Button
                        size="small"
                        startIcon={<DownloadIcon />}
                        href={rec.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="outlined"
                        sx={{ minWidth: 0, px: 1.5, display: { xs: 'none', sm: 'inline-flex' } }}
                      >
                        Download
                      </Button>
                    )}
                    {rec.status === 'ready' && rec.url && (
                      <IconButton
                        size="small"
                        href={rec.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ display: { xs: 'inline-flex', sm: 'none' }, color: 'text.secondary' }}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                      sx={{ color: 'text.secondary' }}
                    >
                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                </Box>

                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  {rec.status === 'ready' && (
                    <Box sx={{ mt: 2.5, pt: 2.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {rec.aiTranscription && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                            Transcription
                          </Typography>
                          <Typography
                            variant="body2"
                            color="grey.300"
                            sx={{
                              maxHeight: 192,
                              overflow: 'auto',
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.7,
                            }}
                          >
                            {rec.aiTranscription}
                          </Typography>
                        </Box>
                      )}
                      {rec.aiSummary && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                            AI Summary
                          </Typography>
                          <Typography
                            variant="body2"
                            color="grey.300"
                            sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}
                          >
                            {rec.aiSummary}
                          </Typography>
                        </Box>
                      )}
                      {rec.speakers?.length > 0 && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                            Speakers
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {rec.speakers.map((s) => (
                              <Chip key={s.id} label={s.name} size="small" variant="outlined" />
                            ))}
                          </Box>
                        </Box>
                      )}
                      {rec.transcriptUrl && (
                        <Button
                          size="small"
                          endIcon={<OpenInNewIcon />}
                          href={rec.transcriptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="text"
                          color="primary"
                          sx={{ alignSelf: 'flex-start' }}
                        >
                          View Full Transcript
                        </Button>
                      )}
                    </Box>
                  )}

                  {rec.status === 'processing' && (
                    <Box sx={{ mt: 2.5, pt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <CircularProgress size={16} />
                        <Typography variant="body2" color="text.secondary">
                          AI processing in progress...
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Collapse>
              </CardContent>
            </Card>
          );
        })
      )}
    </Box>
  );
}
