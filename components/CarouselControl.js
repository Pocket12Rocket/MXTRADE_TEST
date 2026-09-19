import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

/**
 * Why: Standardizes carousel navigation across the storefront so arrows retain
 * the same size, contrast, disabled behavior, and accessible focus state on
 * light product surfaces and dark promotional panels.
 * @param {Object} props - Carousel-control configuration.
 * @param {'previous'|'next'} props.direction - Direction in which the carousel moves.
 * @param {string} props.label - Accessible description of the action.
 * @param {boolean} props.disabled - Whether movement in this direction is unavailable.
 * @param {() => void} props.onClick - Action that advances or rewinds the carousel.
 * @param {'light'|'dark'} [props.tone='light'] - Surface contrast variant.
 * @returns {JSX.Element} A token-styled MUI icon button for carousel navigation.
 * @example
 * <CarouselControl direction="next" label="Show next products" onClick={showNext} />
 */
export default function CarouselControl({ direction, label, disabled, onClick, tone = 'light' }) {
  const isDark = tone === 'dark';

  return (
    <IconButton
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      size="small"
      sx={{
        width: 36,
        height: 36,
        flexShrink: 0,
        borderRadius: '10px',
        border: '1px solid',
        borderColor: isDark ? 'rgb(255 255 255 / 0.24)' : 'var(--mx-tertiary)',
        backgroundColor: isDark ? 'rgb(255 255 255 / 0.06)' : 'rgb(255 255 255 / 0.72)',
        color: isDark ? '#ffffff' : '#334155',
        '&:hover': {
          backgroundColor: isDark ? 'rgb(255 255 255 / 0.14)' : 'var(--mx-primary)',
          borderColor: 'var(--mx-primary)',
          color: isDark ? '#ffffff' : '#ffffff',
        },
        '&.Mui-disabled': {
          borderColor: isDark ? 'rgb(255 255 255 / 0.12)' : '#cbd5e1',
          backgroundColor: isDark ? 'transparent' : 'rgb(255 255 255 / 0.32)',
          color: isDark ? 'rgb(255 255 255 / 0.35)' : '#94a3b8',
        },
      }}
    >
      {direction === 'previous' ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
    </IconButton>
  );
}
