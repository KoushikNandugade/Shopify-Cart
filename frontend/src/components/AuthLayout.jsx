import Navbar from './Navbar.jsx';

export default function AuthLayout({ children, register = false }) {
  return <div className="site"><div className="announcement">A little more you. A little more everyday. <span aria-hidden="true">✦</span></div><Navbar />
    <main className="auth-layout">
      <section className="editorial" aria-label="Welcome to ShopKart">
        <div className="eyebrow"><span className="small-line" /> THE EVERYDAY EDIT</div>
        <h1>Good things.<br />Great finds.<br /><em>All yours.</em></h1>
        <p>A home for the things you love.<br />Your next chapter starts here.</p>
        <div className="shopping-art" aria-hidden="true"><div className="art-orbit" /><div className="art-disc" /><div className="bag bag-back"><span /></div><div className="bag bag-front"><span /><b>shopkart.</b></div><div className="art-label">MADE FOR YOUR EVERYDAY <span>✦</span></div><span className="art-star">✳</span></div>
        <div className="editorial-bottom"><span>THOUGHTFULLY CHOSEN.</span><span>JUST FOR YOU. →</span></div>
      </section>
      <section className="form-panel"><div className="form-content"><span className="section-label">YOUR SHOPKART ACCOUNT</span><h2>{register ? 'Make yourself at home.' : 'Welcome back.'}</h2><p className="form-intro">{register ? 'A few details, and you’re part of the good things.' : 'Your everyday favourites are just a login away.'}</p>{children}</div><p className="security-note"><span aria-hidden="true">◇</span> Your details, kept safe. Always.</p></section>
    </main><footer>© {new Date().getFullYear()} ShopKart <span>Small joys. Everyday.</span></footer>
  </div>;
}
