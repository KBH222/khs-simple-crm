const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

// Database setup
const db = new sqlite3.Database('crm.db');

// Initialize database tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'WORKER',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Customers table
  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    reference TEXT,
    customer_type TEXT DEFAULT 'CURRENT',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Jobs table
  db.run(`CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    project_scope TEXT,
    status TEXT DEFAULT 'QUOTED',
    priority TEXT DEFAULT 'medium',
    total_cost REAL DEFAULT 0,
    start_date DATE,
    end_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers (id)
  )`);
  
  // Add project_scope column if it doesn't exist (for existing databases)
  db.run(`ALTER TABLE jobs ADD COLUMN project_scope TEXT`, (err) => {
    // Ignore error if column already exists
  });

  // Materials table
  db.run(`CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT DEFAULT 'each',
    purchased BOOLEAN DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs (id)
  )`);
  
  // Calendar events table
  db.run(`CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    event_type TEXT DEFAULT 'business',
    customer_id TEXT,
    job_id TEXT,
    all_day BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers (id),
    FOREIGN KEY (job_id) REFERENCES jobs (id)
  )`);
  
  // Create default admin user (simplified)
  const adminId = 'admin-' + Date.now();
  
  db.run(`INSERT OR IGNORE INTO users (id, email, password, name, role) 
          VALUES (?, ?, ?, ?, ?)`,
    [adminId, 'admin@khscrm.com', 'admin123', 'Administrator', 'OWNER']
  );
  
  // Add some sample customers for demo
  const sampleCustomers = [
    {
      id: 'demo-customer-1',
      name: 'John Smith',
      phone: '(555) 123-4567',
      email: 'john.smith@email.com',
      address: '123 Main Street, Anytown, ST 12345',
      notes: 'Regular customer, prefers morning appointments',
      reference: 'HOD',
      customer_type: 'CURRENT'
    },
    {
      id: 'demo-customer-2', 
      name: 'ABC Construction LLC',
      phone: '(555) 987-6543',
      email: 'contact@abcconstruction.com',
      address: '456 Business Park Drive, Anytown, ST 12345',
      notes: 'Commercial client, large projects',
      reference: 'Cust',
      customer_type: 'CURRENT'
    },
    {
      id: 'demo-customer-3',
      name: 'Sarah Johnson', 
      phone: '(555) 456-7890',
      email: 'sarah.j@example.com',
      address: '789 Oak Avenue, Anytown, ST 12345',
      notes: 'Interested in kitchen remodel - follow up needed',
      reference: 'Yelp',
      customer_type: 'LEADS'
    }
  ];
  
  const now = new Date().toISOString();
  sampleCustomers.forEach(customer => {
    db.run(`INSERT OR IGNORE INTO customers 
            (id, name, phone, email, address, notes, reference, customer_type, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [customer.id, customer.name, customer.phone, customer.email, customer.address, 
       customer.notes, customer.reference, customer.customer_type, now, now]
    );
  });
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));


// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Serve static files
app.use(express.static('public'));

// Helper function to generate IDs
function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Simplified - no auth required for now

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'KHS Simple CRM'
  });
});





// Customers API
app.get('/api/customers', (req, res) => {
  const { type } = req.query;
  let query = `SELECT c.*, COUNT(j.id) as job_count 
               FROM customers c 
               LEFT JOIN jobs j ON c.id = j.customer_id 
               WHERE 1=1`;
  const params = [];
  
  if (type && (type === 'CURRENT' || type === 'LEADS')) {
    query += ' AND c.customer_type = ?';
    params.push(type);
  }
  
  query += ' GROUP BY c.id ORDER BY c.name';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Get jobs for each customer
    const customers = rows.map(customer => ({
      ...customer,
      jobs: []
    }));
    
    res.json(customers);
  });
});

app.post('/api/customers', (req, res) => {
  const { name, phone, email, address, notes, reference, customer_type } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  const customerId = generateId('cust');
  const now = new Date().toISOString();
  
  db.run(`INSERT INTO customers 
          (id, name, phone, email, address, notes, reference, customer_type, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [customerId, name, phone, email, address, notes, reference, customer_type || 'CURRENT', now, now],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({
        id: customerId,
        name,
        phone,
        email,
        address,
        notes,
        reference,
        customer_type: customer_type || 'CURRENT',
        job_count: 0,
        jobs: []
      });
    });
});

app.put('/api/customers/:id', (req, res) => {
  const { id } = req.params;
  const { name, phone, email, address, notes, reference, customer_type } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  const now = new Date().toISOString();
  
  db.run(`UPDATE customers 
          SET name = ?, phone = ?, email = ?, address = ?, notes = ?, 
              reference = ?, customer_type = ?, updated_at = ?
          WHERE id = ?`,
    [name, phone, email, address, notes, reference, customer_type, now, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      res.json({
        id,
        name,
        phone,
        email,
        address,
        notes,
        reference,
        customer_type,
        jobs: []
      });
    });
});

app.delete('/api/customers/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM customers WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json({ message: 'Customer deleted' });
  });
});

// Jobs API
app.get('/api/jobs', (req, res) => {
  const { customer_id } = req.query;
  let query = `SELECT j.*, c.name as customer_name 
               FROM jobs j 
               JOIN customers c ON j.customer_id = c.id`;
  const params = [];
  
  if (customer_id) {
    query += ` WHERE j.customer_id = ?`;
    params.push(customer_id);
  }
  
  query += ` ORDER BY j.created_at DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

app.post('/api/jobs', (req, res) => {
  const { customer_id, title, description, status, priority, total_cost, start_date, end_date, notes } = req.body;
  
  if (!customer_id || !title) {
    return res.status(400).json({ error: 'Customer ID and title are required' });
  }
  
  const jobId = generateId('job');
  const now = new Date().toISOString();
  
  db.run(`INSERT INTO jobs 
          (id, customer_id, title, description, status, priority, total_cost, start_date, end_date, notes, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [jobId, customer_id, title, description, status || 'QUOTED', priority || 'medium', 
     total_cost || 0, start_date, end_date, notes, now, now],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({
        id: jobId,
        customer_id,
        title,
        description,
        status: status || 'QUOTED',
        priority: priority || 'medium',
        total_cost: total_cost || 0,
        start_date,
        end_date,
        notes,
        created_at: now
      });
    });
});

// Job detail and deletion
app.get('/api/jobs/:id', (req, res) => {
  const { id } = req.params;
  const query = `SELECT j.*, c.name as customer_name FROM jobs j JOIN customers c ON j.customer_id = c.id WHERE j.id = ?`;
  db.get(query, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(row);
  });
});

app.delete('/api/jobs/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM jobs WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ message: 'Job deleted' });
  });
});

// Update job project scope
app.put('/api/jobs/:id/scope', (req, res) => {
  const { id } = req.params;
  const { project_scope } = req.body;
  
  const now = new Date().toISOString();
  db.run('UPDATE jobs SET project_scope = ?, updated_at = ? WHERE id = ?', 
    [project_scope, now, id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ message: 'Project scope updated' });
  });
});

// Calendar Events API
app.get('/api/calendar/events', (req, res) => {
  const { year, month } = req.query;
  let query = `SELECT e.*, c.name as customer_name, j.title as job_title 
               FROM calendar_events e 
               LEFT JOIN customers c ON e.customer_id = c.id 
               LEFT JOIN jobs j ON e.job_id = j.id`;
  const params = [];
  
  if (year && month) {
    query += ` WHERE strftime('%Y', e.event_date) = ? AND strftime('%m', e.event_date) = ?`;
    params.push(year, month.padStart(2, '0'));
  }
  
  query += ` ORDER BY e.event_date, e.start_time`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

app.post('/api/calendar/events', (req, res) => {
  const { title, description, event_date, start_time, end_time, event_type, customer_id, job_id, all_day } = req.body;
  
  if (!title || !event_date) {
    return res.status(400).json({ error: 'Title and event date are required' });
  }
  
  const eventId = generateId('event');
  const now = new Date().toISOString();
  
  db.run(`INSERT INTO calendar_events 
          (id, title, description, event_date, start_time, end_time, event_type, customer_id, job_id, all_day, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [eventId, title, description, event_date, start_time, end_time, event_type || 'business', 
     customer_id, job_id, all_day || 0, now, now],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({
        id: eventId,
        title,
        description,
        event_date,
        start_time,
        end_time,
        event_type: event_type || 'business',
        customer_id,
        job_id,
        all_day: all_day || 0,
        created_at: now
      });
    });
});

app.put('/api/calendar/events/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, event_date, start_time, end_time, event_type, customer_id, job_id, all_day } = req.body;
  
  if (!title || !event_date) {
    return res.status(400).json({ error: 'Title and event date are required' });
  }
  
  const now = new Date().toISOString();
  
  db.run(`UPDATE calendar_events 
          SET title = ?, description = ?, event_date = ?, start_time = ?, end_time = ?, 
              event_type = ?, customer_id = ?, job_id = ?, all_day = ?, updated_at = ?
          WHERE id = ?`,
    [title, description, event_date, start_time, end_time, event_type, 
     customer_id, job_id, all_day, now, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      res.json({ message: 'Event updated' });
    });
});

app.delete('/api/calendar/events/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM calendar_events WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ message: 'Event deleted' });
  });
});

// Catch-all for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, HOST, () => {
  console.log('');
  console.log('🚀 KHS Simple CRM Server Started!');
  console.log('=====================================');
  console.log(`📍 URL: http://${HOST}:${PORT}`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
  console.log('=====================================');
  console.log('');
});

// Graceful shutdown - with debug info
process.on('SIGINT', () => {
  console.log('\n📴 Received SIGINT - Shutting down server...');
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n📴 Received SIGTERM - Shutting down server...');
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed.');
    process.exit(0);
  });
});

// Log any uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
