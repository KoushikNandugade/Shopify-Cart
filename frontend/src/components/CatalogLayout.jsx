import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import { useCart } from '../context/CartContext.jsx';
import { api } from '../services/api.js';

export default function CatalogLayout({ children, wishlistCount }) {
  const { clearCart } = useCart();
  const [customer, setCustomer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  useEffect(() => {
    const controller = new AbortController();
    api('/me', { signal: controller.signal }).then(setCustomer).catch(() => {});
    return () => controller.abort();
  }, []);
  async function logout() {
    setBusy(true); setError('');
    try { await api('/logout', { method: 'POST' }); clearCart({ signedOut: true }); navigate('/login', { replace: true, state: { loggedOut: true } }); }
    catch (error) { if (error.status === 401) { clearCart(); setCustomer(null); navigate('/login'); } else setError(error.message); }
    finally { setBusy(false); }
  }
  return <div className="site"><div className="announcement">Thoughtfully chosen. Made for your everyday. <span aria-hidden="true">✦</span></div><Navbar customer={customer} onLogout={logout} busy={busy} wishlistCount={wishlistCount} /><main className="catalog-content">{error && <div className="notice error" role="alert">{error}</div>}{children}</main><footer>© {new Date().getFullYear()} ShopKart <span>Small joys. Everyday.</span></footer></div>;
}
