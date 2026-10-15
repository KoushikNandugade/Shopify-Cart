import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import Field from '../components/Field.jsx';
import { api } from '../services/api.js';

export default function Register() {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  function change(event) {
    const { name, value } = event.target;
    setForm(current => ({ ...current, [name]: value }));
    setErrors(current => ({ ...current, [name]: '' }));
    setMessage('');
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const next = {};
    if (!form.fullName.trim()) next.fullName = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (!form.phone.trim()) next.phone = 'Enter your phone number.';
    if (form.password.length < 6 || new TextEncoder().encode(form.password).length > 72) next.password = 'Use at least 6 characters and at most 72 UTF-8 bytes.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true); setMessage('');
    try {
      await api('/register', { method: 'POST', body: form });
      navigate('/login', { replace: true, state: { registered: true, email: form.email.trim() } });
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <AuthLayout register><form noValidate onSubmit={submit} aria-label="Create account" aria-busy={busy}>
    {message && <div className="notice error" role="alert">{message}</div>}
    <Field label="Full name" name="fullName" autoComplete="name" placeholder="John Doe" value={form.fullName} onChange={change} error={errors.fullName} required />
    <Field label="Email address" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={change} error={errors.email} required />
    <Field label="Phone number" name="phone" type="tel" autoComplete="tel" placeholder="9876543210" value={form.phone} onChange={change} error={errors.phone} required />
    <Field label="Password" name="password" type="password" autoComplete="new-password" placeholder="Create a password" value={form.password} onChange={change} error={errors.password} required />
    <p className="input-hint">At least 6 characters. Make it something only you know.</p>
    <button className="button-primary" disabled={busy}>{busy ? 'Creating your account…' : 'Create account'} <span aria-hidden="true">→</span></button>
  </form><p className="form-switch">Already part of ShopKart? <Link to="/login">Log in</Link></p></AuthLayout>;
}
