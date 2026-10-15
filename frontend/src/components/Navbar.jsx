import { Link, NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { wishlistApi } from '../services/api.js';
import { useCart } from '../context/CartContext.jsx';

export default function Navbar({ customer, onLogout, busy, wishlistCount }) {
  const cart = useCart();
  const [count, setCount] = useState(undefined);
  useEffect(() => {
    if (!customer || wishlistCount !== undefined) return;
    const controller = new AbortController();
    wishlistApi('', { signal: controller.signal }).then(data => setCount(data.count)).catch(() => setCount(undefined));
    return () => controller.abort();
  }, [customer, wishlistCount]);
  const visibleCount = wishlistCount === undefined ? count : wishlistCount;
  return <header className="navbar">
    <Link className="brand" to={customer ? '/home' : '/login'} aria-label="ShopKart home"><span className="brand-icon" aria-hidden="true">s</span>shopkart<span className="brand-dot">.</span></Link>
    <span className="nav-tagline">GOOD FINDS. GREAT DAYS.</span>
    <nav aria-label="Main navigation">
      <NavLink to="/products">Shop</NavLink>
      <NavLink to="/wishlist">Wishlist{customer && visibleCount != null ? ` (${visibleCount})` : ''}</NavLink>
      <NavLink to="/cart">Cart{cart.status === 'ready' ? ` (${cart.totalUnits})` : ''}</NavLink>
      {customer && <NavLink to="/orders">Orders</NavLink>}
      {customer && <NavLink to="/home">Account</NavLink>}
      {customer ? <><span className="nav-name">Hi, {customer.fullName.split(' ')[0]}</span><button className="button-outline" onClick={onLogout} disabled={busy}>{busy ? 'Logging out…' : 'Log out'} <span aria-hidden="true">→</span></button></> : <><NavLink to="/login">Log in</NavLink><NavLink className="nav-register" to="/register">Join ShopKart <span aria-hidden="true">→</span></NavLink></>}
    </nav>
  </header>;
}
