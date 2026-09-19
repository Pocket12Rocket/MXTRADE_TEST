/**
 * Why: Keeps Fast Sport's visual decisions in one semantic vocabulary so Tailwind
 * layouts and MUI components can share the same brand treatment as screens are
 * modernized incrementally.
 * @type {{colors: Object, typography: Object, shape: Object, shadows: Object, spacing: Object}}
 */
export const fastSportTokens = {
  colors: {
    accent: '#00CED1',
    accentHover: '#00C5CD',
    accentSoft: '#40E0D0',
    seller: '#7a1f1f',
    sellerHover: '#641818',
    ink: '#0f172a',
    mutedInk: '#475569',
    pageBackground: '#c4c9d1',
    headerBackground: '#e5e7eb',
    panelBackground: '#ffffff',
    panelSubtle: '#f8fafc',
    border: '#cbd5e1',
  },
  typography: {
    fontFamily: '"SF Pro Text", "SF Pro Display", "San Francisco", -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple Color Emoji", "Segoe UI Emoji", sans-serif',
    labelTracking: '0.08em',
  },
  shape: {
    cardRadius: 24,
    controlRadius: 12,
    pillRadius: 999,
  },
  shadows: {
    panel: '0 1px 2px rgb(15 23 42 / 0.08)',
  },
  spacing: {
    pageGutter: 24,
  },
};
