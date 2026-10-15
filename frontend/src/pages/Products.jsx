import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CatalogLayout from '../components/CatalogLayout.jsx';
import ProductCard from '../components/ProductCard.jsx';
import SearchBar from '../components/SearchBar.jsx';
import useWishlist from '../hooks/useWishlist.js';
import { productApi } from '../services/api.js';

export default function Products() {
  const wishlist = useWishlist();
  const [params, setParams] = useSearchParams();
  const search = params.get('search') || '';
  const category = params.get('category') || '';
  const sort = params.get('sort') || '';
  const [state, setState] = useState({ loading: true, products: [], error: '' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, products: [], error: '' });
    const timer = setTimeout(() => {
      const query = new URLSearchParams();
      if (search.trim()) query.set('search', search.trim());
      if (category) query.set('category', category);
      if (sort) query.set('sort', sort);
      productApi(`?${query}`, { signal: controller.signal }).then(data => setState({ loading: false, products: data.products, error: '' })).catch(error => {
        if (error.name !== 'AbortError') setState({ loading: false, products: [], error: error.message });
      });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, category, sort, retry]);
  function change(key, value) {
    setParams(current => { const next = new URLSearchParams(current); if (value) next.set(key, value); else next.delete(key); return next; }, { replace: true });
  }
  return <CatalogLayout wishlistCount={wishlist.count}><p className="breadcrumb">SHOPKART <span>/</span> THE EVERYDAY EDIT</p><section className="catalog-hero"><div><span className="eyebrow">LESS ORDINARY. MORE YOU.</span><h1>Find your <em>everyday favourites.</em></h1><p>Considered essentials. Little discoveries. Good things for the way you live.</p></div><span className="catalog-flower" aria-hidden="true">✳</span></section><SearchBar search={search} category={category} sort={sort} onChange={change} /><div className="catalog-results-line"><h2>{category || 'The whole collection'}</h2><span aria-live="polite">{state.loading ? 'Finding good things…' : `${state.products.length} finds`}</span></div>
    {wishlist.error && <div className="notice error" role="alert">Unable to load saved products. {wishlist.error} <button className="button-outline" onClick={wishlist.reload}>Retry wishlist</button></div>}
    {state.loading ? <section className="catalog-state" role="status"><span className="spinner" /><p>Loading products...</p></section> : state.error ? <section className="catalog-state"><h2>A little pause in the good things.</h2><p role="alert">Something went wrong while loading products. {state.error}</p><button className="button-outline" onClick={() => setRetry(value => value + 1)}>Try again</button></section> : state.products.length === 0 ? <section className="catalog-state"><span className="empty-symbol" aria-hidden="true">⌕</span><h2>No products found.</h2><p>Try another search or give a different category a look.</p><button className="button-outline" onClick={() => setParams({})}>Clear filters</button></section> : <div className="product-grid">{state.products.map(product => <ProductCard key={product._id} product={product} wishlist={wishlist} />)}</div>}
  </CatalogLayout>;
}
