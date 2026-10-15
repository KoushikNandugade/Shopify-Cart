import { Link } from 'react-router-dom';
import CatalogLayout from '../components/CatalogLayout.jsx';
import WishlistCard from '../components/WishlistCard.jsx';
import useWishlist from '../hooks/useWishlist.js';

export default function Wishlist() {
  const wishlist = useWishlist({ protectedPage: true });
  return <CatalogLayout wishlistCount={wishlist.count}><p className="breadcrumb">SHOPKART <span>/</span> SAVED FOR LATER</p><section className="catalog-hero wishlist-hero"><div><span className="eyebrow">GOOD FINDS. WORTH KEEPING.</span><h1>My <em>Wishlist.</em></h1><p>A little collection of things you love. Here whenever you’re ready.</p></div><span className="wishlist-heart" aria-hidden="true">♡</span></section>
    <div className="catalog-results-line wishlist-results"><h2>Saved for a good day.</h2><span aria-live="polite">{wishlist.status === 'ready' ? `${wishlist.items.length} ${wishlist.items.length === 1 ? 'product' : 'products'} saved` : ''}</span></div>
    {wishlist.status === 'loading' || wishlist.status === 'guest' ? <section className="catalog-state" role="status"><span className="spinner" /><p>Loading your wishlist...</p></section> : wishlist.status === 'error' ? <section className="catalog-state"><h2>A little pause in your favourites.</h2><p role="alert">Unable to load wishlist. {wishlist.error}</p><button className="button-outline" onClick={wishlist.reload}>Try Again</button></section> : wishlist.items.length === 0 ? <section className="catalog-state wishlist-empty"><span className="wishlist-heart" aria-hidden="true">♡</span><h2>Your wishlist is empty</h2><p>Save products you love and find them here later.</p><Link className="button-outline" to="/products">Browse Products →</Link></section> : <><div className="product-grid">{wishlist.items.map(product => <WishlistCard key={product._id} product={product} wishlist={wishlist} />)}</div><Link className="back-link" to="/products">← Continue shopping</Link></>}
  </CatalogLayout>;
}
