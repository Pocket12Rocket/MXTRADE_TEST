import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { signOut } from 'firebase/auth';
import { DIRT_BIKE_CATEGORIES } from '../lib/dirtBikeCategories';
import { useCart } from '../lib/cartContext';
import useAuth from '../lib/useAuth';
import { subscribeAdminBadgeCounts } from '../lib/firestoreHelpers';
import CartDrawer from './CartDrawer';
import CategoryTabs from './CategoryTabs';
import MobileNavigationDrawer from './MobileNavigationDrawer';
import { auth } from '../lib/firebase';

const navItems = [
  { href: '/shop', label: 'Shop' },
  { href: '/seller/dashboard', label: 'Seller' },
  { href: '/admin/dashboard', label: 'Admin' },
  { href: '/admin/sales', label: 'Sales' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/faq', label: 'FAQ' },
];

const topCategoryTabs = [
  { key: 'Gear', label: 'Gear' },
  { key: 'Parts', label: 'Parts' },
  { key: 'Accessories', label: 'Accessories' },
];

/**
 * Why: Keeps primary navigation, product discovery, selling, and cart access in
 * one consistent, responsive control bar so shoppers can act without losing
 * their place in the marketplace.
 * @returns {JSX.Element} The responsive site header and its cart drawer.
 * @example
 * <Header />
 */
export default function Header() {
  const router = useRouter();
  const { totalItems } = useCart();
  const { user, profile } = useAuth();
  const [activeTopTab, setActiveTopTab] = useState(null);
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [brandImageError, setBrandImageError] = useState(false);
  const isAdminUser = Boolean(user && profile?.role === 'admin');
  const isShopRoute = router.pathname === '/shop' || router.pathname.startsWith('/shop/');
  const isProductRoute = router.pathname === '/product/[id]';
  const showMegaMenu = !isShopRoute && !isProductRoute;
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const brandLogoSrc = process.env.NEXT_PUBLIC_BRAND_LOGO || '/images/Fast%20Sports%20main%20Logo.png';

  const headerNavItems = navItems.filter((item) => {
    if (item.href === '/seller/dashboard') {
      return false;
    }

    if (item.href === '/admin/dashboard') {
      return isAdminUser;
    }

    if (item.href === '/admin/sales') {
      return isAdminUser;
    }

    return true;
  });
  const shopNavItem = headerNavItems.find((item) => item.href === '/shop');
  const secondaryHeaderNavItems = headerNavItems.filter((item) => item.href !== '/shop');

  useEffect(() => {
    const queryValue = router.query.q;
    setSearchTerm(typeof queryValue === 'string' ? queryValue : '');
  }, [router.query.q]);

  useEffect(() => {
    if (!showMegaMenu) {
      setIsMegaMenuOpen(false);
    }
  }, [showMegaMenu]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsProfileMenuOpen(false);
  }, [router.asPath]);

  // Why: PERF-03 — the pending-approval badge used to poll every 30s (even in background tabs),
  // downloading full result sets just to count them. Now it holds a single pair of realtime
  // listeners (via subscribeAdminBadgeCounts), attached only while the signed-in user is an
  // admin and detached immediately on sign-out/unmount or when isAdminUser flips false.
  useEffect(() => {
    if (!isAdminUser) {
      setPendingApprovalCount(0);
      return undefined;
    }

    const unsubscribe = subscribeAdminBadgeCounts((count) => {
      setPendingApprovalCount(count);
    });

    return () => {
      unsubscribe();
    };
  }, [isAdminUser]);

  const handleTopTabClick = (tab) => {
    setActiveTopTab(tab);
    setIsMegaMenuOpen((currentValue) => activeTopTab === tab ? !currentValue : true);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();

    const trimmedSearch = searchTerm.trim();
    if (!trimmedSearch) {
      router.push('/shop');
      return;
    }

    router.push(`/shop/catalog?q=${encodeURIComponent(trimmedSearch)}`);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsProfileMenuOpen(false);
    router.push('/login');
  };

  const handleSellClick = () => {
    if (!user) {
      router.push('/login');
      return;
    }

    router.push('/seller/submissions');
  };

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-slate-300/80 bg-[#e5e7eb]/95 backdrop-blur">

      <div className="mx-auto flex max-w-[1500px] flex-col gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3 lg:px-8">
        <div className="flex min-w-0 items-center justify-between gap-2 md:gap-6">
          <Link href="/" className="min-w-0 md:justify-self-start" aria-label="Go to homepage">
            {brandImageError ? (
              <span className="text-xl font-semibold uppercase tracking-[0.12em] text-slate-900 sm:text-2xl">MXTrade</span>
            ) : (
              <img
                src={brandLogoSrc}
                alt="Fast Sports"
                onError={() => setBrandImageError(true)}
                className="h-9 max-w-[170px] w-auto object-contain sm:h-14 sm:max-w-none md:h-16"
              />
            )}
          </Link>

          <form onSubmit={handleSearchSubmit} className="flex min-w-0 flex-1 items-center gap-1 md:hidden">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search"
              className="h-8 min-w-0 w-full rounded-full border border-slate-300 bg-white px-3 text-xs text-slate-700 placeholder:text-slate-400"
            />
            <button
              type="submit"
              aria-label="Search"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="6.5" />
                <path strokeLinecap="round" d="m16 16 4.25 4.25" />
              </svg>
            </button>
          </form>

          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={handleSellClick}
              className="flex h-9 items-center rounded-full bg-[#7a1f1f] px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-white hover:bg-[#641818]"
            >
              Sell
            </button>
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative rounded-full border border-slate-300 p-2 text-slate-600 hover:border-[#00CED1] hover:text-[#00C5CD]"
              aria-label="Open cart"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
              {totalItems > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#00CED1] text-[9px] font-bold text-white">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((currentValue) => !currentValue)}
              className="rounded-full border border-slate-300 p-2 text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
              aria-label="Toggle mobile menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                )}
              </svg>
            </button>
          </div>

          <form onSubmit={handleSearchSubmit} className="hidden md:mx-6 md:flex md:w-full md:max-w-[680px] md:flex-1 md:items-center md:gap-1">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search dirt bike parts, gear, and accessories"
              className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-slate-800"
            >
              Go
            </button>
          </form>

          <nav className="hidden items-center gap-4 md:flex md:shrink-0">
            {shopNavItem ? (
              <Link
                href={shopNavItem.href}
                className="relative inline-flex items-center rounded-full bg-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white hover:bg-slate-800"
              >
                {shopNavItem.label}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={handleSellClick}
              className="rounded-full bg-[#7a1f1f] px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-white hover:bg-[#641818]"
            >
              Sell
            </button>
            {secondaryHeaderNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="relative inline-flex items-center text-xs font-semibold uppercase tracking-[0.1em] text-slate-600 hover:text-slate-900"
              >
                {item.label}
                {item.href === '/admin/dashboard' && pendingApprovalCount > 0 ? (
                  <span className="absolute -right-4 -top-2 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
                    {pendingApprovalCount > 99 ? '99+' : pendingApprovalCount}
                  </span>
                ) : null}
              </Link>
            ))}
            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen((currentValue) => !currentValue)}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mx-primary)] focus-visible:ring-offset-2 ${
                    profile?.photoURL
                      ? 'border-slate-300 bg-white hover:border-[var(--mx-primary)]'
                      : 'border-[var(--mx-tertiary)] bg-[var(--mx-primary)] text-white hover:bg-[var(--mx-tertiary)]'
                  }`}
                  aria-label="Open profile menu"
                >
                  {profile?.photoURL ? (
                    <img
                      src={profile.photoURL}
                      alt="Profile"
                      className="h-full w-full rounded-[11px] object-cover"
                    />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  )}
                </button>

                {isProfileMenuOpen ? (
                  <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                    <Link
                      href="/profile"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="block rounded-xl px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    >
                      Profile
                    </Link>
                    <Link
                      href="/profile/orders"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="block rounded-xl px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    >
                      Orders
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="block w-full rounded-xl px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    >
                      Log out
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <Link href="/login" className="rounded-full bg-[#00CED1] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#00C5CD]">
                Log in
              </Link>
            )}

            {/* Cart icon */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative rounded-full border border-slate-300 p-2 text-slate-600 hover:border-[#00CED1] hover:text-[#00C5CD]"
              aria-label="Open cart"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
              {totalItems > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#00CED1] text-[9px] font-bold text-white">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              ) : null}
            </button>
          </nav>
        </div>

      </div>

      {showMegaMenu ? (
      <div onMouseLeave={() => setIsMegaMenuOpen(false)}>
        <div className="border-b border-slate-300 bg-[#e2e5ea] px-3 sm:px-6 lg:px-8">
          <CategoryTabs
            tabs={topCategoryTabs}
            activeTab={activeTopTab}
            onTabHover={(tabKey) => {
              setActiveTopTab(tabKey);
              setIsMegaMenuOpen(true);
            }}
            onTabSelect={handleTopTabClick}
          />
        </div>

        {activeTopTab && isMegaMenuOpen ? (
          <div className="border-t border-slate-300 bg-[#eceff3] px-3 py-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[1650px]">
              <Link href={`/shop/catalog?category=${encodeURIComponent(activeTopTab)}`} className="inline-flex items-center gap-2 text-2xl font-semibold leading-none text-slate-900 hover:text-[#00C5CD] md:text-[31px]">
                {activeTopTab} <span className="text-2xl">›</span>
              </Link>
              <div className="mt-2 h-px w-full bg-slate-300" />
              <div className={`mt-3 grid gap-2 ${activeTopTab === 'Parts' ? 'sm:grid-cols-2 md:grid-cols-3' : 'sm:grid-cols-2 md:grid-cols-4'}`}>
                {DIRT_BIKE_CATEGORIES[activeTopTab].map((subcategory) => (
                  <Link
                    key={subcategory}
                    href={`/shop/catalog?category=${encodeURIComponent(activeTopTab)}&sub=${encodeURIComponent(subcategory)}`}
                    className="text-base leading-tight text-slate-700 hover:text-[#00C5CD] md:text-[21px]"
                  >
                    {subcategory}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
      ) : null}

    </header>

    <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    <MobileNavigationDrawer
      open={isMobileMenuOpen}
      onClose={() => setIsMobileMenuOpen(false)}
      items={headerNavItems}
      isSignedIn={Boolean(user)}
      pendingApprovalCount={pendingApprovalCount}
      onLogout={handleLogout}
    />
    </>
  );
}
