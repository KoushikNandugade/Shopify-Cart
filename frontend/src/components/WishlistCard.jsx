import ProductCard from './ProductCard.jsx';
export default function WishlistCard({ product, wishlist }) {
  return <ProductCard product={product} wishlist={wishlist} removeOnly />;
}
