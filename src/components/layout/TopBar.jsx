import { useAuth } from '../../contexts/AuthContext';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';

export default function TopBar({ title, onMenuToggle }) {
  const { user, signOut } = useAuth();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 64,
        px: { xs: 2, md: 4 },
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 1100,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {!isDesktop && (
          <IconButton onClick={onMenuToggle} sx={{ color: 'text.secondary' }}>
            <MenuIcon />
          </IconButton>
        )}
        <Typography
          variant="h5"
          sx={{
            fontSize: { xs: 18, md: 20 },
            fontWeight: 600,
          }}
        >
          {title}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 } }}>
        {isDesktop && (
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.2 }}>
              {user?.displayName || 'User'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {user?.email}
            </Typography>
          </Box>
        )}
        <Avatar
          src={user?.photoURL || undefined}
          sx={{
            width: { xs: 32, md: 36 },
            height: { xs: 32, md: 36 },
            bgcolor: 'grey.800',
            fontSize: 14,
          }}
        >
          {user?.displayName?.charAt(0) || 'U'}
        </Avatar>
        {isDesktop && (
          <Button
            onClick={signOut}
            size="small"
            startIcon={<LogoutIcon />}
            sx={{
              color: 'text.secondary',
              fontSize: 12,
              px: 1.5,
              py: 0.5,
              minWidth: 0,
              '&:hover': { color: 'text.primary', bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            Sign out
          </Button>
        )}
      </Box>
    </Box>
  );
}
