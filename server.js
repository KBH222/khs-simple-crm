const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

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
  
  // Workers table
  db.run(`CREATE TABLE IF NOT EXISTS workers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    hourly_rate REAL DEFAULT 0,
    phone TEXT,
    email TEXT,
    address TEXT,
    hire_date DATE,
    status TEXT DEFAULT 'ACTIVE',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Work hours tracking table
  db.run(`CREATE TABLE IF NOT EXISTS work_hours (
    id TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL,
    job_id TEXT,
    work_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_minutes INTEGER DEFAULT 0,
    hours_worked REAL NOT NULL,
    work_type TEXT NOT NULL,
    description TEXT,
    overtime_hours REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES workers (id),
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
  
  // Add sample workers
  const sampleWorkers = [
    {
      id: 'worker-1',
      name: 'Mike Johnson',
      role: 'Foreman',
      hourly_rate: 35.00,
      phone: '(555) 111-2222',
      email: 'mike.j@khsconstruction.com',
      hire_date: '2023-01-15',
      status: 'ACTIVE',
      notes: 'Lead carpenter, 15+ years experience'
    },
    {
      id: 'worker-2',
      name: 'Carlos Rodriguez',
      role: 'Carpenter',
      hourly_rate: 28.00,
      phone: '(555) 333-4444',
      email: 'carlos.r@khsconstruction.com',
      hire_date: '2023-03-20',
      status: 'ACTIVE',
      notes: 'Specialized in finish work'
    },
    {
      id: 'worker-3',
      name: 'David Thompson',
      role: 'Apprentice',
      hourly_rate: 18.00,
      phone: '(555) 555-6666',
      email: 'david.t@khsconstruction.com',
      hire_date: '2024-01-08',
      status: 'ACTIVE',
      notes: 'New hire, eager to learn'
    }
  ];
  
  sampleWorkers.forEach(worker => {
    db.run(`INSERT OR IGNORE INTO workers 
            (id, name, role, hourly_rate, phone, email, hire_date, status, notes, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [worker.id, worker.name, worker.role, worker.hourly_rate, worker.phone, worker.email, 
       worker.hire_date, worker.status, worker.notes, now, now]
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

// Workers API
app.get('/api/workers', (req, res) => {
  const { status } = req.query;
  let query = `SELECT w.*, 
               COUNT(DISTINCT wh.id) as total_entries,
               COALESCE(SUM(wh.hours_worked), 0) as total_hours_worked
               FROM workers w 
               LEFT JOIN work_hours wh ON w.id = wh.worker_id 
               WHERE 1=1`;
  const params = [];
  
  if (status) {
    query += ' AND w.status = ?';
    params.push(status);
  }
  
  query += ' GROUP BY w.id ORDER BY w.name';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

app.post('/api/workers', (req, res) => {
  const { name, role, hourly_rate, phone, email, address, hire_date, notes } = req.body;
  
  if (!name || !role) {
    return res.status(400).json({ error: 'Name and role are required' });
  }
  
  const workerId = generateId('worker');
  const now = new Date().toISOString();
  
  db.run(`INSERT INTO workers 
          (id, name, role, hourly_rate, phone, email, address, hire_date, status, notes, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [workerId, name, role, hourly_rate || 0, phone, email, address, hire_date, 'ACTIVE', notes, now, now],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({
        id: workerId,
        name,
        role,
        hourly_rate: hourly_rate || 0,
        phone,
        email,
        address,
        hire_date,
        status: 'ACTIVE',
        notes,
        created_at: now
      });
    });
});

app.put('/api/workers/:id', (req, res) => {
  const { id } = req.params;
  const { name, role, hourly_rate, phone, email, address, hire_date, status, notes } = req.body;
  
  if (!name || !role) {
    return res.status(400).json({ error: 'Name and role are required' });
  }
  
  const now = new Date().toISOString();
  
  db.run(`UPDATE workers 
          SET name = ?, role = ?, hourly_rate = ?, phone = ?, email = ?, address = ?, 
              hire_date = ?, status = ?, notes = ?, updated_at = ?
          WHERE id = ?`,
    [name, role, hourly_rate, phone, email, address, hire_date, status, notes, now, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Worker not found' });
      }
      
      res.json({ message: 'Worker updated' });
    });
});

app.delete('/api/workers/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM workers WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    
    res.json({ message: 'Worker deleted' });
  });
});

// Work Hours API
app.get('/api/work-hours', (req, res) => {
  const { worker_id, week_start } = req.query;
  let query = `SELECT wh.*, w.name as worker_name, j.title as job_title, c.name as customer_name
               FROM work_hours wh
               LEFT JOIN workers w ON wh.worker_id = w.id
               LEFT JOIN jobs j ON wh.job_id = j.id 
               LEFT JOIN customers c ON j.customer_id = c.id
               WHERE 1=1`;
  const params = [];
  
  if (worker_id) {
    query += ' AND wh.worker_id = ?';
    params.push(worker_id);
  }
  
  if (week_start) {
    // Get records for the week starting from week_start
    query += ' AND wh.work_date >= ? AND wh.work_date <= date(?, "+6 days")';
    params.push(week_start, week_start);
  }
  
  query += ' ORDER BY wh.work_date DESC, wh.start_time';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

app.post('/api/work-hours', (req, res) => {
  const { worker_id, job_id, work_date, start_time, end_time, break_minutes, work_type, description } = req.body;
  
  if (!worker_id || !work_date || !start_time || !end_time || !work_type) {
    return res.status(400).json({ error: 'Worker, date, times, and work type are required' });
  }
  
  // Calculate hours worked
  const startDateTime = new Date(`${work_date}T${start_time}`);
  const endDateTime = new Date(`${work_date}T${end_time}`);
  const totalMinutes = (endDateTime - startDateTime) / (1000 * 60);
  const hoursWorked = Math.round(((totalMinutes - (break_minutes || 0)) / 60) * 100) / 100;
  
  // Calculate overtime (over 8 hours per day)
  const overtimeHours = hoursWorked > 8 ? hoursWorked - 8 : 0;
  
  const hoursId = generateId('hours');
  const now = new Date().toISOString();
  
  db.run(`INSERT INTO work_hours 
          (id, worker_id, job_id, work_date, start_time, end_time, break_minutes, 
           hours_worked, work_type, description, overtime_hours, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hoursId, worker_id, job_id, work_date, start_time, end_time, break_minutes || 0, 
     hoursWorked, work_type, description, overtimeHours, now, now],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({
        id: hoursId,
        worker_id,
        job_id,
        work_date,
        start_time,
        end_time,
        break_minutes: break_minutes || 0,
        hours_worked: hoursWorked,
        work_type,
        description,
        overtime_hours: overtimeHours,
        created_at: now
      });
    });
});

app.put('/api/work-hours/:id', (req, res) => {
  const { id } = req.params;
  const { worker_id, job_id, work_date, start_time, end_time, break_minutes, work_type, description } = req.body;
  
  if (!worker_id || !work_date || !start_time || !end_time || !work_type) {
    return res.status(400).json({ error: 'Worker, date, times, and work type are required' });
  }
  
  // Recalculate hours worked
  const startDateTime = new Date(`${work_date}T${start_time}`);
  const endDateTime = new Date(`${work_date}T${end_time}`);
  const totalMinutes = (endDateTime - startDateTime) / (1000 * 60);
  const hoursWorked = Math.round(((totalMinutes - (break_minutes || 0)) / 60) * 100) / 100;
  const overtimeHours = hoursWorked > 8 ? hoursWorked - 8 : 0;
  
  const now = new Date().toISOString();
  
  db.run(`UPDATE work_hours 
          SET worker_id = ?, job_id = ?, work_date = ?, start_time = ?, end_time = ?, 
              break_minutes = ?, hours_worked = ?, work_type = ?, description = ?, 
              overtime_hours = ?, updated_at = ?
          WHERE id = ?`,
    [worker_id, job_id, work_date, start_time, end_time, break_minutes || 0, 
     hoursWorked, work_type, description, overtimeHours, now, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Work hours entry not found' });
      }
      
      res.json({ message: 'Work hours updated' });
    });
});

app.delete('/api/work-hours/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM work_hours WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Work hours entry not found' });
    }
    
    res.json({ message: 'Work hours deleted' });
  });
});

// Backup Functions
function createBackup(reason = 'manual') {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupName = `crm-backup-${reason}-${timestamp}.db`;
    const backupPath = path.join(__dirname, 'backups', backupName);
    
    // Create backup directory if it doesn't exist
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Copy database file
    const sourcePath = path.join(__dirname, 'crm.db');
    
    if (!fs.existsSync(sourcePath)) {
      return reject(new Error('Source database file not found'));
    }
    
    fs.copyFile(sourcePath, backupPath, (err) => {
      if (err) {
        return reject(err);
      }
      
      console.log(`✅ Backup created: ${backupName}`);
      resolve({
        filename: backupName,
        path: backupPath,
        timestamp: new Date().toISOString(),
        reason: reason,
        size: fs.statSync(backupPath).size
      });
    });
  });
}

function listBackups() {
  return new Promise((resolve, reject) => {
    const backupDir = path.join(__dirname, 'backups');
    
    if (!fs.existsSync(backupDir)) {
      return resolve([]);
    }
    
    fs.readdir(backupDir, (err, files) => {
      if (err) {
        return reject(err);
      }
      
      const backups = files
        .filter(file => file.endsWith('.db'))
        .map(file => {
          const filePath = path.join(backupDir, file);
          const stats = fs.statSync(filePath);
          return {
            filename: file,
            size: stats.size,
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString()
          };
        })
        .sort((a, b) => new Date(b.created) - new Date(a.created));
      
      resolve(backups);
    });
  });
}

function cleanupOldBackups() {
  listBackups().then(backups => {
    // Keep last 10 backups, delete older ones
    const toDelete = backups.slice(10);
    
    toDelete.forEach(backup => {
      const backupPath = path.join(__dirname, 'backups', backup.filename);
      fs.unlink(backupPath, (err) => {
        if (err) {
          console.error(`Failed to delete old backup ${backup.filename}:`, err);
        } else {
          console.log(`🗑️ Deleted old backup: ${backup.filename}`);
        }
      });
    });
  }).catch(err => {
    console.error('Error cleaning up old backups:', err);
  });
}

// Backup API Routes
app.post('/api/backup/create', async (req, res) => {
  try {
    const backup = await createBackup('manual');
    cleanupOldBackups(); // Clean up old backups in background
    res.json({
      success: true,
      backup: backup
    });
  } catch (error) {
    console.error('Backup creation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/backup/list', async (req, res) => {
  try {
    const backups = await listBackups();
    res.json({
      success: true,
      backups: backups
    });
  } catch (error) {
    console.error('Failed to list backups:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/backup/restore', async (req, res) => {
  const { filename } = req.body;
  
  if (!filename) {
    return res.status(400).json({
      success: false,
      error: 'Backup filename is required'
    });
  }
  
  try {
    const backupPath = path.join(__dirname, 'backups', filename);
    const mainDbPath = path.join(__dirname, 'crm.db');
    
    // Check if backup file exists
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({
        success: false,
        error: 'Backup file not found'
      });
    }
    
    // Create a pre-restore backup
    const preRestoreBackup = await createBackup('pre-restore');
    console.log(`🔄 Pre-restore backup created: ${preRestoreBackup.filename}`);
    
    // Close the current database connection
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      }
    });
    
    // Copy backup file to main database file
    fs.copyFileSync(backupPath, mainDbPath);
    
    console.log(`✅ Database restored from: ${filename}`);
    
    // Check if we're in a cloud environment (like Render, Heroku, etc.)
    const isCloudEnvironment = process.env.RENDER || process.env.HEROKU || process.env.NODE_ENV === 'production';
    
    if (isCloudEnvironment) {
      // For cloud deployments, we can't restart the server safely
      // Instead, reconnect to the new database without restarting
      try {
        // Close old connection
        const sqlite3 = require('sqlite3').verbose();
        
        // Create new database connection
        const newDb = new sqlite3.Database('crm.db');
        
        // Replace the global db object (this is a bit hacky but works for cloud)
        Object.setPrototypeOf(db, newDb);
        Object.assign(db, newDb);
        
        console.log('✅ Database reconnected after restore (cloud mode)');
        
        res.json({
          success: true,
          message: 'Database restored successfully! The application has been updated with the restored data.',
          preRestoreBackup: preRestoreBackup.filename,
          cloudMode: true
        });
      } catch (reconnectError) {
        console.error('Database reconnection failed:', reconnectError);
        res.json({
          success: true,
          message: 'Database restored successfully. Please refresh the page to see the restored data.',
          preRestoreBackup: preRestoreBackup.filename,
          requiresRefresh: true
        });
      }
    } else {
      // Local development with PM2 - safe to restart
      res.json({
        success: true,
        message: 'Database restored successfully. Server will restart automatically.',
        preRestoreBackup: preRestoreBackup.filename
      });
      
      // Graceful shutdown to allow PM2 to restart
      setTimeout(() => {
        console.log('🔄 Restarting server after database restore...');
        process.exit(0);
      }, 2000);
    }
    
  } catch (error) {
    console.error('Restore failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Auto backup on server start
createBackup('startup').then(backup => {
  console.log(`🔄 Startup backup created: ${backup.filename}`);
}).catch(err => {
  console.error('Failed to create startup backup:', err);
});

// Schedule daily backups
let dailyBackupInterval;
function scheduleDailyBackup() {
  // Create backup every 24 hours (86400000 milliseconds)
  dailyBackupInterval = setInterval(() => {
    createBackup('daily').then(backup => {
      console.log(`📅 Daily backup created: ${backup.filename}`);
      cleanupOldBackups();
    }).catch(err => {
      console.error('Daily backup failed:', err);
    });
  }, 24 * 60 * 60 * 1000);
}

// Start daily backup scheduling
scheduleDailyBackup();

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
