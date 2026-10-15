import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { wishlistApi } from '../services/api.js';

// Each page owns its data. MongoDB remains the source of truth between pages.
export default function useWishlist({ protectedPage = false } = {}) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [pending, setPending] = useState({});
  const [actionErrors, setActionErrors] = useState({});
  const locks = useRef(new Set());
  const navigate = useNavigate();
  const location = useLocation();
  const login = useCallback(() => navigate('/login', { state: { returnTo: location.pathname + location.search }, replace: protectedPage }), [navigate, location.pathname, location.search, protectedPage]);
  const load = useCallback(async (signal, showLoading = true) => {
    if (showLoading) setStatus('loading');
    setError('');
    try {
      const data = await wishlistApi('', { signal });
      setItems(data.wishlist); setStatus('ready');
      return true;
    } catch (error) {
      if (error.name === 'AbortError') return false;
      if (error.status === 401) {
        setItems([]); setStatus('guest');
        if (protectedPage) login();
      } else { setStatus('error'); setError(error.message); }
      return false;
    }
  }, [protectedPage, login]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  useEffect(() => {
    const refresh = () => { if (!locks.current.size) load(undefined, false); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [load]);
  async function change(productId, remove = false) {
    if (locks.current.has(productId)) return;
    if (status === 'guest') { login(); return; }
    locks.current.add(productId);
    setPending(current => ({ ...current, [productId]: true }));
    setActionErrors(current => ({ ...current, [productId]: '' }));
    try {
      await wishlistApi(`/${productId}`, { method: remove ? 'DELETE' : 'POST' });
      // Reflect a confirmed write immediately, then fetch canonical items/count.
      if (remove) setItems(current => current.filter(item => item._id !== productId));
      await load(undefined, false);
    } catch (error) {
      if (error.status === 401) { setItems([]); setStatus('guest'); login(); }
      else if ((!remove && error.status === 409) || (remove && error.status === 404)) {
        // Another tab may already have completed this action.
        await load(undefined, false);
      } else setActionErrors(current => ({ ...current, [productId]: `Unable to ${remove ? 'remove' : 'save'} product. ${error.message} Please try again.` }));
    } finally {
      locks.current.delete(productId);
      setPending(current => ({ ...current, [productId]: false }));
    }
  }
  return { items, status, error, pending, actionErrors, change, reload: () => load(), isSaved: id => items.some(item => item._id === id), count: status === 'ready' ? items.length : null };
}
