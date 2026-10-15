let loading;
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    const timer = setTimeout(() => failed(), 20000);
    function failed() {
      clearTimeout(timer); script.remove(); loading = null;
      reject(new Error('Unable to load Razorpay Checkout. Check your connection and try again.'));
    }
    script.onload = () => { clearTimeout(timer); if (window.Razorpay) resolve(); else failed(); };
    script.onerror = failed;
    document.body.appendChild(script);
  });
  return loading;
}
