import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import type { Theme } from '@mui/material/styles';
import { ThemeModeContext } from './themeContext';
import type { Mode } from './themeContext';

function getInitialMode(): Mode {
  const stored = window.localStorage.getItem('meetflow-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function buildThemePalette(mode: Mode) {
  const isDark = mode === 'dark';
  return {
    mode,
    primary: {
      main: '#231D8C',
      light: '#2E26A6',
      dark: '#1A1568',
      contrastText: '#ffffff',
    },
    secondary: { main: '#0891b2' },
    background: isDark
      ? { default: '#0e1016', paper: '#171a24' }
      : { default: '#f7f7f8', paper: '#ffffff' },
    divider: isDark ? 'rgba(255,255,255,0.12)' : '#e4e4e7',
    text: isDark
      ? { primary: '#e4e4e7', secondary: '#8f8f98', disabled: '#6b6b72' }
      : { primary: '#3f3f46', secondary: '#71717a', disabled: '#a1a1aa' },
  };
}

function buildAppTheme(mode: Mode): Theme {
  return createTheme({
    palette: buildThemePalette(mode),
    typography: {
      fontFamily:
        '"Poppins", "Inter", "Google Sans", Roboto, system-ui, -apple-system, "Segoe UI", sans-serif',
      body1: { fontSize: 15, fontWeight: 500 },
      body2: { fontSize: 14, fontWeight: 500 },
      subtitle1: { fontSize: 16, fontWeight: 700 },
      subtitle2: { fontSize: 14, fontWeight: 700 },
      caption: { fontSize: 12, fontWeight: 500 },
      overline: { fontSize: 11, fontWeight: 700 },
      button: { textTransform: 'none', fontSize: 14, fontWeight: 700 },
      h3: { fontSize: 36, fontWeight: 900, letterSpacing: '-0.02em' },
      h4: { fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em' },
      h5: { fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em' },
      h6: { fontSize: 19, fontWeight: 800 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600 },
        },
      },
    },
  });
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(getInitialMode);

  useEffect(() => {
    window.localStorage.setItem('meetflow-theme', mode);
  }, [mode]);

  const theme = useMemo(() => buildAppTheme(mode), [mode]);

  const value = useMemo(
    () => ({
      mode,
      toggleMode: () => setMode((m) => (m === 'light' ? 'dark' : 'light')),
      theme,
    }),
    [mode, theme],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}