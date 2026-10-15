# ShopKart — Engineering Labs 01–06

A working customer authentication API and React frontend. The backend uses Node.js, Express, MongoDB, Mongoose, bcrypt, jsonwebtoken and cookie-parser. The frontend uses React, React Router, Fetch and CSS. No authentication framework or Redux is used. Product discovery is included in Lab 03. Lab 04 adds a persistent wishlist; Lab 05 adds a shared, persistent shopping cart. Lab 06 implements checkout and order history with Razorpay Test Mode; actual gateway validation requires your Test Mode keys.

## Lab 02 — Run the website

First complete the MongoDB and backend setup below. Keep MongoDB running and run `npm start` from `backend` in one terminal. In another terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open the Vite address printed in your local terminal (port 5173). Use `/register` to create an account, `/login` to log in, and `/home` for your protected profile. Registration redirects to login with a success message. Logout clears the cookie and redirects to login. Refreshing `/home` checks the session again. You do not need a frontend `.env` or an API key.

The Vite config proxies `/customers` and `/health` to Express on port 5000. Fetch uses `credentials: 'include'`. Keep using the frontend origin in your browser; do not mix `localhost` and `127.0.0.1`. This arrangement avoids cross-origin cookie/CORS issues. If you change the backend port, update the proxy target too.

### Frontend structure

```text
frontend/
  src/
    pages/Login.jsx, Register.jsx, Home.jsx
    components/Navbar.jsx, AuthLayout.jsx, Field.jsx
    services/api.js
    App.jsx
    main.jsx
    styles.css
  vite.config.js
  test/auth.spec.js
```

All registration/login fields are controlled React inputs. Shared API handling reports network and backend errors. Home fetches the real customer using `/customers/me`, displays a loading state until authenticated, redirects on 401, and offers a retry on service failure. Customer data and tokens are never persisted to localStorage. Returning focus to the home tab rechecks the session.

### Frontend validation and browser tests

```sh
cd frontend
npm run build
npx playwright install chromium
npm run test:e2e
```

MongoDB and the backend must already be running. Playwright starts Vite automatically if needed. On this prepared cloud machine, use `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` with the installed browser. On another Linux machine, Playwright may require browser OS dependencies (`npx playwright install --with-deps chromium`). Browser tests verify the complete registration/login/profile/refresh/logout flow, errors, HttpOnly cookies and mobile overflow. They remove only their own customer account; backend dependencies and `.env` are required for cleanup.

`npm run preview` serves the production build on port 4173 with the API proxy for local verification. For deployment, serve the built `frontend/dist` with an SPA fallback to `index.html` and route `/customers` to the backend on the same HTTPS origin. Vite preview is for local checks, not production hosting. Set `NODE_ENV=production` on the backend for Secure cookies.

### Lab 02 manual demonstration

1. Visit `/home` without logging in: it redirects to `/login`.
2. Submit empty registration fields: validation errors appear.
3. Register an account: login appears with a success message.
4. Try a wrong password: “Invalid Credentials” appears.
5. Log in correctly: your full name, email and phone appear on `/home`.
6. Refresh the page: the cookie keeps you authenticated.
7. Log out, then revisit `/home`: you are sent back to login.
8. Repeat at a narrow mobile width. Inspect the cookie in browser developer tools: HttpOnly is enabled and the token is absent from localStorage.

### Lab 02 viva notes

- **Why send credentials?** `credentials: 'include'` (Fetch) or `withCredentials: true` (Axios) permits sending applicable cookies with API requests. Cookie SameSite, Secure and browser origin rules still apply.
- **Why can’t JavaScript read the cookie?** HttpOnly tells the browser to exclude it from `document.cookie`; the browser manages transmission itself.
- **What protects home?** It renders customer details only after `/customers/me` succeeds. The backend middleware enforces actual access control; a frontend redirect alone is not security.
- **Why fetch `/me`?** It verifies the current cookie with the server and retrieves current database details instead of trusting potentially stale or edited local data.
- **Authentication vs authorization?** Authentication identifies the customer; authorization decides which resources or actions that customer may access.

The original Lab 01 setup and API guide follows.

## Lab 03 — Product catalog & discovery

With MongoDB running, prepare the eight sample products:

```sh
cd backend
npm run seed
npm start
```

If the backend is already running from before code changes, stop that terminal and restart it (or use `npm run dev` for watch mode). Start the frontend with `npm run dev` from `frontend` in another terminal. Choose **Shop** in the navbar or **Explore products** on your account page.

The seed command uses fixed sample IDs and inserts only missing sample records. Running it again preserves existing products and any changes to their prices or stock. It never clears the collection. Sample product illustrations are served locally from `backend/public/product-images`, so external image services are not required. New products must be created in MongoDB through the API, not hardcoded in React.

### Product APIs (Postman uses backend port 5000)

| Method | Endpoint | Result |
| --- | --- | --- |
| POST | `/products` | 201 with `{success, product}`. Open for this lab. |
| GET | `/products` | `{success, count, products}` |
| GET | `/products/:id` | `{success, product}`; invalid ID → 400, missing record → 404 |
| GET | `/products?search=keyboard` | Case-insensitive literal name search |
| GET | `/products?category=Electronics` | Exact category match |
| GET | `/products?search=keyboard&category=Electronics` | Both conditions |
| GET | `/products?sort=price_asc` | Bonus: ascending price; `price_desc` for descending |

Create-product JSON:

```json
{
  "name": "Mechanical Keyboard",
  "description": "RGB mechanical keyboard with blue switches.",
  "price": 2999,
  "category": "Electronics",
  "image": "/product-images/keyboard.svg",
  "stock": 10
}
```

All fields are mandatory. Price must be a finite number greater than zero; stock must be a nonnegative integer. Text must be nonempty. Images accept HTTP(S) URLs or the bundled `/product-images/*.svg` paths. Invalid input returns 400. Creation deliberately has no admin authorization, as specified by Lab 03. Do not expose this write API publicly as a production admin endpoint.

The Postman collection includes a **Lab 03 - Products** folder. Create Product saves its returned ID to `productId` for the single-product request. Postman requests are included for combined filtering, sorting, malformed IDs and missing products. Requests made in Postman remain stored in your database.

### Frontend implementation

- `/products` fetches database products and maps them to `ProductCard` components.
- Search is debounced by 250 ms; category and sorting combine with the search query. Filters are in the URL, so reload preserves them. Previous requests are aborted when filters change.
- `/products/:id` reads `useParams()`, fetches the individual record, and displays description, image, price, category and stock.
- Loading, empty, error/retry and product-not-found states are provided. Failed image URLs show a bundled placeholder.
- Add to Cart now uses the real persistent cart from Lab 05. Out-of-stock products disable the button.
- Products are public in this lab; `/home` remains protected. The navbar links Shop and the authenticated account.

Frontend navigation `/products` must serve React, whereas API requests need JSON. Therefore browser product requests use `/api/products`; Vite rewrites that to backend `/products`. This avoids intercepting product-page navigation with an API proxy. For production, route `/api/*` to Express with `/api` stripped, `/customers/*` and `/product-images/*` to Express unchanged, and other paths to the React SPA. Apply the same HTTPS cookie guidance as Lab 02.

### Validation and demonstration

Backend `npm test` now runs fifteen test groups, covering authentication and product creation validation, database persistence, name search, combined filters, price sorting and single-product errors. Frontend `npm run build` verifies compilation. With the seeded catalog, backend and MongoDB running, `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` runs seventeen browser tests on this cloud machine. Use regular `npm run test:e2e` after installing Playwright Chromium on your own machine. Product browser tests expect the original eight seeded products and their original prices/stock; use a separate lab/test database if you have changed those samples or inserted other products.

For the TA demo: browse products → search “keyboard” → select Electronics → sort low/high → open View Details → refresh the details URL → check stock and the cart behaviour. Search for an unmatched word to show the empty state. Stop Express and reload to show error/retry; restart it and retry. Open `/products/invalid` to show the invalid-ID state. Repeat on a mobile viewport.

### Lab 03 viva notes

1. **Why MongoDB?** Product changes should appear without editing and rebuilding the frontend. MongoDB is the shared persistent source of truth.
2. **URL parameter vs query parameter?** `:id` identifies one resource in a route path. `?search=...&category=...` modifies the collection query.
3. **Why `.map()`?** It creates one card per returned product. Each card uses the stable MongoDB ID as its React key.
4. **Why state handling?** Loading explains the wait, errors explain failure and allow retry, and an empty result is a valid successful response with no matching products.
5. **Why backend filtering?** The database can select matching records before transferring them. This lab returns all matches; pagination and suitable indexes would be needed for a large production catalog.
6. **Why separate services?** Fetch, cookie handling and API errors are reusable; page components focus on interaction and rendering.
7. **Why escape search text?** Search terms should match literal product names, not execute arbitrary regular-expression patterns.

## Lab 04 — Persistent Wishlist

Use the same MongoDB instance, backend `.env`, and two-terminal startup workflow. No new packages, credentials, database service, Context API or Redux are needed. Restart the backend after pulling these changes.

### Try the feature

1. Log in and choose **Shop**. Each product has **♡ Add to Wishlist**.
2. Save a product. The button shows **Saving…**, becomes **♥ Remove from Wishlist**, and the navbar count updates from the API.
3. Open **Wishlist**. See the saved product image, name, current price, category and stock. **View Details** opens the product page; **Continue shopping** returns to the catalog.
4. Refresh, log out, and log in again. Saved products remain because they are stored in MongoDB.
5. Remove a product. The card disappears after the server confirms the removal; removing the final item shows the empty state and **Browse Products** link.
6. Log in as a different customer: their wishlist is independent. Guests opening `/wishlist` or trying to save are sent to login, then returned to the intended page. Saving is not performed automatically after login; click Add again.

Out-of-stock products can still be wishlisted. The cart is now implemented in Lab 05.

### Database relationship

Our existing user model is called `Customer`, not `User`. Its new field is:

```js
wishlist: {
  type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  default: []
}
```

Only Product ObjectIds are stored in each customer's wishlist. `populate({ path: 'wishlist', select: 'name price category image stock' })` retrieves current product data. Existing customers without this field work without a migration. Missing/deleted products are omitted from populated results so the UI never renders null cards; their old references can still be removed through DELETE.

### API contract

These endpoints reuse the existing JWT **HttpOnly cookie** authentication. The Bearer header shown as an example in the handout is not needed in this project. Log in through `/customers/login` and let Postman/browser manage the cookie.

| Method | Endpoint | Result |
| --- | --- | --- |
| POST | `/wishlist/:productId` | 201, `Product added to wishlist` |
| GET | `/wishlist` | 200, `{success, count, wishlist}` populated with products |
| DELETE | `/wishlist/:productId` | 200, `Product removed from wishlist` |

All require authentication; missing/invalid sessions return 401. Invalid IDs return 400. Adding a missing product returns 404, adding a duplicate returns 409, and removing an unsaved product returns 404. No request body is required. Ownership always comes from `req.user._id`; supplied body/query `userId` values never choose a different owner. `GET /wishlist/:userId` is not implemented.

Add uses an atomic conditional `$addToSet`, and remove uses `$pull`. Five simultaneous adds for one customer/product produce one successful write and four 409 responses. No duplicate entries are created. The frontend bonus toggle uses POST or DELETE based on server-loaded state, so an additional PATCH toggle endpoint is unnecessary.

The frontend calls `/api/wishlist`; the existing Vite `/api` proxy rewrites this to backend `/wishlist`. Add this route to your production reverse proxy's `/api` routing as well. A same-origin HTTPS deployment preserves the existing HttpOnly/SameSite cookie setup.

### Frontend structure and lifecycle

- `pages/Wishlist.jsx` renders protected loading, populated, empty and error/retry states.
- `hooks/useWishlist.js` is a reusable hook with **page-local state**, not a global store. It fetches the current wishlist on each page and revalidates when a tab regains focus.
- `components/WishlistButton.jsx` handles save/remove labels, pending disablement and per-product failures. A per-product request lock blocks repeated submissions.
- `components/WishlistCard.jsx` reuses the product card with a removal action. Product details also provide a wishlist toggle.
- `Navbar.jsx` receives the page's backend-derived count, or fetches it on the account page. Unknown counts are omitted instead of showing an invented number.
- Mutation success triggers a fresh GET; cards and counts reflect the database response. If a different tab already added/removed an item (409/404), the page refetches to reconcile state. Mutation errors are displayed and do not falsely remove cards.

### Test and Postman evaluation

```sh
cd backend
npm test
```

Fifteen backend test groups cover all labs, including wishlist authentication, validation, concurrent duplicate prevention, raw ObjectId storage, `populate()` data, account isolation, re-login persistence, updated product prices/stock, legacy customers and deleted references.

With MongoDB, backend and the seeded catalog running:

```sh
cd frontend
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
npm run build
```

Use `npm run test:e2e` with Playwright's installed Chromium on your own machine. Seventeen browser tests cover all labs, including wishlist empty/loading/error/retry, add/remove, count updates, mobile overflow, refresh/re-login, product detail navigation, guest redirects, disabled pending actions, and failed writes. Test cleanup deletes only its own uniquely named customers/products.

Import the updated Postman collection. Log in first, set `productId` to a real product ID (default seed ID is provided), then run **Lab 04 - Wishlist** in order: add → duplicate → get → malformed/missing product → remove → remove again. Status assertions are included. Clear the cookie jar and repeat a wishlist request to verify 401; log in as a second customer to verify isolation. The APIs were exercised by automated HTTP tests here; run the included collection yourself for your TA's Postman demonstration.

### Lab 04 viva notes

1. **Why ObjectIds?** They reference one authoritative product record instead of copying prices/stock into every customer.
2. **What does `ref: 'Product'` mean?** It identifies the Mongoose model used to resolve references during population.
3. **Embedding vs referencing?** Embedding keeps nested data inside a document; referencing stores another document's ID and resolves it when needed.
4. **Why `populate()`?** It turns saved Product IDs into the product fields needed by the UI.
5. **Why protect these APIs?** Wishlists belong to individual customers. Authentication establishes whose document can be read/updated.
6. **Why not trust `userId` from the client?** A caller could replace it with another customer's ID. The verified session provides ownership instead.
7. **How are duplicates prevented?** An atomic membership condition and `$addToSet` at the database level; duplicate additions return 409.
8. **Why fetch the backend after refresh?** Component memory is temporary. MongoDB retains the wishlist across pages, refreshes and future sessions.
9. **Why no Context/Redux?** This lab's persistent state belongs in the backend; local state only tracks rendering and requests.

## Lab 05 — Shopping Cart with React Context

The cart itself needs no new packages or credentials; Lab 06 adds Razorpay and its Test Mode keys. Start MongoDB, restart Express after these changes (`cd backend`, `npm start`), then start Vite from `frontend` (`npm run dev`). Choose **Shop**, add a product, and open **Cart** in the navbar.

### What to demonstrate

1. Add a product from a card or its details page. The cart count increases without refreshing.
2. Add it again: one row remains, with quantity 2.
3. Add another product. The navbar shows total units, not distinct rows.
4. Open `/cart`. Increase/decrease quantity and watch line totals, subtotal and navbar update together.
5. At quantity 1, minus is disabled; use Remove. At available stock, plus and Add Another are disabled.
6. Refresh or log out and log in: MongoDB retains your cart. Logging out clears the browser's shared cart state, so another session does not see the previous customer's items.
7. Remove all items to show the empty state. Stop the backend and reload `/cart` to show error/retry; restart and retry.
8. **Proceed to Checkout** now opens the shipping form and Razorpay Test Mode payment flow from Lab 06.

### Cart model and API

The existing `Customer` model now contains `cart: [{ product: ObjectId ref Product, quantity: Number }]`, defaulting to `[]`. Quantity is a positive integer. Only references and quantities are stored; price, subtotal and total units are not copied into the customer document. Existing customers work without a migration. An internal `cartVersion` supports concurrent cart updates.

| Method | Endpoint | Behaviour |
| --- | --- | --- |
| POST | `/cart/:productId` | Add quantity 1, or increment the existing row. Returns updated populated cart. |
| GET | `/cart` | Return authenticated customer's populated cart. |
| PATCH | `/cart/:productId` | Set the absolute quantity using `{"quantity":3}`. Returns updated cart. |
| DELETE | `/cart/:productId` | Remove an existing row and return updated cart. |

All routes require the existing HttpOnly session cookie. No `userId` body/query is used for ownership. Invalid IDs return 400; missing products or unsaved rows return 404; invalid/fractional/zero/negative quantities and quantities above current stock return 400. Successful mutations return 200. A heavily contended cart may return 409, asking the client to retry.

Each mutation reads current product stock, then conditionally writes the customer's cart version. Competing cart writes retry against fresh state, preventing lost increments and duplicate product rows. Stock is **validated, not reserved**: adding to a cart does not reduce inventory. Final stock verification and order creation belong to Lab 06. If stock changes again after a cart check, checkout will still need to revalidate it.

GET uses `populate('cart.product')` with selected product fields, so current prices and stock appear after refreshing the cart. Deleted products are excluded from live totals and returned in `unavailableProductIds`; the cart page displays removable unavailable-item notices. Items exceeding current stock are flagged, and proceeding is disabled until quantities are reduced or items removed.

### One shared frontend source of truth

`context/CartContext.jsx` wraps the application in a single `CartProvider`. It exposes:

- `cartItems`, `loading`, `status`, `error`.
- `addToCart`, `updateQuantity`, `removeFromCart`, `refreshCart`.
- Per-product `pending` and `actionErrors`.
- Derived `totalUnits` and `subtotal`.

Product buttons, `CartItem`, the cart page, order summary and navbar consume `useCart()`. They do not independently fetch or maintain their own cart copies. Requests pass through the provider; initial reads are deduplicated and mutation requests are queued so late responses cannot overwrite newer state. Login reloads the server cart, logout clears only frontend state, and returning focus refreshes prices/stock.

The UI updates after confirmed server writes and shows a pending state for the affected item. Failed mutations keep the item and show an error; the provider reconciles with the backend rather than pretending a failed operation succeeded. This provides immediate feedback without optimistic data that would require rollback.

`totalUnits = sum(quantity)`. `subtotal = sum(price × quantity)`, calculated in paise to avoid accumulating common decimal rounding errors. These are derived from the populated cart, not separately persisted. The order summary shows only the subtotal; shipping/taxes are deferred to checkout.

Frontend requests use `/api/cart`, rewritten by Vite to Express `/cart`. Production routing must preserve that same `/api` rewrite and the existing cookie configuration. Product and wishlist pages remain available; Wishlist continues to use page-local state as required by Lab 04, while Cart uses Context as required by Lab 05.

### Test commands and Postman

```sh
cd backend
npm test
```

Fifteen backend test groups cover all labs. New cart tests cover authentication, malformed inputs, missing products/rows, concurrent increments through the stock limit, reference-only storage, separate customers, live price/stock changes, re-login, legacy defaults and deleted-product cleanup.

```sh
cd frontend
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

Seventeen browser tests cover all labs on this prepared cloud machine. Use regular `npm run test:e2e` with Playwright Chromium on your own machine. Cart tests use their own temporary products and customers, verify totals with decimal prices, navbar synchronization, quantity boundaries, refresh/re-login, pending/error/retry, changed stock and deleted products, then remove their own test records. Product catalog tests still expect the original seeded eight products.

The Postman collection includes **Lab 05 - Cart**. Log in, choose a product with at least three units of stock and start with that product absent from the cart. Run add → add again → get → set quantity → reject invalid quantities → remove. Clear cookies and repeat to prove 401; log in as a second customer to verify isolation. Automated HTTP tests exercised these APIs here; run the supplied Postman collection for your TA's demonstration.

### Lab 05 viva notes

1. **Why global state?** Product controls, navbar and cart need the same cart data across routes. Context provides one shared frontend state.
2. **Why not fetch in Navbar?** Independent requests/copies can disagree. Navbar derives its count from the same Context as the cart page.
3. **Server vs UI state?** MongoDB persists customer selections; frontend state renders that data and tracks loading/errors.
4. **What is derived state?** Values computed from current items, such as units and subtotal. Storing them separately risks stale totals.
5. **Why quantity and Product reference?** Cart records how many of a product the customer intends to buy, while Product remains the source of price and stock.
6. **What happens on re-add?** The existing row's quantity increments if current stock allows it; no duplicate row is created.
7. **How is stock checked?** The server reads current stock on each add/update and rejects an excessive quantity. Browser limits improve UX but cannot replace server validation.
8. **What happens on failure?** An error is shown and unconfirmed changes are not applied; the cart is reconciled with the server.
9. **How does count update?** Context accepts the API's updated cart; React rerenders all consumers and recalculates total quantity.

## Lab 06 — Checkout, Razorpay Test Mode & Orders

**Actual Razorpay Test Mode checkout has now been verified.** A real hosted test payment was captured for ₹349, verified by the backend, persisted as PAID/PLACED, and cleared the cart. Refreshing confirmation/history retained the order. A failed provider attempt preserved the cart. No Live Mode keys or real money were used. See [AUDIT.md](AUDIT.md) for the complete responsive/workflow audit.

### Razorpay setup guide

1. Create/sign in to your Razorpay account at https://dashboard.razorpay.com and switch to **Test Mode**.
2. Open **Account & Settings → API Keys** (dashboard labels may vary) and generate Test Mode API keys. Your Key ID must start with `rzp_test_`. The backend rejects Live Mode IDs.
3. Put `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in your private `backend/.env`, alongside your existing MongoDB/JWT settings:

   ```env
   RAZORPAY_KEY_ID=your_test_key_id
   RAZORPAY_KEY_SECRET=your_test_key_secret
   ```

   Replace both placeholders with your own Test Mode values. Do not commit this file, paste the secret in chat, or put it in a frontend `VITE_` variable. The server needs the actual secret locally to calculate HMAC; a network-proxy placeholder is insufficient. If using cloud environment settings, use backend runtime values that are actually available to Node, or securely edit the ignored `.env` file.
4. Run `npm ci` from `backend` to install the added Razorpay SDK, then restart Express (`npm start` or `npm run dev`). Restart after changing keys. Keep MongoDB and the frontend running as before.
5. Cloud egress needs `api.razorpay.com` for backend requests. The browser needs `checkout.razorpay.com` and any resources the Razorpay-hosted checkout requests. Use the gateway's hosted form; do not build or collect card/CVV inputs in ShopKart.
6. Log in → add a product → Cart → Proceed to Checkout → enter shipping details → **Pay with Razorpay (Test)**. The hosted window shows the server-generated amount. Follow Razorpay's current Test Mode instructions (https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/) for a test payment method. Do not use Live Mode or real money.
7. Complete a successful test payment. Expect PAID/PLACED, Cart (0) for an unchanged checkout cart, and persisted order details after refresh. Deliberately test failure/cancellation: the cart must remain.

Only the public Key ID is returned to the browser. The Key Secret stays on the backend, is never stored in MongoDB, and is never returned by an API. No keys are committed or included in the frontend build.

### API flow and rules

| Method | Endpoint | Result |
| --- | --- | --- |
| POST | `/orders/create-payment-order` | Validate cart/address, snapshot prices, persist pending order, create Razorpay Order; return safe checkout data (201). |
| POST | `/orders/verify-payment` | Verify HMAC and gateway payment details, mark PAID/PLACED, reconcile cart; return confirmed order (200). |
| GET | `/orders` | Current customer's orders, newest first, including pending/failed attempts. |
| GET | `/orders/:id` | One owned order; invalid ID → 400, missing/not owned → 404. |

All routes use the existing authenticated HttpOnly cookie. Frontend calls `/api/orders`; Vite strips `/api` before forwarding to Express. The handout's occasional `POST /orders` example is not used; the explicit contract is `/orders/create-payment-order`.

Creation accepts only shipping details as trusted input:

```json
{
  "shippingAddress": {
    "fullName": "Aarav Sharma",
    "phone": "9876543210",
    "addressLine1": "22 MG Road",
    "city": "Bengaluru",
    "state": "Karnataka",
    "pincode": "560001"
  }
}
```

Empty/whitespace fields are invalid. Phone accepts 10–15 digits with an optional leading `+`. Pincode is six digits, starting with 1–9. React validates before requests; the server validates independently. Empty carts, deleted products and insufficient stock return 400. Missing Test Mode keys return 503; provider creation failure returns 502. None of these clear the cart.

The server reloads current Product records and calculates `amount` in integer paise. Fake client `totalAmount`, price or items are ignored. The `Order` model stores the authenticated Customer reference, Product IDs, name/price/image/quantity snapshots, address, total, payment/status fields and timestamps. Historical order display never populates current prices over those snapshots.

The pending checkout is keyed to customer, cart version, address and product snapshot. Repeating the same prepared checkout reuses its Razorpay Order rather than creating another payment order. Requests racing setup return 409 and can retry. Failed provider setup can retry without discarding the cart.

Verification accepts `shopKartOrderId`, `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature`. The backend:

1. Finds the order under the authenticated customer.
2. Requires the supplied Razorpay Order ID to match the stored one.
3. Calculates HMAC SHA256 of `storedOrderId|paymentId` with the backend secret and compares signatures using `timingSafeEqual`.
4. Fetches payment details from Razorpay, verifies the bound order, amount and INR currency, and requires captured payment status. An authorized payment is captured through the backend SDK before confirmation.
5. Persists PAID/PLACED and the payment ID, then reconciles the cart. A replay returns the same order and cannot erase a newly built cart.

If the cart is unchanged since checkout, it is cleared and its version increments. If another tab changed it during payment, the newer cart is preserved rather than erased; review it before paying again. Payment confirmation is persisted before cleanup. If a database/network failure interrupts verification, retrying the same signed response safely finishes cleanup. Do not submit a new payment to recover from a verification error.

The lab performs final stock verification at payment-order creation. It does not reserve or decrement inventory, implement refunds, or process payment webhooks. Those would be needed for production fulfillment and payment reconciliation beyond this lab. If the browser closes after payment but before verification, no success is claimed; use the original payment identifiers for backend verification/reconciliation instead of paying again.

### Frontend flow

- `/checkout`: protected cart review, controlled address form, field errors, preparation/payment/verification states and hosted Test Mode payment.
- `/order-success/:id`: fetches persisted order; only a paid order receives a successful-order heading. Guessing a pending order URL cannot create a success state.
- `/orders`: protected history with loading, empty and error/retry states.
- `/orders/:id`: owned order snapshot, address, amount and payment/order status.

Payment failure/dismissal leaves the cart intact. Script load failures show an error and allow retry. If the gateway callback succeeds but verification fails, **Retry payment verification** reuses the signed callback without reopening payment. After backend confirmation, the shared Cart Context refreshes from MongoDB before navigation, keeping the navbar consistent. Checkout does not collect card numbers or CVVs.

### Validation evidence and tests

```sh
cd backend
npm ci
npm test
```

Fifteen backend test groups cover all labs. Payment-specific tests inject a gateway double **inside the test process**, exercising real Express routes, MongoDB snapshots, ownership, stock checks, paise totals, HMAC, provider failure, capture flow, cart cleanup and replay. No runtime HTTP/environment switch enables fake payments.

```sh
cd frontend
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

Use regular `npm run test:e2e` with Playwright's installed browser on your own machine. The browser suite has seventeen tests, including six responsive audit tests covering eleven pages each. Checkout tests replace the external Razorpay script and route order calls to an isolated, loopback-only test server on port 5001. That test server uses the real application/database logic with a simulated gateway. It is started/stopped by Playwright and is never used by `npm start` or normal Vite browsing. Tests explicitly label simulated payments and clean up only their own products/customers/orders.

**Automated gateway doubles do not independently verify a real provider transaction.** A separate real hosted Razorpay Test Mode check has now passed; its evidence is recorded in AUDIT.md. Repeat it when changing gateway credentials or deployment.

### Postman demonstration

The collection contains **Lab 06 - Checkout**. Log in and use a nonempty cart. Create payment order stores `shopKartOrderId` and `razorpayOrderId`; the sample sends `totalAmount: 1` to demonstrate that pricing is ignored. Check the cart remains and an invalid signature returns 400. Complete a real Test Mode Checkout using that order, then use the callback's payment ID/signature for verification. Do not store the Key Secret in collection variables. The React flow sends verification automatically; you can inspect that request in browser developer tools and retry the same identifiers in Postman to demonstrate idempotency.

Check GET orders/details, refresh history, try another customer's order ID (404), and clear cookies to verify 401. Use a fresh product/cart to test stock changes. Automated API requests were executed here; manually run the supplied collection for your TA.

### Lab 06 viva notes

1. **Why create Razorpay orders on the backend?** The backend owns pricing and the API secret; the browser can be modified.
2. **Why paise?** Razorpay accepts INR's smallest currency unit, so ₹125.50 is sent as 12550.
3. **What does the callback prove?** It provides identifiers/signature to verify, not permission to trust `paymentSuccess: true`.
4. **Why HMAC?** A correct signature binds the payment ID to our stored gateway order using a secret unavailable to the browser.
5. **Why check gateway details too?** To confirm the expected order, amount, currency and captured status.
6. **Why snapshots?** A historical order must retain the purchase-time name/price even if Product records change or disappear.
7. **Why keep the cart while pending?** Creating/opening a payment order does not mean money was paid or verified.
8. **Why ownership filters?** Querying both order ID and authenticated customer ID prevents guessing another customer's order.
9. **Why update Context?** A saved backend payment alone does not rerender cart consumers; reloading canonical state updates the navbar and cart together.
10. **What if verification fails after a payment?** Retry verification with the same signed response. Never assume failure means it is safe to charge again.

## Requirements

- Node.js 22 or newer (Node 24 recommended), npm.
- MongoDB Community Server, Docker with MongoDB, or a MongoDB Atlas database.
- Postman for manual API evaluation.

## 1. Start MongoDB

Choose **one** option.

### Local Docker (used for development validation)

```sh
docker run -d --name shopkart-mongo -p 127.0.0.1:27017:27017 -v shopkart-mongo-data:/data/db mongo:8.0
```

On later runs use `docker start shopkart-mongo`. The named volume retains records. Check readiness with:

```sh
docker exec shopkart-mongo mongosh --quiet --eval 'db.adminCommand({ping:1})'
```

Use `mongodb://127.0.0.1:27017/shopkart` as `MONGODB_URI`. If MongoDB Community is already running locally, use that same URI without Docker.

### MongoDB Atlas

1. Create an Atlas account and a free database deployment at https://www.mongodb.com/atlas.
2. Under Database Access, create a database user with read/write permission for your database. This is separate from your Atlas website login.
3. Under Network Access, allow your development machine's public IP. For a cloud environment, configure its supported egress access; avoid opening access to every IP.
4. Choose Connect → Drivers → Node.js and copy the connection string. Set the database name to `shopkart`. Replace the username and password placeholders; URL-encode special characters in credentials.
5. Put this URI only in your local `backend/.env`. Never commit it or send database credentials in chat.

Atlas may also require allowing your cluster's DNS hostnames through cloud network settings. A connection failure can mean an IP rule, DNS/network access, or credentials issue; check the actual error.

## 2. Configure and install

```sh
cd backend
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the generated random value into `JWT_SECRET` in `.env`. Keep `NODE_ENV=development` locally; production requires HTTPS and `NODE_ENV=production` for Secure cookies. Set `MONGODB_URI` using your chosen MongoDB option. An ignored `.env` may already be prepared in the cloud checkout; preserve it instead of overwriting it.

```sh
npm ci
npm run dev
```

The API uses port 5000 by default. `npm start` runs without file watching. Startup connects to MongoDB and waits for the unique email index before listening. `/health` confirms the HTTP service responds; the API tests below verify actual database/authentication behavior.

## 3. Test in Postman

Set a collection variable `baseUrl` to `http://localhost:5000`. Send JSON with `Content-Type: application/json`. Postman's cookie jar automatically retains the login cookie: use the same hostname for every request and keep cookies enabled.

Import `ShopKart.postman_collection.json` from the project root to get all requests already configured. Run them in order; use a fresh email if John is already registered. The bonus change-password request changes the login password to `newpass123`.

| Method | URL | JSON body / expected result |
| --- | --- | --- |
| POST | `{{baseUrl}}/customers/register` | Body below. 201 with public customer data. |
| POST | `{{baseUrl}}/customers/login` | `{"email":"john@gmail.com","password":"john123"}` → 200 and HttpOnly cookie. |
| GET | `{{baseUrl}}/customers/me` | No body. 200 with profile after login; 401 without cookie. |
| PATCH | `{{baseUrl}}/customers/change-password` | `{"oldPassword":"john123","newPassword":"newpass123"}` → 200, clears cookie and invalidates old tokens. Log in again. |
| POST | `{{baseUrl}}/customers/logout` | No body. Requires login; 200 and expired authentication cookie. |

Registration body:

```json
{
  "fullName": "John Doe",
  "email": "john@gmail.com",
  "password": "john123",
  "phone": "9876543210"
}
```

Try a repeated email (409), missing fields (400), short password (400), incorrect login (401), and profile before login/after logout (401). In login response headers, inspect `Set-Cookie` for `HttpOnly`, `SameSite=Strict`, and `Path=/`. Production additionally sets `Secure`.

To inspect storage, connect MongoDB Compass to your URI and open `shopkart` → `customers`. The password must be a bcrypt hash, never the original password. API responses explicitly include only `_id`, `fullName`, `email`, and `phone`.

## 4. Automated integration tests

With MongoDB running and `.env` configured:

```sh
cd backend
npm test
```

Tests use a uniquely named customer, exercise real HTTP requests and MongoDB, verify the stored bcrypt hash, cookie flags, duplicate email handling, invalid/expired JWT rejection, password changes, and logout. They remove only their own test customer. For isolation, point `MONGODB_URI` to a separate `shopkart_test` database when testing outside this disposable lab environment.

## How the MVC flow works

`index.js` connects the database and starts the server. `app.js` configures JSON, cookies and centralized errors. `routes/customer.routes.js` maps endpoints to controllers. `controllers/customer.controller.js` validates inputs, hashes/compares passwords and sends responses. `models/customer.model.js` defines the MongoDB schema and unique email index. `middlewares/auth.middleware.js` verifies the cookie JWT, loads the customer, and attaches `req.user`. `utils/generateToken.js` signs a one-hour token and sets the cookie.

Registration does not log in automatically. Email is trimmed and lowercased. Passwords are at least six characters and at most 72 UTF-8 bytes because bcrypt ignores bytes beyond its input limit. Phone is a required nonempty string to preserve leading zeros and country codes.

Logout clears the browser cookie, as required by this lab. A copied JWT remains valid until its one-hour expiry; HttpOnly does not provide server-side revocation. Password changes invalidate earlier JWTs by incrementing a version stored in MongoDB. A production service would also need abuse protection, email verification, recovery, monitoring and a deliberate session/revocation strategy. A future React frontend should use a same-origin API proxy so these cookies work without adding cross-origin dependencies.

## Viva preparation

1. **Why bcrypt?** Password hashing is one-way, salted and deliberately expensive. Encryption is reversible with a key, which is unnecessary for password verification.
2. **What is in the JWT?** A customer ID (`sub`), token version, issue time and expiry. A JWT is signed, not encrypted; never place passwords or secrets in it.
3. **Why HttpOnly?** Browser JavaScript cannot read that cookie. The browser still sends it with matching requests. It does not prevent all XSS or CSRF; SameSite adds protection against cross-site requests.
4. **Why exclude passwords?** Even password hashes are sensitive and unnecessary for frontend display. This API uses an explicit public-field allowlist.
5. **Why middleware?** It centralizes authentication before protected controllers run, rejects bad tokens and makes the authenticated customer available through `req.user`.

Use this as a learning project: trace each endpoint through route, middleware, controller and model, then reproduce the Postman checks yourself before your individual submission and viva.
