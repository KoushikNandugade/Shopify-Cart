export default function WishlistButton({ product, wishlist, removeOnly = false }) {
  const saved = wishlist.isSaved(product._id);
  const busy = !!wishlist.pending[product._id];
  const error = wishlist.actionErrors[product._id];
  return <div className="wishlist-action"><button type="button" className={`wishlist-button ${saved || removeOnly ? 'is-saved' : ''}`} disabled={busy || wishlist.status === 'loading'} aria-pressed={removeOnly ? undefined : saved} onClick={() => wishlist.change(product._id, removeOnly || saved)}>
    <span aria-hidden="true">{saved || removeOnly ? '♥' : '♡'}</span> {busy ? (saved || removeOnly ? 'Removing…' : 'Saving…') : saved || removeOnly ? 'Remove from Wishlist' : 'Add to Wishlist'}
  </button>{saved && !removeOnly && <span className="wishlist-saved-note" role="status">Added to Wishlist</span>}{error && <p className="wishlist-action-error" role="alert">{error}</p>}</div>;
}
