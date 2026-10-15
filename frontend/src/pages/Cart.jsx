import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CatalogLayout from '../components/CatalogLayout.jsx';
import CartItem from '../components/CartItem.jsx';
import { money } from '../components/ProductCard.jsx';
import { useCart } from '../context/CartContext.jsx';

export default function Cart() {
  const cart = useCart();
  const navigate = useNavigate();
  useEffect(() => { cart.refreshCart(); }, [cart.refreshCart]);
  useEffect(() => { if (cart.status === 'guest') navigate('/login', { replace: true, state: { returnTo: '/cart' } }); }, [cart.status, navigate]);
  const busy = Object.values(cart.pending).some(Boolean);
  const stockIssue = cart.cartItems.some(item => item.quantity > item.product.stock) || cart.unavailableProductIds.length > 0;
  return <CatalogLayout><p className="breadcrumb">SHOPKART <span>/</span> YOUR EVERYDAY FINDS</p><section className="catalog-hero cart-hero"><div><span className="eyebrow">GOOD CHOICES. ALL TOGETHER.</span><h1>My <em>Cart.</em></h1><p>A few good things, ready for your next chapter.</p></div><span className="wishlist-heart" aria-hidden="true">⌑</span></section>
    {cart.status === 'loading' || cart.status === 'guest' ? <section className="catalog-state" role="status"><span className="spinner" /><p>Loading your cart...</p></section> : cart.status === 'error' ? <section className="catalog-state"><h2>A little pause in your plans.</h2><p role="alert">Unable to load your cart. {cart.error}</p><button className="button-outline" onClick={() => cart.refreshCart()}>Try Again</button></section> : cart.cartItems.length === 0 && cart.unavailableProductIds.length === 0 ? <section className="catalog-state"><h2>Your cart is empty</h2><p>Looks like you haven’t added anything yet.</p><Link className="button-outline" to="/products">Browse Products →</Link></section> : <div className="cart-layout"><section aria-label="Cart items"><div className="catalog-results-line"><h2>Your good finds.</h2><span>{cart.totalUnits} {cart.totalUnits === 1 ? 'item' : 'items'}</span></div>{cart.cartItems.map(item => <CartItem key={item.product._id} item={item} />)}{cart.unavailableProductIds.map(id => <div className="unavailable-cart-item" key={id}><p>This product is no longer available.</p><button className="button-outline" disabled={cart.pending[id]} onClick={() => cart.removeFromCart(id)}>Remove unavailable item</button>{cart.actionErrors[id] && <p role="alert">{cart.actionErrors[id]}</p>}</div>)}<Link className="back-link" to="/products">← Continue shopping</Link></section><aside className="order-summary"><span className="section-label">THE GOOD THINGS ADD UP</span><h2>Order Summary</h2><dl><div><dt>Items</dt><dd data-testid="cart-units">{cart.totalUnits}</dd></div><div><dt>Subtotal</dt><dd data-testid="cart-subtotal">{money(cart.subtotal)}</dd></div></dl><p className="summary-note">Test Mode checkout. No shipping or tax charges are added in this lab. Adding items does not reserve stock.</p>{stockIssue && <p className="wishlist-action-error" role="alert">Please resolve unavailable items or changed stock before checkout.</p>}<button className="button-primary" disabled={busy || stockIssue || !cart.totalUnits} onClick={() => navigate('/checkout')}>Proceed to Checkout <span aria-hidden="true">→</span></button><button className="summary-refresh" disabled={busy} onClick={() => cart.refreshCart()}>Refresh prices & stock</button></aside></div>}
  </CatalogLayout>;
}
