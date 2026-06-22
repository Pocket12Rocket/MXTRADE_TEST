import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [storageKey, setStorageKey] = useState('');

  // Load cart whenever auth state changes so cart is tied to the logged-in user.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        setStorageKey('');
        setItems([]);
        setHydrated(true);
        return;
      }

      const nextStorageKey = `mxtrade_cart_${currentUser.uid}`;
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
    });

    return unsubscribe;
  }, []);

  // Persist cart to per-user localStorage on every change.
  useEffect(() => {
    if (!hydrated || !storageKey) {
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, hydrated, storageKey]);

  function addItem(product) {
    setItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
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
          sellerId: product.sellerId || '',
          sellerEmail: product.sellerEmail || '',
        },
      ];
    });
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
