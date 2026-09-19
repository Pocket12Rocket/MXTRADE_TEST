import { createContext, useContext, useEffect, useState } from 'react';
import { useAuthContext } from './AuthContext';

const CartContext = createContext(null);

/**
 * Why: Cart state is tied to the logged-in user's localStorage key, but the cart no
 * longer runs its own `onAuthStateChanged` listener (that was a second, redundant auth
 * listener alongside `useAuth`'s — see docs/TECH_DEBT.md ARCH-12). It now reads `user`/
 * `loading` from the shared `AuthProvider` context, which must be mounted above this
 * provider in `pages/_app.js`. Per-user localStorage persistence behaviour is unchanged.
 * @param {Object} props
 * @param {import('react').ReactNode} props.children - App subtree that can call `useCart()`.
 * @returns {JSX.Element} A context provider wrapping `children`.
 * @example
 * <AuthProvider><CartProvider>{children}</CartProvider></AuthProvider>
 */
export function CartProvider({ children }) {
  const { user, loading: authLoading } = useAuthContext();
  const [items, setItems] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [storageKey, setStorageKey] = useState('');

  // Load cart whenever shared auth state changes so cart is tied to the logged-in user.
  // Waits for the shared listener's first resolution (authLoading) before syncing, to
  // match the timing of the previous per-provider onAuthStateChanged listener.
  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setStorageKey('');
      setItems([]);
      setHydrated(true);
      return;
    }

    const nextStorageKey = `mxtrade_cart_${user.uid}`;
    setStorageKey(nextStorageKey);

    try {
      const stored = localStorage.getItem(nextStorageKey);
      if (stored) {
        setItems(JSON.parse(stored));
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    }

    setHydrated(true);
  }, [user, authLoading]);

  // Persist cart to per-user localStorage on every change.
  useEffect(() => {
    if (!hydrated || !storageKey) {
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, hydrated, storageKey]);

  function addItem(product) {
    const productStock = Number(product.quantity || 1);
    let added = false;

    setItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      const nextCartQty = existing ? existing.quantity + 1 : 1;

      // Prevent adding if cart quantity would exceed stock
      if (nextCartQty > productStock) {
        added = false;
        return prev; // Don't add, return unchanged
      }

      added = true;

      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                sellerId: item.sellerId || product.sellerId || '',
                sellerEmail: item.sellerEmail || product.sellerEmail || '',
              }
            : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: Number(product.price),
          primaryImage: product.primaryImage || null,
          quantity: 1,
          productStock: productStock,
          sellerId: product.sellerId || '',
          sellerEmail: product.sellerEmail || '',
        },
      ];
    });

    return added;
  }

  function removeItem(productId) {
    setItems((prev) => prev.filter((item) => item.id !== productId));
  }

  function updateQuantity(productId, quantity) {
    const clamped = Math.max(1, quantity);
    setItems((prev) =>
      prev.map((item) => (item.id === productId ? { ...item, quantity: clamped } : item))
    );
  }

  function clearCart() {
    setItems([]);
  }

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
