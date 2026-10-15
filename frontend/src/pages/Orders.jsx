import { Link } from 'react-router-dom';
import CatalogLayout from '../components/CatalogLayout.jsx';
import OrderCard from '../components/OrderCard.jsx';
import useOrders from '../hooks/useOrders.js';
export default function Orders() {
  const state = useOrders();
  return <CatalogLayout><p className="breadcrumb">SHOPKART <span>/</span> MY ORDERS</p><section className="checkout-heading"><span className="section-label">GOOD FINDS. KEPT IN YOUR STORY.</span><h1>My <em>Orders.</em></h1><p>Your past purchases and pending payments, all in one place.</p></section>{state.loading ? <section className="catalog-state" role="status"><span className="spinner" /><p>Loading your orders...</p></section> : state.error ? <section className="catalog-state"><p role="alert">Unable to load your orders. {state.error}</p><button className="button-outline" onClick={state.retry}>Try Again</button></section> : !state.data.orders.length ? <section className="catalog-state"><h2>You have not placed any orders yet.</h2><p>Your next everyday favourite is waiting.</p><Link to="/products" className="button-outline">Start Shopping</Link></section> : <div className="orders-list">{state.data.orders.map(order => <OrderCard key={order._id} order={order} />)}</div>}</CatalogLayout>;
}
