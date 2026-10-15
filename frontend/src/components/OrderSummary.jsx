import { money } from './ProductCard.jsx';
export default function OrderSummary({ items, total, children }) {
  return <aside className="order-summary checkout-summary"><span className="section-label">02 / YOUR EVERYDAY FINDS</span><h2>Order Summary</h2><div className="checkout-lines">{items.map(item => <div key={item.product?._id ?? item.product}><span>{item.product?.name ?? item.name} <small>× {item.quantity}</small></span><strong>{money(Math.round((item.product?.price ?? item.price) * 100) * item.quantity / 100)}</strong></div>)}</div><dl><div><dt>Total</dt><dd>{money(total)}</dd></div></dl><p className="summary-note">INR · Razorpay Test Mode only. No real money. No shipping or tax charges are added in this lab.</p>{children}</aside>;
}
