import Razorpay from 'razorpay';

export function paymentGateway(app) {
  // Tests inject a gateway in-process. There is no HTTP or env switch to fake payment.
  if (app.locals.paymentGateway) return app.locals.paymentGateway;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const signingSecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId?.startsWith('rzp_test_') || !signingSecret) {
    const error = new Error('Razorpay Test Mode keys are not configured on the backend');
    error.status = 503;
    throw error;
  }
  const razorpay = new Razorpay({ key_id: keyId, key_secret: signingSecret });
  return {
    keyId, signingSecret,
    createOrder: options => razorpay.orders.create(options),
    fetchPayment: id => razorpay.payments.fetch(id),
    capturePayment: (id, amount) => razorpay.payments.capture(id, amount, 'INR'),
  };
}
