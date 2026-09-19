import Header from './Header';
import { useRouter } from 'next/router';
import useAuth from '../lib/useAuth';

const SHOW_WHATSAPP_BUTTON = false;
const FOOTER_LINK_ROUTES = {
  Gear: '/shop/catalog?category=Gear',
  'Bike Parts': '/shop/catalog?category=Parts',
  Accessories: '/shop/catalog?category=Accessories',
  'About Us': '/about',
  'How it Works': '/about#how-it-works',
  'Contact Us': '/contact',
};
const FOOTER_COLUMNS = [
  {
    title: 'Shop',
    links: ['Gear', 'Bike Parts', 'Accessories'],
  },
  {
    title: 'Sell',
    links: ['List an Item', 'How it Works', 'Getting Paid', 'Seller Obligations', 'Shipping'],
  },
  {
    title: 'Legal',
    links: ['Terms & Conditions', 'Privacy Policy', 'Refund & Return Policy', 'Buyer & Seller Protection'],
  },
  {
    title: 'Help',
    links: ['About Us', 'Contact Us'],
  },
];

/**
 * Why: Provides the shared marketplace frame so navigation, responsive page
 * gutters, support access, and legal navigation stay consistent across routes.
 * @param {Object} props - Layout content.
 * @param {React.ReactNode} props.children - Active page rendered inside the shell.
 * @returns {JSX.Element} The full application frame around the active page.
 * @example
 * <Layout><CatalogPage /></Layout>
 */
export default function Layout({ children }) {
  const router = useRouter();
  const { user } = useAuth();
  const whatsappNumber = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '');
  const whatsappLink = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hi MXTrade, I need help with my order.')}`
    : 'https://wa.me/';

  const handleFooterLinkClick = (event, link) => {
    if (link === 'List an Item') {
      event.preventDefault();
      router.push(user ? '/seller/submissions' : '/login');
      return;
    }

    if (!FOOTER_LINK_ROUTES[link]) {
      event.preventDefault();
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#c4c9d1] text-slate-900">
      <Header />
      <main className="mx-auto w-full max-w-[1650px] flex-1 px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>

      {SHOW_WHATSAPP_BUTTON ? (
      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
        className="fixed bottom-3 right-3 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-[1.02] hover:bg-[#20ba58] sm:bottom-5 sm:right-5 sm:h-auto sm:w-auto sm:gap-2 sm:px-4 sm:py-3 sm:text-sm sm:font-semibold"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="sm:h-[18px] sm:w-[18px]">
          <path d="M20.52 3.48A11.93 11.93 0 0012.01 0C5.38 0 0 5.38 0 12c0 2.11.55 4.17 1.59 6L0 24l6.18-1.62A11.96 11.96 0 0012.01 24C18.62 24 24 18.62 24 12c0-3.2-1.25-6.21-3.48-8.52zm-8.51 18.5a9.92 9.92 0 01-5.04-1.37l-.36-.21-3.67.96.98-3.58-.24-.37A9.92 9.92 0 012.01 12c0-5.51 4.49-10 10-10 2.67 0 5.18 1.04 7.07 2.93A9.94 9.94 0 0122.01 12c0 5.51-4.49 9.98-10 9.98zm5.48-7.48c-.3-.15-1.77-.87-2.04-.97-.27-.1-.46-.15-.66.15-.2.3-.76.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47a8.97 8.97 0 01-1.65-2.05c-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.66-1.58-.9-2.16-.24-.58-.48-.5-.66-.5h-.56c-.2 0-.52.07-.79.37-.27.3-1.03 1.01-1.03 2.47s1.05 2.87 1.2 3.07c.15.2 2.06 3.15 4.99 4.42.7.3 1.25.49 1.68.62.7.22 1.34.19 1.84.12.56-.08 1.77-.72 2.02-1.42.25-.7.25-1.31.17-1.42-.07-.12-.27-.2-.56-.35z" />
        </svg>
        <span className="hidden sm:inline">WhatsApp</span>
      </a>
      ) : null}

      <footer className="border-t border-[#18304f] bg-[#0b1f3a] text-slate-100">
        <div className="mx-auto grid max-w-[1500px] grid-cols-2 gap-x-5 gap-y-4 px-5 py-4 sm:px-10 sm:py-5 md:grid-cols-4 lg:px-14">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-white">{column.title}</h2>
              <ul className="mt-2 space-y-1.5">
                {column.links.map((link) => (
                  <li key={link}>
                    <a
                      href={link === 'List an Item' ? '/login' : FOOTER_LINK_ROUTES[link] || '#'}
                      onClick={(event) => handleFooterLinkClick(event, link)}
                      className="text-xs text-slate-300 transition hover:text-[#40E0D0] hover:underline"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 px-6 py-2 text-center text-[10px] uppercase tracking-[0.08em] text-slate-400">
          © Fast Sport | Built by the community
        </div>
      </footer>
    </div>
  );
}
