import { createContext, useContext } from 'react';
import type { Theme } from '@mui/material/styles';

export type Mode = 'light' | 'dark';

export interface ThemeContextValue {
  mode: Mode;
  toggleMode: () => void;
  theme: Theme;
}

export const ThemeModeContext = createContext<ThemeContextValue | null>(null);

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useAppTheme must be used within AppThemeProvider');
  return ctx;
}