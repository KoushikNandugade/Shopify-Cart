import { Link } from 'react-router-dom';
import { money } from './ProductCard.jsx';
export const orderDate = value => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(value));
export default function OrderCard({ order }) {
  return <article className="order-card"><div className="order-card-header"><div><span className="section-label">ORDER #{order._id.slice(-8).toUpperCase()}</span><p>{orderDate(order.createdAt)}</p></div><span className={`order-badge ${order.paymentStatus === 'PAID' ? 'paid' : ''}`}>{order.status.replaceAll('_', ' ')}</span></div><ul>{order.items.map(item => <li key={item.product}>{item.name} <span>× {item.quantity}</span></li>)}</ul><div className="order-card-footer"><strong>{money(order.totalAmount)}</strong><span>Payment: {order.paymentStatus}</span><Link to={`/orders/${order._id}`}>View Details →</Link></div></article>;
}
