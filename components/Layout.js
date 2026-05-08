import Header from './Header';

export default function Layout({ children }) {
  const whatsappNumber = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '');
  const whatsappLink = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hi MXTrade, I need help with my order.')}`
    : 'https://wa.me/';

  return (
    <div className="min-h-screen bg-[#c4c9d1] text-slate-900">
      <Header />
      <main className="mx-auto max-w-[1650px] px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02] hover:bg-[#20ba58]"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.52 3.48A11.93 11.93 0 0012.01 0C5.38 0 0 5.38 0 12c0 2.11.55 4.17 1.59 6L0 24l6.18-1.62A11.96 11.96 0 0012.01 24C18.62 24 24 18.62 24 12c0-3.2-1.25-6.21-3.48-8.52zm-8.51 18.5a9.92 9.92 0 01-5.04-1.37l-.36-.21-3.67.96.98-3.58-.24-.37A9.92 9.92 0 012.01 12c0-5.51 4.49-10 10-10 2.67 0 5.18 1.04 7.07 2.93A9.94 9.94 0 0122.01 12c0 5.51-4.49 9.98-10 9.98zm5.48-7.48c-.3-.15-1.77-.87-2.04-.97-.27-.1-.46-.15-.66.15-.2.3-.76.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47a8.97 8.97 0 01-1.65-2.05c-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.66-1.58-.9-2.16-.24-.58-.48-.5-.66-.5h-.56c-.2 0-.52.07-.79.37-.27.3-1.03 1.01-1.03 2.47s1.05 2.87 1.2 3.07c.15.2 2.06 3.15 4.99 4.42.7.3 1.25.49 1.68.62.7.22 1.34.19 1.84.12.56-.08 1.77-.72 2.02-1.42.25-.7.25-1.31.17-1.42-.07-.12-.27-.2-.56-.35z" />
        </svg>
        WhatsApp
      </a>

      <footer className="border-t border-slate-300 bg-slate-900 py-8 text-center text-xs uppercase tracking-[0.1em] text-slate-300">
        © Fast Sport | Built by the community
      </footer>
    </div>
  );
}
