import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import InputBase from '@mui/material/InputBase';
import MicIcon from '@mui/icons-material/Mic';
import SearchIcon from '@mui/icons-material/Search';
import GridViewIcon from '@mui/icons-material/GridView';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import MenuIcon from '@mui/icons-material/Menu';
import type { ReactNode } from 'react';
import { useAuth } from '../context/authContext';
import { useAppTheme } from '../context/themeContext';
import { setSearchQuery as setSearchStoreQuery } from '../utils/search';

const DRAWER_WIDTH = 250;

export function BrandLogo() {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'primary.main',
        }}
      >
        <MicIcon sx={{ color: '#fff', fontSize: 26 }} />
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src="/logo.png"
      alt="MeetFlow logo"
      onError={() => setBroken(true)}
      sx={{ width: 48, height: 48, borderRadius: 2, objectFit: 'contain' }}
    />
  );
}

interface NavItem {
  label: string;
  icon: ReactNode;
  path: string;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut, signIn } = useAuth();
  const { mode, toggleMode } = useAppTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSearchStoreQuery(value);
  };

  const handleSearchSubmit = () => {
    navigate('/');
    window.setTimeout(() => {
      const el = document.getElementById('search-results');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems: NavItem[] = [
    { label: 'Dashboard', icon: <GridViewIcon />, path: '/' },
    { label: 'Log', icon: <CalendarMonthIcon />, path: '/schedule' },
    { label: 'Recordings', icon: <FolderOpenIcon />, path: '/recordings' },
  ];

  const sidebarContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar />
      <List sx={{ pt: 10, px: 1.5 }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 2,
                  bgcolor: isActive ? 'rgba(35,29,140,0.10)' : 'transparent',
                  '&:hover': {
                    bgcolor: isActive
                      ? 'rgba(35,29,140,0.14)'
                      : 'rgba(35,29,140,0.06)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 44,
                    color: isActive ? 'primary.main' : 'text.secondary',
                    '& svg': { fontSize: 26 },
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  slotProps={{
                    primary: {
                      sx: {
                fontSize: 15,
                        fontWeight: isActive ? 900 : 800,
                        color: isActive ? 'primary.main' : 'text.primary',
                      },
                    },
                  }}
                >
                  {item.label}
                </ListItemText>
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Box sx={{ flex: 1 }} />

      <Divider />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          p: 1,
        }}
      >
        <Tooltip title="Toggle dark mode">
          <IconButton onClick={toggleMode} sx={{ color: 'text.secondary', '& svg': { fontSize: 26 } }}>
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Settings">
          <IconButton
            onClick={() => {
              navigate('/settings');
              setMobileOpen(false);
            }}
            sx={{
              color: location.pathname === '/settings' ? 'primary.main' : 'text.secondary',
              '& svg': { fontSize: 26 },
            }}
          >
            <SettingsIcon />
          </IconButton>
        </Tooltip>
      </Box>
      <Divider />
      <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Avatar
          src={user?.photoURL || undefined}
          sx={{ width: 40, height: 40, bgcolor: '#231D8C', fontSize: 18 }}
        >
          {(user?.displayName?.[0] || 'U').toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 17, color: 'text.primary' }} noWrap>
            {user?.displayName || 'User'}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: 14, color: 'text.secondary' }} noWrap>
            {user?.email}
          </Typography>
        </Box>
        <Tooltip title="Sign out">
          <IconButton onClick={handleSignOut} sx={{ color: 'text.secondary', '& svg': { fontSize: 26 } }}>
            <LogoutIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: '#ffffff',
                color: '#3f3f46',
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ gap: 1, minHeight: { xs: 64, md: 80 }, py: 1 }}>
          <IconButton
            onClick={() => setMobileOpen(true)}
            sx={{ display: { xs: 'inline-flex', md: 'none' }, mr: 0.5, color: '#3f3f46' }}
            title="Open menu"
          >
            <MenuIcon />
          </IconButton>
          <BrandLogo />
          <Typography
            variant="h6"
            sx={{ fontWeight: 900, fontSize: 24, letterSpacing: '-0.02em', color: '#3f3f46' }}
          >
            MeetFlow
          </Typography>
          <Box
            sx={{
              ml: 'auto',
              mr: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.5,
              borderRadius: 10,
              border: '1px solid #e4e4e7',
              bgcolor: '#f6f6f7',
              minWidth: 0,
            }}
          >
            <IconButton
              size="small"
              onClick={() => searchInputRef.current?.focus()}
              title="Search"
              sx={{ color: '#71717a', p: 0.5 }}
            >
              <SearchIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <InputBase
              inputRef={searchInputRef}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearchSubmit();
              }}
              placeholder="Search meetings..."
              sx={{
                flex: 1,
                fontSize: 14,
                color: '#3f3f46',
                minWidth: 120,
                width: 170,
                '& input': {
                  py: 0.5,
                  '&::placeholder': {
                    color: '#71717a',
                    opacity: 1,
                  },
                },
              }}
            />
            <Button
              variant="contained"
              onClick={handleSearchSubmit}
              sx={{
                ml: 0.5,
                borderRadius: 8,
                px: 1.5,
                py: 0.5,
                fontSize: 13,
                backgroundImage: 'none',
                bgcolor: '#047857',
                textTransform: 'none',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              Search
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        open
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            bgcolor: 'background.paper',
          },
        }}
      >
        {sidebarContent}
      </Drawer>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            bgcolor: 'background.paper',
          },
        }}
      >
        {sidebarContent}
      </Drawer>

<Box
        component="main"
        sx={{
          flex: 1,
          width: 0,
          maxWidth: 900,
          mx: "auto",
          px: { xs: 2, md: 3 },
          pt: { xs: "80px", md: "96px" },
          pb: 4,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}