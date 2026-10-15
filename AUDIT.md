# ShopKart responsive and workflow audit

Audited on 15 October 2026 using Chromium 154, Node.js 24 and the local MongoDB instance.

## Responsive coverage

All **11 pages at 6 viewport widths**, totalling **66 page/width combinations**, passed:

| Pages | Viewport widths |
| --- | --- |
| Login, Register, Home, Products, Product Details, Wishlist, Cart, Checkout, Orders, Order Details, Order Success | 320, 375, 390, 768, 1024, 1440 px |

The audit checked horizontal overflow, off-screen interactive controls, squeezed inputs/buttons, rendered data and JavaScript runtime errors. Authenticated pages used populated wishlist, cart and historical order fixtures. Representative mobile/tablet/desktop screenshots were inspected. Mobile quantity controls were also exercised by the functional tests.

Run again from `frontend`:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e -- --grep 'all pages responsive'
```

Use Playwright's installed Chromium without `CHROMIUM_PATH` on another machine.

## Functional checks

- **15 backend test groups passed**, with no failures or skips: authentication, products, wishlist, cart and checkout/order validation.
- **17 browser tests passed**, with no failures or skips: 11 functional tests plus 6 responsive tests.
- **Production build passed**; backend dependency audit reported no known vulnerabilities.
- Registration, validation errors, duplicate email, invalid login, protected routes, refresh and logout passed.
- Product search/category filtering, price sorting, details, stock and missing-product states passed.
- Wishlist save/toggle/remove/count, ownership, duplicate prevention and persistence passed.
- Cart re-add/increment/decrement/remove, stock limits, decimal-price totals, shared navbar count and persistence passed.
- Checkout address validation, script/setup failure, payment cancellation/failure, verification retry, snapshots, ownership and history passed.

Payment-specific automated tests isolate the external gateway with an explicit test double while exercising the actual Express/MongoDB/HMAC logic. They do not replace the following real-provider check.

## Actual Razorpay Test Mode check

Using the supplied **Test Mode** keys, separately from the automated gateway double:

1. Authenticated Razorpay API access succeeded.
2. Real Razorpay Order creation used the server-calculated amount of **34900 paise (₹349)**.
3. The actual hosted Checkout opened. A rejected test-card attempt produced a payment error while preserving the ShopKart cart.
4. Razorpay's hosted Test Mode netbanking/demo-bank flow succeeded.
5. The callback reached ShopKart's real backend signature/payment verification endpoint.
6. The order became **PAID / PLACED** and the provider reported **captured** with the matching INR amount.
7. MongoDB cart cleared and the navbar showed **Cart (0)** without a reload.
8. Reloaded confirmation and My Orders retained the paid order and purchase-time price.

Verified ShopKart Test Mode order: `6ad1089460246932e80df44f`. This audit order is retained as evidence; unused audit accounts without orders were removed. No secret or card data is stored in this report. No real money or Live Mode keys were used.

## Environment notes and limits

The initial cloud egress and Chromium certificate-trust issues were investigated with verification enabled. A fresh Chromium instance accepted the environment proxy certificate and loaded the real hosted payment page. Razorpay API/script domains work; additional hosted UI assets were requested from `checkout-static-next.razorpay.com` and `cdn.razorpay.com`, which have been added to the environment network draft for review. These are provider assets, separate from the ShopKart page layouts.

This audit covers the tested workflows and viewports in Chromium, not every possible browser/device combination. It does not constitute production payment/fulfillment readiness: inventory reservation/decrement, payment webhooks, refunds and admin authorization remain outside the lab requirements.
