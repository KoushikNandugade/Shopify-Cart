import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CatalogLayout from '../components/CatalogLayout.jsx';
import { ProductImage, money } from '../components/ProductCard.jsx';
import useWishlist from '../hooks/useWishlist.js';
import AddToCartButton from '../components/AddToCartButton.jsx';
import WishlistButton from '../components/WishlistButton.jsx';
import { productApi } from '../services/api.js';

export default function ProductDetails() {
  const wishlist = useWishlist();
  const { id } = useParams();
  const [state, setState] = useState({ loading: true, product: null, error: '', status: 0 });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, product: null, error: '', status: 0 });
    productApi(`/${encodeURIComponent(id)}`, { signal: controller.signal }).then(data => setState({ loading: false, product: data.product, error: '', status: 200 })).catch(error => {
      if (error.name !== 'AbortError') setState({ loading: false, product: null, error: error.message, status: error.status });
    });
    return () => controller.abort();
  }, [id, retry]);
  const product = state.product;
  return <CatalogLayout wishlistCount={wishlist.count}><Link className="back-link" to="/products">← Back to collection</Link>{state.loading ? <section className="catalog-state" role="status"><span className="spinner" /><p>Loading product...</p></section> : state.error ? <section className="catalog-state"><h1>{[400, 404].includes(state.status) ? 'Product not found.' : 'Something went wrong.'}</h1><p role="alert">{state.error}</p>{![400, 404].includes(state.status) && <button className="button-outline" onClick={() => setRetry(value => value + 1)}>Try again</button>}<Link to="/products">Explore the collection</Link></section> : <section className="product-detail"><div className="detail-image"><ProductImage product={product} /></div><div className="detail-copy"><span className="section-label">{product.category} / THE EVERYDAY EDIT</span><h1>{product.name}</h1><p className="detail-price">{money(product.price)}</p><span className={`stock ${product.stock ? '' : 'sold'}`}>{product.stock ? `In stock · ${product.stock} units left` : 'Out of stock'}</span><p className="detail-description">{product.description}</p><AddToCartButton product={product} />{wishlist.error && <p className="notice error" role="alert">Unable to load wishlist. {wishlist.error} <button onClick={wishlist.reload}>Retry wishlist</button></p>}<WishlistButton product={product} wishlist={wishlist} /><div className="detail-note"><span aria-hidden="true">◇</span> Thoughtfully chosen for your everyday.</div></div></section>}</CatalogLayout>;
}
