import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import Layout from '@/components/Layout';
import { AuthProvider } from '@/lib/AuthContext';
import { CartProvider } from '@/features/cart/cartContext';
import { fastSportMuiTheme } from '@/theme/muiTheme';

/**
 * Why: App shell that mounts the shared `AuthProvider` outside `CartProvider` so the cart can
 * read auth state from context.
 * @param props
 * @param props.Component - The active page component.
 * @param props.pageProps - Props for the active page.
 * @returns The wrapped app tree.
 * @example
 * // Invoked by Next.js, not called directly.
 */
function MyApp({ Component, pageProps }: AppProps) {
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
