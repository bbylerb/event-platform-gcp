import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { query, table } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// ---------- API (ข้อมูลทั้งหมดมาจาก BigQuery ด้วย SQL) ----------

// รายการทัวร์/อีเวนต์ทั้งหมด
app.get('/api/events', async (req, res, next) => {
  try {
    const rows = await query(`SELECT * FROM ${table('events')} ORDER BY date DESC`);
    res.json(rows);
  } catch (e) { next(e); }
});

// รายละเอียด 1 รายการ
app.get('/api/events/:id', async (req, res, next) => {
  try {
    const rows = await query(`SELECT * FROM ${table('events')} WHERE id = @id`, { id: req.params.id });
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// สร้างการจอง (SQL INSERT + หักที่นั่ง ใน transaction เดียว)
app.post('/api/bookings', async (req, res, next) => {
  try {
    const { event_id, event_name, customer_name, phone, email, ticket_count } = req.body || {};
    const tickets = Number(ticket_count) || 0;
    if (!event_id || !customer_name || !phone || !email || tickets < 1) {
      return res.status(400).json({ error: 'invalid_input' });
    }
    const events = await query(`SELECT * FROM ${table('events')} WHERE id = @id`, { id: event_id });
    const ev = events[0];
    if (!ev) return res.status(404).json({ error: 'event_not_found' });
    if ((ev.available_seats ?? 0) < tickets) return res.status(400).json({ error: 'no_seats' });

    const id = crypto.randomUUID();
    const total = (ev.price || 0) * tickets;
    await query(
      `INSERT INTO ${table('bookings')}
         (id, event_id, event_name, event_date, customer_name, phone, email,
          ticket_count, total_price, status, payment_status, payment_method, created_date)
       VALUES (@id, @event_id, @event_name, @event_date, @customer_name, @phone, @email,
          @ticket_count, @total_price, 'pending', 'pending', 'PromptPay QR', CURRENT_TIMESTAMP());
       UPDATE ${table('events')} SET available_seats = available_seats - @ticket_count
       WHERE id = @event_id;`,
      {
        id, event_id, event_name: event_name || ev.name_en, event_date: ev.date,
        customer_name, phone, email, ticket_count: tickets, total_price: total,
      }
    );
    res.json({ id, total_price: total, status: 'pending', payment_status: 'pending' });
  } catch (e) { next(e); }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---------- เสิร์ฟหน้าเว็บ (build จาก Vite) ----------
const distDir = path.join(__dirname, '..', 'dist');
app.use(express.static(distDir));
app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'server_error', details: String(err.message || err) });
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`EventWise server on :${port}`));
