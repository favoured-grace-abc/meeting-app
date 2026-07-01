import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1',
      light: '#818cf8',
      dark: '#4f46e5',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#22d3ee',
      light: '#67e8f9',
      dark: '#06b6d4',
    },
    error: {
      main: '#ef4444',
      light: '#fca5a5',
      dark: '#dc2626',
    },
    warning: {
      main: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706',
    },
    success: {
      main: '#10b981',
      light: '#34d399',
      dark: '#059669',
    },
    background: {
      default: '#000000',
      paper: '#09090b',
    },
    grey: {
      50: '#fafafa',
      100: '#f4f4f5',
      200: '#e4e4e7',
      300: '#d4d4d8',
      400: '#a1a1aa',
      500: '#71717a',
      600: '#52525b',
      700: '#3f3f46',
      800: '#27272a',
      900: '#18181b',
    },
    text: {
      primary: '#f4f4f5',
      secondary: '#a1a1aa',
      disabled: '#52525b',
    },
    divider: '#27272a',
  },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, letterSpacing: '-0.01em' },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 500 },
    subtitle2: { fontWeight: 500, color: '#a1a1aa' },
    body1: { letterSpacing: '0em' },
    body2: { letterSpacing: '0em', color: '#a1a1aa' },
    button: { textTransform: 'none', fontWeight: 600 },
    caption: { color: '#71717a' },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: 'thin',
          scrollbarColor: '#27272a transparent',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: '#27272a',
            borderRadius: 3,
          },
          '&::-webkit-scrollbar-thumb:hover': { background: '#3f3f46' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid #27272a',
          '&:hover': { borderColor: '#3f3f46' },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '10px 24px',
        },
        containedPrimary: {
          '&:hover': { backgroundColor: '#4f46e5' },
        },
        outlined: {
          borderColor: '#3f3f46',
          color: '#d4d4d8',
          '&:hover': {
            borderColor: '#52525b',
            backgroundColor: 'rgba(255,255,255,0.03)',
          },
        },
        text: {
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#18181b',
            '& fieldset': { borderColor: '#27272a' },
            '&:hover fieldset': { borderColor: '#3f3f46' },
            '&.Mui-focused fieldset': { borderColor: '#6366f1', borderWidth: 2 },
          },
          '& .MuiInputLabel-root': { color: '#71717a' },
          '& .MuiInputLabel-root.Mui-focused': { color: '#818cf8' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
        filled: {
          backgroundColor: '#27272a',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          border: '1px solid #27272a',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          border: 'none',
          borderRight: '1px solid #27272a',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderBottom: '1px solid #27272a',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#27272a',
          color: '#e4e4e7',
          borderRadius: 8,
          padding: '6px 12px',
          fontSize: '0.75rem',
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          border: '2px solid #27272a',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
        standardError: {
          backgroundColor: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
          color: '#fca5a5',
        },
        standardSuccess: {
          backgroundColor: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.2)',
          color: '#6ee7b7',
        },
        standardWarning: {
          backgroundColor: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.2)',
          color: '#fde68a',
        },
        standardInfo: {
          backgroundColor: 'rgba(99,102,241,0.1)',
          border: '1px solid rgba(99,102,241,0.2)',
          color: '#a5b4fc',
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderColor: '#27272a',
          color: '#71717a',
          '&.Mui-selected': {
            backgroundColor: 'rgba(99,102,241,0.15)',
            color: '#818cf8',
            borderColor: '#6366f1',
          },
        },
      },
    },
  },
});
