import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { ProductImage, money } from './ProductCard.jsx';

export default function CartItem({ item }) {
  const { product, quantity } = item;
  const cart = useCart();
  const busy = !!cart.pending[product._id];
  const invalidStock = quantity > product.stock;
  return <article className="cart-item"><Link className="cart-item-image" to={`/products/${product._id}`} aria-label={`View ${product.name}`}><ProductImage product={product} /></Link><div className="cart-item-content"><span className="section-label">{product.category}</span><h2><Link to={`/products/${product._id}`}>{product.name}</Link></h2><p className="cart-unit-price">{money(product.price)} each</p><p className={`stock ${invalidStock ? 'sold' : ''}`}>{product.stock ? `${product.stock} units available` : 'Out of stock'}</p><div className="cart-item-controls"><div className="quantity-control" aria-label={`Quantity for ${product.name}`}><button aria-label={`Decrease ${product.name}`} disabled={busy || quantity <= 1 || product.stock === 0} onClick={() => cart.updateQuantity(product._id, Math.min(quantity - 1, product.stock))}>−</button><span aria-live="polite">{quantity}</span><button aria-label={`Increase ${product.name}`} disabled={busy || quantity >= product.stock} onClick={() => cart.updateQuantity(product._id, quantity + 1)}>+</button></div><button className="remove-cart" disabled={busy} onClick={() => cart.removeFromCart(product._id)}>{busy ? 'Updating…' : 'Remove'}</button></div>{invalidStock && <p className="wishlist-action-error">Stock has changed. {product.stock ? 'Reduce your quantity before checkout.' : 'Please remove this unavailable item.'}</p>}{cart.actionErrors[product._id] && <p className="wishlist-action-error" role="alert">{cart.actionErrors[product._id]}</p>}</div><strong className="cart-line-total">{money(Math.round(product.price * 100) * quantity / 100)}</strong></article>;
}
