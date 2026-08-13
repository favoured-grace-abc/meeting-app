import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useAppTheme } from '../context/themeContext';
import AppLayout from '../components/AppLayout';

export default function SettingsPage() {
  const { mode, toggleMode } = useAppTheme();
  const isDark = mode === 'dark';

  return (
    <AppLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 720 }}>
        <Box>
          <Typography variant="h4" sx={{ color: 'text.primary' }}>
            Settings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Personalise how MeetFlow looks for you.
          </Typography>
        </Box>

        <Card variant="outlined">
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={3}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'rgba(35,29,140,0.12)',
                    }}
                  >
                    {isDark ? (
                      <DarkModeIcon sx={{ color: '#231D8C', fontSize: 24 }} />
                    ) : (
                      <LightModeIcon sx={{ color: '#231D8C', fontSize: 24 }} />
                    )}
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 650, color: 'text.primary' }}>
                      Dark mode
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Switch between light and dark appearance. Applied instantly and saved.
                    </Typography>
                  </Box>
                </Box>
                <Switch checked={isDark} onChange={toggleMode} slotProps={{ input: { 'aria-label': 'Toggle dark mode' } }} />
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </AppLayout>
  );
}