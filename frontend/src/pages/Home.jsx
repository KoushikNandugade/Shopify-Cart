import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { useCart } from '../context/CartContext.jsx';
import { api } from '../services/api.js';

export default function Home() {
  const { clearCart } = useCart();
  const [customer, setCustomer] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const controller = new AbortController();
    setCustomer(null); setError('');
    api('/me', { signal: controller.signal }).then(setCustomer).catch(error => {
      if (error.name === 'AbortError') return;
      if (error.status === 401) { clearCart(); navigate('/login', { replace: true }); }
      else setError(error.message);
    });
    return () => controller.abort();
  }, [navigate, attempt, clearCart]);
  // Revalidate on returning to the tab, including after logout in another tab.
  useEffect(() => {
    const revalidate = () => setAttempt(value => value + 1);
    window.addEventListener('focus', revalidate);
    return () => window.removeEventListener('focus', revalidate);
  }, []);
  async function logout() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api('/logout', { method: 'POST' }); clearCart({ signedOut: true });
      navigate('/login', { replace: true, state: { loggedOut: true } });
    } catch (error) {
      if (error.status === 401) { clearCart(); navigate('/login', { replace: true }); }
      else setError(error.message);
    } finally { setBusy(false); }
  }
  return <div className="site"><div className="announcement">Your everyday, elevated. <span aria-hidden="true">✦</span></div><Navbar customer={customer} onLogout={logout} busy={busy} />
    <main className="home-content">
      {!customer ? <section className="loading-panel" aria-live="polite">{error ? <><h1>Let’s try that again.</h1><p role="alert">{error}</p><button className="button-outline" onClick={() => setAttempt(value => value + 1)}>Retry</button></> : <><span className="spinner" /><p>Getting your corner ready…</p></>}</section> : <>
        <p className="breadcrumb">SHOPKART <span>/</span> MY ACCOUNT</p>
        <section className="welcome-banner"><div><span className="eyebrow">IT’S GOOD TO HAVE YOU HERE</span><h1>Welcome home,<br /><em>{customer.fullName.split(' ')[0]}.</em></h1><p>A little space that’s all yours. You’re right where you belong.</p></div><div className="welcome-symbol" aria-hidden="true">✳</div><span className="banner-label">THE GOOD THINGS START HERE →</span></section>
        {error && <div className="notice error" role="alert">{error}</div>}
        <section className="profile-section"><div className="profile-heading"><span className="section-label">A LITTLE ABOUT YOU</span><h2>Your account.</h2><p>Your details, all in one place.</p></div><div className="profile-card"><div className="profile-card-top"><div className="avatar" aria-hidden="true">{customer.fullName.split(/\s+/).slice(0, 2).map(part => part[0]).join('')}</div><div><h3>{customer.fullName}</h3><span className="member-badge"><span /> ShopKart member</span></div><span className="profile-mark" aria-hidden="true">→</span></div><dl><div><dt>FULL NAME</dt><dd>{customer.fullName}</dd></div><div><dt>EMAIL ADDRESS</dt><dd>{customer.email}</dd></div><div><dt>PHONE NUMBER</dt><dd>{customer.phone}</dd></div></dl><div className="profile-card-bottom"><span aria-hidden="true">◇</span> Only you can see your account details.</div></div></section>
        <aside className="coming-next"><span aria-hidden="true">✦</span><div><h3>Good things are on the way.</h3><p>Your account is ready. Discover thoughtfully chosen essentials in our new collection.</p></div><Link className="button-outline" to="/products">Explore products →</Link></aside>
      </>}
    </main><footer>© {new Date().getFullYear()} ShopKart <span>Small joys. Everyday.</span></footer></div>;
}
