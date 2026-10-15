import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';

export default function AddToCartButton({ product }) {
  const cart = useCart();
  const [added, setAdded] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const quantity = cart.cartItems.find(item => item.product._id === product._id)?.quantity ?? 0;
  const currentStock = cart.cartItems.find(item => item.product._id === product._id)?.product.stock ?? product.stock;
  const busy = !!cart.pending[product._id];
  const atLimit = quantity >= currentStock;
  async function add() {
    const result = await cart.addToCart(product._id);
    if (result.status === 401) navigate('/login', { state: { returnTo: location.pathname + location.search } });
    setAdded(result.ok);
  }
  return <div className="add-cart-action"><button className="button-primary add-cart-button" disabled={busy || cart.loading || currentStock === 0 || atLimit} onClick={add}>{busy ? 'Adding…' : currentStock === 0 ? 'Out of stock' : atLimit ? 'Stock limit reached' : quantity ? 'Add Another' : 'Add to Cart'} <span aria-hidden="true">+</span></button>{added && <p className="cart-feedback" role="status">Added to cart</p>}{cart.actionErrors[product._id] && <p className="wishlist-action-error" role="alert">{cart.actionErrors[product._id]}</p>}</div>;
}
