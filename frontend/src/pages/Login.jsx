import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import Field from '../components/Field.jsx';
import { useCart } from '../context/CartContext.jsx';
import { api } from '../services/api.js';

export default function Login() {
  const { clearCart, refreshCart } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const next = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true); setMessage('');
    try {
      await api('/login', { method: 'POST', body: { email, password } });
      clearCart();
      await refreshCart();
      const returnTo = location.state?.returnTo;
      navigate(typeof returnTo === 'string' && /^\/(wishlist|products|cart|checkout|orders|order-success)(\/|\?|$)/.test(returnTo) ? returnTo : '/home', { replace: true });
    } catch (error) { setMessage(error.status === 401 ? 'Invalid Credentials' : error.message); }
    finally { setBusy(false); }
  }
  return <AuthLayout>
    {location.state?.registered && <div className="notice success" role="status">Account created. Log in to make yourself at home.</div>}
    {location.state?.loggedOut && <div className="notice success" role="status">You’re logged out. See you again soon.</div>}
    <form noValidate onSubmit={submit} aria-label="Log in" aria-busy={busy}>
      {message && <div className="notice error" role="alert">{message}</div>}
      <Field label="Email address" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => { setEmail(e.target.value); setErrors(current => ({ ...current, email: '' })); setMessage(''); }} error={errors.email} required />
      <Field label="Password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e => { setPassword(e.target.value); setErrors(current => ({ ...current, password: '' })); setMessage(''); }} error={errors.password} required />
      <button className="button-primary" disabled={busy}>{busy ? 'Logging you in…' : 'Log in'} <span aria-hidden="true">→</span></button>
    </form><div className="form-divider"><span />NEW AROUND HERE?<span /></div><Link className="button-secondary" to="/register">Create an account <span aria-hidden="true">→</span></Link><p className="login-note">Your own little corner of ShopKart.</p>
  </AuthLayout>;
}
