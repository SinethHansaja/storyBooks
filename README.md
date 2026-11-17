# 📖 Once Upon a Page: pastel fairytale storybook shop

A complete online bookshop for children's storybooks. It has:

- **Storefront:** an interactive Three.js fairytale hero (a floating castle island and orbiting storybooks you can click), plus shop with search, filters and sorting, 3D book pages, basket drawer, coupons, checkout, order confirmation, accounts, wishlist, reviews, FAQ, and a mobile-first layout.
- **Admin dashboard (`/admin`):** revenue, orders, visitors, conversion, AOV, page views, cart abandonment and new-account KPIs with period comparison. Also performance charts, conversion funnel, best sellers, traffic sources, devices, most-viewed books, a weekday×hour heatmap, top searches, a **real-time activity feed**, visitor-journey explorer, low-stock alerts and orders to fulfil.
- **Management:** books (add, edit, delete, cover upload, publish and feature toggles), orders (status, payment status, CSV export, print), customers (lifetime value and full activity trail), coupons and store settings.
- **Payments:** cash on delivery and bank transfer work today. **PayHere** (Sri Lanka) and **Stripe** are already wired in, so you switch one on when your gateway is approved.

---

## 1. How it's built (and why)

| Layer | Choice | Why |
|---|---|---|
| Front end | React 18 + Vite | Fast, simple, and deploys as static files |
| 3D | Three.js (lazy-loaded) | Only downloads on the homepage, and pauses when off-screen |
| Hosting | **Vercel** | Free tier, global CDN, automatic HTTPS, preview URL for every git push, serverless functions for payments |
| Data | **Supabase** (free tier) | Database, logins, image storage and real-time updates with **no server to maintain** |
| Payments | Vercel serverless functions in `/api` | Keeps gateway secrets off the browser |

### "Do I really need a backend?"
A shop needs **somewhere shared to keep data**. When you upload a book, every visitor has to see it. When a customer orders, you have to see the order. A purely static site can't do that, so the project uses **Supabase as a managed backend**. You never write or run server code. You paste one SQL file and copy two keys.

Until you connect Supabase, the site runs in **Demo mode**. Everything is stored in the current browser, preloaded with sample books and 30 days of fake analytics so you can explore the whole site. *Demo mode is for previewing only. Don't launch on it.*

### Vercel vs. alternatives
**Vercel is the right choice here.** Netlify or Cloudflare Pages would also work. Cloudflare has the most generous free bandwidth, but its functions use a different format. Stick with Vercel unless traffic costs become a concern.

---

## 2. Run it on your computer

Requirements: [Node.js 18+](https://nodejs.org).

```bash
npm install
npm run dev          # http://localhost:5173
```

Demo admin: open `/admin` and sign in with **admin@demo.com / admin123**.

---

## 3. Go live: step by step (about 20 minutes)

### Step 1: Create the database (Supabase)
1. Sign up at **https://supabase.com** and create a **New project**. Pick the region closest to your customers (for Sri Lanka, choose *Singapore* or *Mumbai*).
2. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, then click **Run**.
3. *(Optional)* Run `supabase/seed.sql` to add six sample books.
4. Copy three values:
   - **Project URL**: click the green **Connect** button in the top bar (or go to **Project Settings → Data API**). It looks like `https://abcdefgh.supabase.co`. Use it for both `VITE_SUPABASE_URL` and `SUPABASE_URL`.
   - **Publishable key**: **Project Settings → API Keys → Publishable key** (starts with `sb_publishable_…`). Use it for `VITE_SUPABASE_PUBLISHABLE_KEY`. It's safe in the browser because Row Level Security protects the data.
   - **Secret key**: on the same page under **Secret keys**, click 👁 to reveal it, then copy it (starts with `sb_secret_…`). Use it for `SUPABASE_SECRET_KEY`. **Never share it.** Only the payment functions on Vercel use it.

   > Older projects show `anon` / `service_role` keys under "Legacy API keys". Those still work (`VITE_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`), but Supabase is retiring them, so use the new keys.
5. Go to **Authentication → URL Configuration** and set *Site URL* to your live domain once you have it.
   (Optional: under **Authentication → Providers → Email**, turn off "Confirm email" if you don't want customers to verify their email.)

### Step 2: Put the code on GitHub
```bash
git init && git add . && git commit -m "Once Upon a Page"
# create an empty repo on github.com, then:
git remote add origin https://github.com/YOU/once-upon-a-page.git
git push -u origin main
```

### Step 3: Deploy on Vercel
1. Go to **https://vercel.com → Add New → Project → Import** your GitHub repo.
2. Vercel detects **Vite** automatically (build `npm run build`, output `dist`).
3. Open **Environment Variables** and add the keys from `.env.example`:

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | your Supabase URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` key |
| `VITE_CURRENCY` | `LKR` (or `USD`, etc.) |
| `VITE_LOCALE` | `en-LK` |
| `VITE_PAYMENT_PROVIDER` | `none` for now |
| `SUPABASE_URL` | same URL |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` key |
| `SITE_URL` | `https://your-project.vercel.app` |

4. Click **Deploy**. 🎉

> Changed an environment variable? Go to **Deployments → ⋯ → Redeploy**. `VITE_` values are baked in at build time.

### Step 4: Create your admin account
1. On your live site, open **Account → Create account** and sign up with your own email.
2. In Supabase **SQL Editor**, run:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@yourmail.com';
   ```
3. Sign out, then sign back in. **✨ Admin** now appears in the menu (or go to `/admin`).

### Step 5: Your own domain (optional)
Go to Vercel → Project → **Settings → Domains → Add** and follow the DNS instructions. Then update `SITE_URL` (in Vercel) and the Supabase *Site URL* to match.

---

## 4. Payments

Cash on delivery and bank transfer are on by default. Edit your bank details under **Admin → Settings**.

### When your PayHere account is approved (recommended for Sri Lanka)
1. In the PayHere merchant portal, go to **Settings → Domains & Credentials**, add your domain and copy the **Merchant ID** and **Merchant Secret**.
2. In Vercel, add:
   ```
   VITE_PAYMENT_PROVIDER=payhere
   VITE_PAYHERE_SANDBOX=true        # false when going live
   PAYHERE_MERCHANT_ID=xxxx
   PAYHERE_MERCHANT_SECRET=xxxx
   ```
3. Redeploy, then go to **Admin → Settings → Payments** and turn on **Online card payment**.
4. Test with a sandbox card. The order turns **paid** automatically because PayHere calls `/api/payhere-notify`.
5. When you go live, use your live credentials and set `VITE_PAYHERE_SANDBOX=false`.

**How it stays secure:** the browser only sends the order ID. The server reads the real total from the database, signs it with your secret, and checks PayHere's signature *and* amount before marking the order paid.

### Using Stripe instead
Set `VITE_PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Then add a webhook in Stripe pointing to `https://YOUR-DOMAIN/api/stripe-webhook` for the event `checkout.session.completed`. *(Stripe doesn't onboard Sri Lankan businesses directly. Use it only if you have an eligible entity.)*

### A different gateway?
Copy `api/payhere-checkout.js` and `api/payhere-notify.js`, adapt them to your provider's docs, and add a branch in `src/lib/payments.js`.

---

## 5. Daily use

| Task | Where |
|---|---|
| Add a new book | Admin → Books → **+ Add a book**. Upload a cover photo, or pick an emoji and pastel colour for an illustrated cover |
| Hide a book temporarily | Books → turn off **Live** |
| Put a book on the homepage | Books → turn on **Featured** |
| Run a sale | Set a **Compare-at price** higher than the price (a "Sale" ribbon appears), or create a **Coupon** |
| Process an order | Orders → click the order → change status (*pending → processing → shipped → delivered*) and payment status |
| Export for accounting | Orders / Customers / Live activity → **Export CSV** |
| Change delivery fee or announcement bar | Settings |

---

## 6. Security & limits (what's handled for you)
- **Prices can't be tampered with.** Orders go through the `place_order` database function, which re-prices every item, applies coupons and delivery, and reduces stock on the server.
- **Row Level Security** is on for every table. Customers see only their own orders, only admins can see analytics or edit books, and coupon codes can't be listed by visitors.
- **Secrets** (`SUPABASE_SECRET_KEY`, gateway secrets) exist only in Vercel functions and never reach the browser.
- **Analytics are first-party.** No cookies are sent to third parties, and admin activity isn't counted. If you also want Google Analytics or Meta Pixel for ads, add their snippet to `index.html`.
- **Free tiers:** Supabase gives you 500 MB of database (millions of events) and 1 GB of image storage. Vercel's hobby plan is for **non-commercial** use, so upgrade to **Vercel Pro ($20/mo)** once you're taking real orders, or deploy the same repo on Netlify or Cloudflare Pages.

---

## 7. Project map
```
api/                    serverless functions (payments)
supabase/schema.sql     database, security rules, functions, storage
supabase/seed.sql       optional sample books
src/lib/                config, data layer (demo + Supabase), analytics, payments, cart state
src/components/         layout, Three.js scene, book cards, UI kit
src/pages/              storefront pages
src/pages/admin/        dashboard, charts, books, orders, customers, activity, coupons, settings
src/styles/app.css      the pastel fairytale design system
```

Customise the look by changing the colour variables at the top of `src/styles/app.css`. Edit the categories, age groups and cover palettes in `src/lib/config.js`.
