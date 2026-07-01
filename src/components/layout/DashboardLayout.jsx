import { useState, useCallback } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar, { DRAWER_WIDTH } from './Sidebar';
import TopBar from './TopBar';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/schedule': 'Schedule Meeting',
  '/recordings': 'Recordings',
};

export default function DashboardLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleMenuToggle = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setMobileOpen(false);
  }, []);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const title = pageTitles[location.pathname] || 'MeetFlow';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar mobileOpen={mobileOpen} onClose={handleDrawerClose} />
      <Box
        sx={{
          flex: 1,
          ml: { md: `${DRAWER_WIDTH}px` },
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <TopBar title={title} onMenuToggle={handleMenuToggle} />
        <Box component="main" sx={{ p: { xs: 2, md: 4 }, flex: 1 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
