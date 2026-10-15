import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CatalogLayout from '../components/CatalogLayout.jsx';
import CheckoutForm, { addressFields, validateShipping } from '../components/CheckoutForm.jsx';
import OrderSummary from '../components/OrderSummary.jsx';
import { useCart } from '../context/CartContext.jsx';
import { ordersApi } from '../services/api.js';
import { loadRazorpay } from '../services/razorpay.js';
import { money } from '../components/ProductCard.jsx';

export default function Checkout() {
  const cart = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState(Object.fromEntries(addressFields.map(([name]) => [name, ''])));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('idle');
  const [verification, setVerification] = useState(null);
  const [serverAmount, setServerAmount] = useState(null);
  const locked = useRef(false);
  useEffect(() => { cart.refreshCart(); }, [cart.refreshCart]);
  useEffect(() => { if (cart.status === 'guest') navigate('/login', { replace: true, state: { returnTo: '/checkout' } }); }, [cart.status, navigate]);
  const busy = phase !== 'idle';
  const stockIssue = cart.unavailableProductIds.length > 0 || cart.cartItems.some(item => item.quantity > item.product.stock);
  async function verify(payload) {
    setPhase('verifying'); setError('');
    try {
      const result = await ordersApi('/verify-payment', { method: 'POST', body: payload });
      await cart.refreshCart({ quiet: true });
      navigate(`/order-success/${result.order._id}`, { replace: true });
    } catch (error) {
      if (error.status === 401) navigate('/login', { state: { returnTo: `/orders/${payload.shopKartOrderId}` } });
      else setError(`${error.message} Payment has not been confirmed here. Retry verification; do not pay again.`);
    } finally { locked.current = false; setPhase('idle'); }
  }
  async function submit(event) {
    event.preventDefault();
    if (locked.current) return;
    const next = validateShipping(form); setErrors(next); setError('');
    if (Object.keys(next).length) return;
    locked.current = true; setPhase('preparing');
    try {
      await loadRazorpay();
      const data = await ordersApi('/create-payment-order', { method: 'POST', body: { shippingAddress: form } });
      setServerAmount(data.amount / 100);
      let responded = false;
      const payment = new window.Razorpay({
        key: data.key, amount: data.amount, currency: data.currency, order_id: data.razorpayOrderId,
        name: 'ShopKart', description: 'ShopKart Test Mode order',
        prefill: { name: form.fullName.trim(), contact: form.phone.trim() },
        theme: { color: '#234936' },
        handler: response => {
          responded = true;
          const payload = { shopKartOrderId: data.shopKartOrderId, razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature };
          setVerification(payload); verify(payload);
        },
        modal: { ondismiss: () => {
          if (!responded) { setError('Payment cancelled. Your cart is unchanged.'); setPhase('idle'); locked.current = false; }
        } },
      });
      payment.on('payment.failed', () => { setError('Payment failed. Your cart has not been cleared. You can retry in Razorpay or close the payment window.'); });
      setPhase('paying'); payment.open();
    } catch (error) {
      setPhase('idle'); locked.current = false;
      if (error.status === 401) navigate('/login', { state: { returnTo: '/checkout' } });
      else setError(error.message);
    }
  }
  return <CatalogLayout><p className="breadcrumb">SHOPKART <span>/</span> CHECKOUT</p><section className="checkout-heading"><span className="section-label">THE FINAL LITTLE DETAILS</span><h1>Almost <em>yours.</em></h1><p>Your details. Your good finds. One last look.</p></section>
    {cart.loading || cart.status === 'guest' ? <section className="catalog-state" role="status"><span className="spinner" /><p>Loading checkout...</p></section> : cart.status === 'error' ? <section className="catalog-state"><p role="alert">Unable to load checkout. {cart.error}</p><button className="button-outline" onClick={() => cart.refreshCart()}>Try Again</button></section> : !cart.cartItems.length && !cart.unavailableProductIds.length ? <section className="catalog-state"><h2>Your cart is empty</h2><p>Add something you love before checking out.</p><Link to="/products" className="button-outline">Start Shopping</Link></section> : <form className="checkout-layout" onSubmit={submit} noValidate aria-label="Checkout" aria-busy={busy}><CheckoutForm form={form} setForm={setForm} errors={errors} setErrors={setErrors} busy={busy || !!verification} /><OrderSummary items={cart.cartItems} total={serverAmount ?? cart.subtotal}>
      {stockIssue && <p className="notice error" role="alert">Some products are unavailable or exceed stock. <Link to="/cart">Review your cart</Link>.</p>}
      {error && <p className="notice error" role="alert">{error}</p>}
      {verification ? <button type="button" className="button-primary" disabled={busy} onClick={() => { if (!locked.current) { locked.current = true; verify(verification); } }}>{busy ? 'Verifying payment…' : 'Retry payment verification'}</button> : <button className="button-primary" disabled={busy || stockIssue || Object.values(cart.pending).some(Boolean)}>{phase === 'preparing' ? 'Preparing secure payment…' : phase === 'paying' ? 'Complete payment in Razorpay…' : 'Pay with Razorpay (Test)'} <span aria-hidden="true">→</span></button>}
      {serverAmount !== null && <p className="summary-note">Server-confirmed payment total: {money(serverAmount)}. The Razorpay window uses this amount.</p>}
      <p className="checkout-security">◇ Your cart is kept until payment is verified.</p><Link className="back-link" to="/cart">← Back to cart</Link>
    </OrderSummary></form>}
  </CatalogLayout>;
}
