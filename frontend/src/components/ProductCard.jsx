import { Link } from 'react-router-dom';
import AddToCartButton from './AddToCartButton.jsx';
import WishlistButton from './WishlistButton.jsx';

export const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
export function ProductImage({ product }) {
  const source = product.image;
  return <img src={source} alt={product.name} loading="lazy" onError={event => {
    if (event.currentTarget.dataset.fallback) return;
    event.currentTarget.dataset.fallback = 'true';
    event.currentTarget.src = '/product-images/placeholder.svg';
  }} />;
}
export default function ProductCard({ product, wishlist, removeOnly = false }) {
  return <article className="product-card"><Link className="product-image" to={`/products/${product._id}`} aria-label={`View ${product.name}`}><ProductImage product={product} />{product.stock === 0 && <span className="sold-badge">OUT OF STOCK</span>}</Link><div className="product-meta"><span className="section-label">{product.category}</span><span className={product.stock ? 'stock' : 'stock sold'}>{product.stock ? `${product.stock} units left` : 'Out of stock'}</span></div><h2><Link to={`/products/${product._id}`}>{product.name}</Link></h2><div className="product-bottom"><strong>{money(product.price)}</strong><Link to={`/products/${product._id}`}>View Details <span aria-hidden="true">→</span></Link></div>{wishlist && <WishlistButton product={product} wishlist={wishlist} removeOnly={removeOnly} />}<AddToCartButton product={product} /></article>;
}
