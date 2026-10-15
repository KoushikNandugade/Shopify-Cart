// Deliberately labelled simulation; the actual Razorpay script is used in the app.
window.Razorpay = class {
  constructor(options) { this.options = options; this.listeners = {}; }
  on(event, callback) { this.listeners[event] = callback; }
  open() {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label', 'Simulated Razorpay Test Checkout');
    dialog.innerHTML = '<h2>Simulated Razorpay Test Checkout</h2><button id="sim-pay">Complete simulated payment</button><button id="sim-fail">Fail simulated payment</button><button id="sim-cancel">Cancel simulated payment</button>';
    document.body.appendChild(dialog); dialog.showModal();
    dialog.querySelector('#sim-pay').onclick = async () => {
      const response = await fetch('/__test/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: this.options.order_id }) });
      dialog.close(); dialog.remove(); this.options.handler(await response.json());
    };
    dialog.querySelector('#sim-fail').onclick = () => this.listeners['payment.failed']?.({ error: { description: 'Simulated failure' } });
    dialog.querySelector('#sim-cancel').onclick = () => { dialog.close(); dialog.remove(); this.options.modal.ondismiss(); };
  }
};
