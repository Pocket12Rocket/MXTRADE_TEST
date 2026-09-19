import '../styles/globals.css';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import Layout from '../components/Layout';
import { AuthProvider } from '../lib/AuthContext';
import { CartProvider } from '../lib/cartContext';
import { fastSportMuiTheme } from '../themes/muiTheme';

/**
 * Why: App shell — mounts the shared `AuthProvider` (one `onAuthStateChanged` listener,
 * one `users/{uid}` read per session) outside `CartProvider` so the cart can consume
 * auth state from context instead of running its own listener (see
 * `lib/cartContext.js` and docs/TECH_DEBT.md ARCH-12).
 * @param {Object} props
 * @param {React.ComponentType} props.Component - The active page component.
 * @param {Object} props.pageProps - Props for the active page.
 * @returns {JSX.Element} The wrapped app tree.
 * @example
 * // Invoked by Next.js, not called directly.
 */
function MyApp({ Component, pageProps }) {
  return (
    <ThemeProvider theme={fastSportMuiTheme}>
      <CssBaseline />
      <AuthProvider>
        <CartProvider>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default MyApp;
