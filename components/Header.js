import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { signOut } from 'firebase/auth';
import { DIRT_BIKE_CATEGORIES } from '../lib/dirtBikeCategories';
import { useCart } from '../lib/cartContext';
import useAuth from '../lib/useAuth';
import { fetchPendingSubmissions } from '../lib/firestoreHelpers';
import CartDrawer from './CartDrawer';
import { auth } from '../lib/firebase';

const navItems = [
  { href: '/shop', label: 'Shop' },
  { href: '/seller/dashboard', label: 'Seller' },
  { href: '/admin/dashboard', label: 'Admin' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/faq', label: 'FAQ' },
];

const topCategoryTabs = ['MOTO'];

export default function Header() {
  const router = useRouter();
  const { totalItems } = useCart();
  const { user, profile } = useAuth();
  const [activeTopTab, setActiveTopTab] = useState('MOTO');
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

  useEffect(() => {
    if (!isAdminUser) {
      setPendingApprovalCount(0);
      return;
    }

    let isMounted = true;

    const loadPendingCount = async () => {
      try {
        const pending = await fetchPendingSubmissions();
        if (isMounted) {
          setPendingApprovalCount(pending.length);
        }
      } catch {
        if (isMounted) {
          setPendingApprovalCount(0);
        }
      }
    };

    loadPendingCount();
    const intervalId = setInterval(loadPendingCount, 30000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [isAdminUser]);

  const handleTopTabClick = (tab) => {
    setActiveTopTab(tab);
    setIsMegaMenuOpen(tab === 'MOTO' ? !isMegaMenuOpen : false);
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

      <div className="mx-auto flex max-w-[1650px] flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 md:gap-6">
          <Link href="/" className="min-w-0 md:justify-self-start" aria-label="Go to homepage">
            {brandImageError ? (
              <span className="text-xl font-semibold uppercase tracking-[0.12em] text-slate-900 sm:text-2xl">MXTrade</span>
            ) : (
              <img
                src={brandLogoSrc}
                alt="Fast Sports"
                onError={() => setBrandImageError(true)}
                className="h-12 w-auto object-contain sm:h-16 md:h-20"
              />
            )}
          </Link>

          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={handleSellClick}
              className="rounded-full bg-[#7a1f1f] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white hover:bg-[#641818]"
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
                  className="rounded-full bg-[#00CED1] p-2 text-white hover:bg-[#00C5CD]"
                  aria-label="Open profile menu"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
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

        <div className="flex items-center gap-2 md:hidden">
        <form onSubmit={handleSearchSubmit} className="flex min-w-0 flex-1 items-center gap-2">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search dirt bike parts, gear, and accessories"
            className="min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400"
          />
          <button
            type="submit"
            className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-slate-800"
          >
            Go
          </button>
        </form>
          {user ? (
            <Link href="/profile" className="rounded-full bg-[#00CED1] p-2 text-white hover:bg-[#00C5CD]" aria-label="Open profile">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </Link>
          ) : (
            <Link href="/login" className="rounded-full bg-[#00CED1] p-2 text-white hover:bg-[#00C5CD]" aria-label="Go to login">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </Link>
          )}
        </div>

        {isMobileMenuOpen ? (
          <div className="rounded-3xl border border-slate-300 bg-white p-4 shadow-sm md:hidden">
            <div className="grid gap-2">
              {headerNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
                >
                  <span className="relative inline-flex items-center">
                    {item.label}
                    {item.href === '/admin/dashboard' && pendingApprovalCount > 0 ? (
                      <span className="ml-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {pendingApprovalCount > 99 ? '99+' : pendingApprovalCount}
                      </span>
                    ) : null}
                  </span>
                </Link>
              ))}
              <Link
                href="/seller/submissions"
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
              >
                Seller Dashboard
              </Link>
              {user ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
                >
                  Log out
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {showMegaMenu ? (
      <div onMouseLeave={() => setIsMegaMenuOpen(false)}>
        <div className="border-b-2 border-[#00C5CD] bg-[#e2e5ea] px-3 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1650px] items-center gap-5 overflow-x-auto py-3">
            {topCategoryTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onMouseEnter={() => {
                  setActiveTopTab(tab);
                  setIsMegaMenuOpen(tab === 'MOTO');
                }}
                onClick={() => handleTopTabClick(tab)}
                className={`whitespace-nowrap border-b-[3px] pb-2 text-xs font-semibold uppercase tracking-[0.08em] transition ${
                  activeTopTab === tab
                    ? 'border-[#00C5CD] text-slate-900'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'MOTO' ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#00CED1] text-[10px] font-bold text-white">DB</span>
                    {tab}
                  </span>
                ) : (
                  tab
                )}
              </button>
            ))}
          </div>
        </div>

        {activeTopTab === 'MOTO' && isMegaMenuOpen ? (
          <div className="border-t border-slate-300 bg-[#eceff3] px-3 py-4 sm:px-6 lg:px-8">
            <div className="mx-auto grid max-w-[1650px] gap-5 md:grid-cols-3">
              <div>
                <Link href="/shop/catalog?category=Gear" className="inline-flex items-center gap-2 text-2xl font-semibold leading-none text-slate-900 hover:text-[#00C5CD] md:text-[31px]">
                  Moto Gear <span className="text-2xl">›</span>
                </Link>
                <div className="mt-2 h-px w-full bg-slate-300" />
                <div className="mt-3 grid gap-2">
                  {DIRT_BIKE_CATEGORIES.Gear.map((subcategory) => (
                    <Link
                      key={subcategory}
                      href={`/shop/catalog?category=Gear&sub=${encodeURIComponent(subcategory)}`}
                      className="text-base leading-tight text-slate-700 hover:text-[#00C5CD] md:text-[23px]"
                    >
                      {subcategory}
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <Link href="/shop/catalog?category=Parts" className="inline-flex items-center gap-2 text-2xl font-semibold leading-none text-slate-900 hover:text-[#00C5CD] md:text-[31px]">
                  Dirt Bike Parts <span className="text-2xl">›</span>
                </Link>
                <div className="mt-2 h-px w-full bg-slate-300" />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {DIRT_BIKE_CATEGORIES.Parts.map((subcategory) => (
                    <Link
                      key={subcategory}
                      href={`/shop/catalog?category=Parts&sub=${encodeURIComponent(subcategory)}`}
                      className="text-base leading-tight text-slate-700 hover:text-[#00C5CD] md:text-[23px]"
                    >
                      {subcategory}
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <Link href="/shop/catalog?category=Accessories" className="inline-flex items-center gap-2 text-2xl font-semibold leading-none text-slate-900 hover:text-[#00C5CD] md:text-[31px]">
                  Accessories <span className="text-2xl">›</span>
                </Link>
                <div className="mt-2 h-px w-full bg-slate-300" />
                <div className="mt-3 grid gap-2">
                  {DIRT_BIKE_CATEGORIES.Accessories.map((subcategory) => (
                    <Link
                      key={subcategory}
                      href={`/shop/catalog?category=Accessories&sub=${encodeURIComponent(subcategory)}`}
                      className="text-base leading-tight text-slate-700 hover:text-[#00C5CD] md:text-[23px]"
                    >
                      {subcategory}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      ) : null}

    </header>

    <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
