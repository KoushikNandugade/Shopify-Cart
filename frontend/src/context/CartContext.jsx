import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { cartApi } from '../services/api.js';

const CartContext = createContext(null);
export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [unavailableProductIds, setUnavailable] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [pending, setPending] = useState({});
  const [actionErrors, setActionErrors] = useState({});
  const queue = useRef(Promise.resolve());
  const locks = useRef(new Set());
  const epoch = useRef(0);
  const reading = useRef(null);
  const enqueue = useCallback(task => {
    const next = queue.current.then(task, task);
    queue.current = next.catch(() => {});
    return next;
  }, []);
  const clearCart = useCallback(({ signedOut = false } = {}) => {
    epoch.current++;
    locks.current.clear();
    reading.current = null;
    setCartItems([]); setUnavailable([]); setStatus(signedOut ? 'signedOut' : 'guest');
    setError(''); setPending({}); setActionErrors({});
  }, []);
  const accept = useCallback(data => {
    setCartItems(data.cart); setUnavailable(data.unavailableProductIds ?? []);
    setStatus('ready'); setError('');
  }, []);
  const refreshCart = useCallback(({ quiet = false } = {}) => {
    const requestEpoch = epoch.current;
    if (reading.current?.epoch === requestEpoch) return reading.current.promise;
    if (!quiet) setStatus('loading');
    const promise = enqueue(async () => {
      if (requestEpoch !== epoch.current) return false;
      try {
        const data = await cartApi();
        if (requestEpoch !== epoch.current) return false;
        accept(data); return true;
      } catch (error) {
        if (requestEpoch !== epoch.current) return false;
        if (error.status === 401) clearCart();
        else { setStatus('error'); setError(error.message); }
        return false;
      }
    });
    reading.current = { epoch: requestEpoch, promise };
    promise.finally(() => { if (reading.current?.promise === promise) reading.current = null; });
    return promise;
  }, [enqueue, accept, clearCart]);
  useEffect(() => { refreshCart(); }, [refreshCart]);
  useEffect(() => {
    const refresh = () => { if (!locks.current.size) refreshCart({ quiet: true }); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refreshCart]);
  async function mutate(productId, method, quantity) {
    if (locks.current.has(productId)) return { ok: false, status: 0 };
    const requestEpoch = epoch.current;
    locks.current.add(productId);
    setPending(current => ({ ...current, [productId]: true }));
    setActionErrors(current => ({ ...current, [productId]: '' }));
    return enqueue(async () => {
      try {
        if (requestEpoch !== epoch.current) return { ok: false, status: 401 };
        const data = await cartApi(`/${productId}`, { method, ...(method === 'PATCH' && { body: { quantity } }) });
        if (requestEpoch !== epoch.current) return { ok: false, status: 401 };
        accept(data); return { ok: true };
      } catch (error) {
        if (requestEpoch !== epoch.current) return { ok: false, status: 401 };
        if (error.status === 401) clearCart();
        else {
          // Reconcile changed stock/price or another tab's cart after a rejected write.
          try { const current = await cartApi(); if (requestEpoch === epoch.current) accept(current); }
          catch (readError) {
            if (requestEpoch === epoch.current && readError.status === 401) clearCart();
          }
          if (requestEpoch === epoch.current) setActionErrors(current => ({ ...current, [productId]: error.message + ' Please try again.' }));
        }
        return { ok: false, status: error.status };
      } finally {
        if (requestEpoch === epoch.current) {
          locks.current.delete(productId);
          setPending(current => ({ ...current, [productId]: false }));
        }
      }
    });
  }
  const totalUnits = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  // Work in paise for normal currency precision, rather than accumulating decimals.
  const subtotal = cartItems.reduce((sum, item) => sum + Math.round(item.product.price * 100) * item.quantity, 0) / 100;
  return <CartContext.Provider value={{ cartItems, unavailableProductIds, status, loading: status === 'loading', error, pending, actionErrors, totalUnits, subtotal, refreshCart, clearCart, addToCart: id => mutate(id, 'POST'), updateQuantity: (id, quantity) => mutate(id, 'PATCH', quantity), removeFromCart: id => mutate(id, 'DELETE') }}>{children}</CartContext.Provider>;
}
export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
}
