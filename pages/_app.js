import '../styles/globals.css';
import Layout from '../components/Layout';
import { CartProvider } from '../lib/cartContext';

function MyApp({ Component, pageProps }) {
  return (
    <CartProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </CartProvider>
  );
}

export default MyApp;
