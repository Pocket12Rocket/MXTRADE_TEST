import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuthContext } from '@/lib/AuthContext';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  primaryImage: string | null;
  quantity: number;
  productStock: number;
  sellerId: string;
  sellerEmail: string;
}

/** The product fields `addItem` reads; a client product record satisfies it. */
export interface CartProductInput {
  id: string;
  name: string;
  price: number | string;
  quantity?: number | null;
  primaryThumbnail?: string | null;
  primaryImage?: string | null;
  sellerId?: string;
  sellerEmail?: string;
}

export interface CartContextValue {
  items: CartItem[];
  addItem: (product: CartProductInput) => boolean;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextValue | null>(null);

/**
 * Why: Cart state is tied to the logged-in user's localStorage key. It reads `user`/`loading`
 * from the shared `AuthProvider`, which must be mounted above it in `pages/_app.js`.
 * @param props.children - App subtree that can call `useCart()`.
 * @returns A context provider wrapping `children`.
 * @example
 * <AuthProvider><CartProvider>{children}</CartProvider></AuthProvider>
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuthContext();
  const [items, setItems] = useState<CartItem[]>([]);
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

    const nextStorageKey = `mxtrade_cart_${user.id}`;
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

  /**
   * Why: Adds one of a product to the cart, refusing when that would exceed its stock.
   * @param product - The product to add.
   * @returns True when the product was added.
   */
  function addItem(product: CartProductInput): boolean {
    // Why: `?? 0`, not `|| 1`: a sold-out product (quantity 0) must not be addable.
    const productStock = Number(product.quantity ?? 0);
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
            : item,
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: Number(product.price),
          primaryImage: product.primaryThumbnail || product.primaryImage || null,
          quantity: 1,
          productStock: productStock,
          sellerId: product.sellerId || '',
          sellerEmail: product.sellerEmail || '',
        },
      ];
    });

    return added;
  }

  /**
   * Why: Removes a product from the cart.
   * @param productId - ID of the product to remove.
   */
  function removeItem(productId: string) {
    setItems((prev) => prev.filter((item) => item.id !== productId));
  }

  /**
   * Why: Sets the quantity of a cart line.
   * @param productId - ID of the product to change.
   * @param quantity - The new quantity.
   */
  function updateQuantity(productId: string, quantity: number) {
    const clamped = Math.max(1, quantity);
    setItems((prev) =>
      prev.map((item) => (item.id === productId ? { ...item, quantity: clamped } : item)),
    );
  }

  /**
   * Why: Empties the cart, for example after a completed checkout.
   */
  function clearCart() {
    setItems([]);
  }

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice }}
    >
      {children}
    </CartContext.Provider>
  );
}

/**
 * Why: Reads the cart from context so any component can show or change it.
 * @returns The cart items and the functions that change them.
 * @example
 * const { items, addItem } = useCart();
 */
export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
