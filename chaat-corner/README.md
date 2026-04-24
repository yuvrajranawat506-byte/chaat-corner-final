# 🌶️ Chaat Corner

Indian Street Food Ordering System — Express + vanilla HTML/JS.

---

## Project Structure

```
chaat-corner/
├── public/
│   ├── index.html      ← Customer menu & ordering page
│   └── admin.html      ← Admin dashboard (order management)
├── server.js           ← Express backend (serves API + static files)
├── package.json
├── render.yaml         ← Render deployment config
└── .gitignore
```

---

## Local Setup

```bash
npm install
npm start
```

- Customer menu: http://localhost:3000
- Admin panel:   http://localhost:3000/admin.html

---

## Before Going Live — Required Steps

### 1. Set your UPI ID
Open `public/index.html` and find:
```js
const UPI_ID = 'chaatcorner@upi';   // ← replace this
```
Change it to your actual UPI ID (e.g. `yourname@paytm`).

### 2. Set Admin Password via Environment Variable
Do NOT hardcode your password. On Render, go to:
**Dashboard → Your Service → Environment → Add Variable**

| Key              | Value          |
|------------------|----------------|
| ADMIN_PASSWORD   | your-secret-pw |

The app reads `process.env.ADMIN_PASSWORD` automatically.

---

## Deploy on Render

1. Push this folder to a GitHub repo
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Render auto-detects settings from `render.yaml`
5. Add `ADMIN_PASSWORD` in the Environment tab
6. Click **Deploy**

Your live URL will be: `https://chaat-corner.onrender.com`

---

## ⚠️ Critical Warning — Data Persistence

**Orders are stored in `orders.json` on the server's local disk.**

Render's free tier has an **ephemeral filesystem** — this means:
- All orders are **wiped every time** the service restarts or redeploys
- This is fine for testing, but **not suitable for production**

**For production**, replace the file-based storage with a real database:
- **MongoDB Atlas** (free tier, easy to connect)
- **Supabase** (free PostgreSQL)
- **Render PostgreSQL** (add-on, paid)

---

## Payment Methods

- **QR / UPI** — customer scans generated QR and pays via any UPI app
- **Cash on Delivery (COD)** — customer pays cash when order is ready
