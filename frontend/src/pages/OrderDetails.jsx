import { Link, useParams } from 'react-router-dom';
import CatalogLayout from '../components/CatalogLayout.jsx';
import { money, ProductImage } from '../components/ProductCard.jsx';
import { orderDate } from '../components/OrderCard.jsx';
import useOrders from '../hooks/useOrders.js';
import { useCart } from '../context/CartContext.jsx';

export default function OrderDetails({ confirmation = false }) {
  const { id } = useParams();
  const state = useOrders(`/${encodeURIComponent(id)}`);
  const cart = useCart();
  const order = state.data?.order;
  return <CatalogLayout><Link className="back-link" to="/orders">← My Orders</Link>{state.loading ? <section className="catalog-state" role="status"><span className="spinner" /><p>Loading order...</p></section> : state.error ? <section className="catalog-state"><h1>{[400, 404].includes(state.status) ? 'Order not found.' : 'Unable to load order.'}</h1><p role="alert">{state.error}</p>{![400, 404].includes(state.status) && <button className="button-outline" onClick={state.retry}>Try Again</button>}</section> : <>
    <section className="order-confirmation"><span className="section-label">{order.paymentStatus === 'PAID' ? 'THANK YOU FOR SHOPPING WITH US' : 'YOUR PAYMENT IS NOT CONFIRMED'}</span><h1>{order.paymentStatus === 'PAID' && confirmation ? 'Order Placed Successfully' : 'Your order.'}</h1><p>Order ID: <span className="order-id">{order._id}</span></p><div className="order-confirmation-meta"><span>{orderDate(order.createdAt)}</span><span className={`order-badge ${order.paymentStatus === 'PAID' ? 'paid' : ''}`}>{order.status.replaceAll('_', ' ')}</span><span>Payment: {order.paymentStatus}</span></div>{order.paymentStatus === 'PAID' ? <p>Your order has been saved successfully. This was a Test Mode payment.</p> : <p>This order has not been placed. If payment was debited in Test Mode but confirmation failed, return to the open checkout to retry verification. Do not pay again.</p>}</section>
    <div className="order-detail-layout"><section className="order-detail-items"><h2>Your good finds.</h2>{order.items.map(item => <article key={item.product} className="order-snapshot-item"><ProductImage product={{ name: item.name, image: item.image || '/product-images/placeholder.svg' }} /><div><h3>{item.name}</h3><p>{money(item.price)} × {item.quantity}</p></div><strong>{money(Math.round(item.price * 100) * item.quantity / 100)}</strong></article>)}<div className="order-total"><span>Total paid{order.paymentStatus !== 'PAID' ? ' (pending)' : ''}</span><strong>{money(order.totalAmount)}</strong></div></section><aside className="shipping-address"><span className="section-label">DELIVER TO</span><h2>{order.shippingAddress.fullName}</h2><p>{order.shippingAddress.addressLine1}<br />{order.shippingAddress.city}, {order.shippingAddress.state}<br />{order.shippingAddress.pincode}<br />{order.shippingAddress.phone}</p></aside></div>
    {cart.status === 'error' && <div className="notice error">Payment status is saved, but the cart could not refresh. <button className="button-outline" onClick={() => cart.refreshCart()}>Refresh cart</button></div>}
    <div className="order-actions"><Link className="button-outline" to="/orders">View My Orders</Link><Link className="button-outline" to="/products">Continue Shopping →</Link></div>
  </>}</CatalogLayout>;
}
