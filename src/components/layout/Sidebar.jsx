import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import FolderIcon from '@mui/icons-material/Folder';

export const DRAWER_WIDTH = 260;

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { to: '/schedule', label: 'Schedule', icon: CalendarMonthIcon },
  { to: '/recordings', label: 'Recordings', icon: FolderIcon },
];

function SidebarContent({ onNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleClick = (to) => {
    navigate(to);
    onNavigate?.();
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          height: 64,
          px: 3,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: 'primary.main',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          M
        </Avatar>
        <Typography variant="h6" sx={{ fontSize: 18 }}>
          MeetFlow
        </Typography>
      </Box>

      <List sx={{ px: 1.5, pt: 2, flex: 1 }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <ListItemButton
              key={item.to}
              onClick={() => handleClick(item.to)}
              selected={isActive}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                px: 2,
                py: 1.2,
                color: isActive ? 'text.primary' : 'text.secondary',
                '&.Mui-selected': {
                  bgcolor: 'grey.900',
                  '&:hover': { bgcolor: 'grey.900' },
                },
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.03)',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 36,
                  color: isActive ? 'primary.main' : 'text.secondary',
                }}
              >
                <Icon sx={{ fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Box
        sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          p: 2.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: 'success.main',
              flexShrink: 0,
            }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            All systems nominal
          </Typography>
        </Box>
      </Box>
    </>
  );
}

export default function Sidebar({ mobileOpen, onClose }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  if (isDesktop) {
    return (
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            bgcolor: 'background.default',
          },
        }}
      >
        <SidebarContent />
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="temporary"
      open={mobileOpen}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          bgcolor: 'background.default',
        },
      }}
    >
      <SidebarContent onNavigate={onClose} />
    </Drawer>
  );
}
