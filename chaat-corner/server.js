/**
 * Chaat Corner — Backend Server (MongoDB version)
 */

const express    = require('express');
const path       = require('path');
const { MongoClient } = require('mongodb');

const app  = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// CONFIG — from environment variables
// ============================================================
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const MONGO_URI      = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌  MONGO_URI environment variable is not set. Exiting.');
  process.exit(1);
}

// ============================================================
// MONGODB CONNECTION
// ============================================================
let db;

async function connectDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db('chaat-corner');
  console.log('✅  Connected to MongoDB');
}

function ordersCollection() {
  return db.collection('orders');
}

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// ADMIN AUTH MIDDLEWARE
// ============================================================
function adminAuth(req, res, next) {
  const pwd = req.headers['x-admin-password'];
  if (!pwd || pwd !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ============================================================
// CUSTOMER ROUTES
// ============================================================

// POST /api/order — place a new order
app.post('/api/order', async (req, res) => {
  const { items, subtotal, paymentMethod } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'No items in order' });
  if (!subtotal || subtotal <= 0)
    return res.status(400).json({ error: 'Invalid subtotal' });
  if (!['qr', 'cod'].includes(paymentMethod))
    return res.status(400).json({ error: 'Invalid payment method' });

  const prefix  = paymentMethod === 'cod' ? 'COD' : 'QR';
  const orderId = `${prefix}-${Date.now()}`;

  const order = {
    id:            orderId,
    items,
    subtotal,
    paymentMethod,
    status:        'pending',
    createdAt:     new Date().toISOString(),
    updatedAt:     new Date().toISOString(),
  };

  await ordersCollection().insertOne(order);
  console.log(`[NEW ORDER] ${orderId} | ₹${subtotal} | ${paymentMethod.toUpperCase()}`);
  res.status(201).json({ success: true, order });
});

// GET /api/order/:id — customer polls their order status
app.get('/api/order/:id', async (req, res) => {
  const order = await ordersCollection().findOne({ id: req.params.id });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  res.json({
    id:            order.id,
    status:        order.status,
    paymentMethod: order.paymentMethod,
    subtotal:      order.subtotal,
    createdAt:     order.createdAt,
  });
});

// ============================================================
// ADMIN ROUTES
// ============================================================

// GET /api/admin/orders — all orders, newest first
app.get('/api/admin/orders', adminAuth, async (req, res) => {
  const query = req.query.status ? { status: req.query.status } : {};
  const orders = await ordersCollection()
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();
  res.json(orders);
});

// GET /api/admin/stats — dashboard summary
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  const orders = await ordersCollection().find({}).toArray();

  const today = new Date().toDateString();
  const stats = {
    total:       orders.length,
    pending:     orders.filter(o => o.status === 'pending').length,
    preparing:   orders.filter(o => o.status === 'preparing').length,
    ready:       orders.filter(o => o.status === 'ready').length,
    done:        orders.filter(o => o.status === 'done').length,
    revenue:     orders
                   .filter(o => o.status !== 'cancelled')
                   .reduce((sum, o) => sum + o.subtotal, 0),
    todayOrders: orders.filter(o =>
                   new Date(o.createdAt).toDateString() === today
                 ).length,
  };

  res.json(stats);
});

// PATCH /api/admin/orders/:id — update order status
app.patch('/api/admin/orders/:id', adminAuth, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'preparing', 'ready', 'done', 'cancelled'];

  if (!validStatuses.includes(status))
    return res.status(400).json({ error: 'Invalid status' });

  const result = await ordersCollection().findOneAndUpdate(
    { id: req.params.id },
    { $set: { status, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' }
  );

  if (!result) return res.status(404).json({ error: 'Order not found' });

  console.log(`[STATUS] ${req.params.id} → ${status}`);
  res.json({ success: true, order: result });
});

// DELETE /api/admin/orders/:id — delete an order
app.delete('/api/admin/orders/:id', adminAuth, async (req, res) => {
  const result = await ordersCollection().deleteOne({ id: req.params.id });

  if (result.deletedCount === 0)
    return res.status(404).json({ error: 'Order not found' });

  console.log(`[DELETE] ${req.params.id}`);
  res.json({ success: true });
});

// ============================================================
// START SERVER
// ============================================================
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log('');
    console.log('🌶️  ================================');
    console.log('    CHAAT CORNER SERVER RUNNING');
    console.log('🌶️  ================================');
    console.log(`📱  Customer site : http://localhost:${PORT}`);
    console.log(`📊  Admin panel   : http://localhost:${PORT}/admin.html`);
    console.log('');
  });
}).catch(err => {
  console.error('❌  Failed to connect to MongoDB:', err.message);
  process.exit(1);
});

