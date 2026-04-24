/**
 * Chaat Corner — Backend Server
 * Run: node server.js
 * Admin panel: http://localhost:3000/admin.html
 * Customer site: http://localhost:3000
 */

const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;   // ✅ Render sets PORT automatically

// ============================================================
// CONFIG — set these as Environment Variables on Render
// ============================================================
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';  // ⚠️ Set via Render env var
const ORDERS_FILE    = path.join(__dirname, 'orders.json');

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// HELPERS — read/write orders JSON file
// ============================================================
function loadOrders() {
  if (!fs.existsSync(ORDERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
}

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

/**
 * POST /api/order
 * Body: { items: [{name, emoji, price, qty}], subtotal, paymentMethod: 'qr'|'cod' }
 * Creates a new order, saves it, returns the order object.
 */
app.post('/api/order', (req, res) => {
  const { items, subtotal, paymentMethod } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items in order' });
  }
  if (!subtotal || subtotal <= 0) {
    return res.status(400).json({ error: 'Invalid subtotal' });
  }
  if (!['qr', 'cod'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'Invalid payment method' });
  }

  const prefix  = paymentMethod === 'cod' ? 'COD' : 'QR';
  const orderId = `${prefix}-${Date.now()}`;

  const order = {
    id:            orderId,
    items,
    subtotal,
    paymentMethod,
    status:        'pending',    // pending → preparing → ready → done
    createdAt:     new Date().toISOString(),
    updatedAt:     new Date().toISOString(),
  };

  const orders = loadOrders();
  orders.push(order);
  saveOrders(orders);

  console.log(`[NEW ORDER] ${orderId} | ₹${subtotal} | ${paymentMethod.toUpperCase()}`);
  res.status(201).json({ success: true, order });
});

/**
 * GET /api/order/:id
 * Public route — customer can poll their own order status.
 */
app.get('/api/order/:id', (req, res) => {
  const orders = loadOrders();
  const order  = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Return only safe fields to customer
  res.json({
    id:            order.id,
    status:        order.status,
    paymentMethod: order.paymentMethod,
    subtotal:      order.subtotal,
    createdAt:     order.createdAt,
  });
});

// ============================================================
// ADMIN ROUTES  (all require x-admin-password header)
// ============================================================

/**
 * GET /api/admin/orders
 * Returns all orders, newest first.
 * Query params: ?status=pending|preparing|ready|done  (optional filter)
 */
app.get('/api/admin/orders', adminAuth, (req, res) => {
  let orders = loadOrders().reverse(); // newest first

  if (req.query.status) {
    orders = orders.filter(o => o.status === req.query.status);
  }

  res.json(orders);
});

/**
 * GET /api/admin/stats
 * Returns summary stats for the dashboard.
 */
app.get('/api/admin/stats', adminAuth, (req, res) => {
  const orders = loadOrders();

  const stats = {
    total:     orders.length,
    pending:   orders.filter(o => o.status === 'pending').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready:     orders.filter(o => o.status === 'ready').length,
    done:      orders.filter(o => o.status === 'done').length,
    revenue:   orders
                 .filter(o => o.status !== 'cancelled')
                 .reduce((sum, o) => sum + o.subtotal, 0),
    todayOrders: orders.filter(o => {
      const orderDate = new Date(o.createdAt).toDateString();
      return orderDate === new Date().toDateString();
    }).length,
  };

  res.json(stats);
});

/**
 * PATCH /api/admin/orders/:id
 * Update order status.
 * Body: { status: 'preparing'|'ready'|'done'|'cancelled' }
 */
app.patch('/api/admin/orders/:id', adminAuth, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'preparing', 'ready', 'done', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const orders = loadOrders();
  const idx    = orders.findIndex(o => o.id === req.params.id);

  if (idx === -1) return res.status(404).json({ error: 'Order not found' });

  orders[idx].status    = status;
  orders[idx].updatedAt = new Date().toISOString();
  saveOrders(orders);

  console.log(`[STATUS] ${req.params.id} → ${status}`);
  res.json({ success: true, order: orders[idx] });
});

/**
 * DELETE /api/admin/orders/:id
 * Permanently delete an order record.
 */
app.delete('/api/admin/orders/:id', adminAuth, (req, res) => {
  let orders = loadOrders();
  const before = orders.length;
  orders = orders.filter(o => o.id !== req.params.id);

  if (orders.length === before) {
    return res.status(404).json({ error: 'Order not found' });
  }

  saveOrders(orders);
  console.log(`[DELETE] ${req.params.id}`);
  res.json({ success: true });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log('');
  console.log('🌶️  ================================');
  console.log('    CHAAT CORNER SERVER RUNNING');
  console.log('🌶️  ================================');
  console.log(`📱  Customer site : http://localhost:${PORT}`);
  console.log(`📊  Admin panel   : http://localhost:${PORT}/admin.html`);
  console.log('');
  console.log('⚠️   REMINDER: Set your real UPI ID in public/index.html');
  console.log('    Search for: chaatcorner@upi  and replace it');
  console.log('');
});
