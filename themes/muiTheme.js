import { createTheme } from '@mui/material/styles';
import { fastSportTokens } from './tokens';

/**
 * Why: Makes MUI controls feel native to Fast Sport from their first use, rather
 * than letting Material Design defaults dilute the established marketplace theme.
 * @type {import('@mui/material/styles').Theme}
 */
export const fastSportMuiTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: fastSportTokens.colors.accent,
      dark: fastSportTokens.colors.accentHover,
      contrastText: '#ffffff',
    },
    secondary: {
      main: fastSportTokens.colors.seller,
      dark: fastSportTokens.colors.sellerHover,
      contrastText: '#ffffff',
    },
    background: {
      default: fastSportTokens.colors.pageBackground,
      paper: fastSportTokens.colors.panelBackground,
    },
    text: {
      primary: fastSportTokens.colors.ink,
      secondary: fastSportTokens.colors.mutedInk,
    },
    divider: fastSportTokens.colors.border,
  },
  typography: {
    fontFamily: fastSportTokens.typography.fontFamily,
    button: {
      fontWeight: 700,
      letterSpacing: fastSportTokens.typography.labelTracking,
      textTransform: 'uppercase',
    },
  },
  shape: {
    borderRadius: fastSportTokens.shape.controlRadius,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: fastSportTokens.shape.pillRadius,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: fastSportTokens.shape.cardRadius,
        },
      },
    },
  },
});
