import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import Layout from '@/components/Layout';
import { AuthProvider } from '@/lib/AuthContext';
import { makeQueryClient } from '@/lib/queryClient';
import { CartProvider } from '@/features/cart/cartContext';
import { fastSportMuiTheme } from '@/theme/muiTheme';

/**
 * Why: App shell that mounts the TanStack Query client and the shared `AuthProvider` outside `CartProvider` so the cart can
 * read auth state from context.
 * @param props
 * @param props.Component - The active page component.
 * @param props.pageProps - Props for the active page.
 * @returns The wrapped app tree.
 * @example
 * // Invoked by Next.js, not called directly.
 */
function MyApp({ Component, pageProps }: AppProps) {
  // Why: one client per browser session; state keeps it stable across re-renders.
  const [queryClient] = useState(() => makeQueryClient());
  return (
    <ThemeProvider theme={fastSportMuiTheme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CartProvider>
            <Layout>
              <Component {...pageProps} />
            </Layout>
          </CartProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default MyApp;
