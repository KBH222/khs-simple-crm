const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Database setup with error handling
let db;
let dbInitialized = false;

// Promise-based database initialization
const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    try {
      // Use persistent volume path for database in production
      const dbPath = process.env.RAILWAY_ENVIRONMENT ? '/app/data/crm.db' : 'crm.db';
      
      // Ensure directory exists for Railway deployment
      if (process.env.RAILWAY_ENVIRONMENT) {
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
          console.log(`📁 Created database directory: ${dbDir}`);
        }
      }
      
      console.log(`🔗 Connecting to database at: ${dbPath}`);
      
      db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Failed to connect to database:', err);
          reject(err);
        } else {
          console.log('✅ Connected to SQLite database');
          dbInitialized = true;
          resolve();
        }
      });
    } catch (error) {
      console.error('Database initialization error:', error);
      reject(error);
    }
  });
};

// Initialize database tables
const initializeTables = () => {
  return new Promise((resolve, reject) => {
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
  
  // Add initials column if it doesn't exist (for existing databases)
  db.run(`ALTER TABLE workers ADD COLUMN initials TEXT`, (err) => {
    // Ignore error if column already exists
  });
  
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
  
  // Tasks table
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    description TEXT NOT NULL,
    completed BOOLEAN DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs (id)
  )`);
  
  // Tools table - Similar to tasks but for tools needed for each job
  db.run(`CREATE TABLE IF NOT EXISTS tools (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    description TEXT NOT NULL,
    completed BOOLEAN DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs (id)
  )`);
  
  // Extra costs table
  db.run(`CREATE TABLE IF NOT EXISTS extra_costs (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs (id)
  )`);
  
  // Job photos table
  db.run(`CREATE TABLE IF NOT EXISTS job_photos (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    photo_type TEXT DEFAULT 'pics',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs (id)
  )`);
  
  // Worker tasks table
  db.run(`CREATE TABLE IF NOT EXISTS worker_tasks (
    id TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL,
    job_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'medium',
    due_date DATE,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES workers (id),
    FOREIGN KEY (job_id) REFERENCES jobs (id)
  )`);
  
  // Worker notes table
  db.run(`CREATE TABLE IF NOT EXISTS worker_notes (
    id TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_private BOOLEAN DEFAULT 0,
    created_by TEXT DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES workers (id)
  )`);
  
  // Create default admin user (only if none exists)
  db.get("SELECT COUNT(*) as count FROM users WHERE role = 'OWNER'", (err, row) => {
    if (err) {
      console.error('Error checking admin users:', err);
      return;
    }
    
    if (row.count === 0) {
      const adminId = 'admin-' + Date.now();
      db.run(`INSERT INTO users (id, email, password, name, role) 
              VALUES (?, ?, ?, ?, ?)`,
        [adminId, 'admin@khscrm.com', 'admin123', 'Administrator', 'OWNER'],
        (err) => {
          if (err) {
            console.error('Error creating admin user:', err);
          } else {
            console.log('✅ Created default admin user');
          }
        }
      );
    }
  });
  
  // Check for data import on startup
  console.log('🔍 Checking for data import file...');
  importUserData().then(result => {
    if (result.imported) {
      console.log(`🎯 Automatically imported ${result.recordCount} records from data-export.json`);
    } else {
      console.log('📋 No import file found - starting with clean database');
    }
  }).catch(err => {
    console.error('Import error:', err);
  });
    
      // Resolve the promise after all tables are created
      resolve();
    });
  });
};

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

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const jobId = req.params.jobId;
    const uploadDir = path.join(__dirname, 'uploads', 'photos', jobId);
    
    // Create directory if it doesn't exist
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and random hash
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images and some document types
  const allowedMimes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'image/heic', 'image/heif', 'image/bmp', 'image/tiff',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files and PDFs are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

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

// Tasks API
app.get('/api/jobs/:jobId/tasks', (req, res) => {
  const { jobId } = req.params;
  db.all('SELECT * FROM tasks WHERE job_id = ? ORDER BY sort_order, created_at', [jobId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

app.post('/api/jobs/:jobId/tasks', (req, res) => {
  const { jobId } = req.params;
  const { description } = req.body;
  
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Task description is required' });
  }
  
  const taskId = generateId('task');
  const now = new Date().toISOString();
  
  // Get max sort_order for this job
  db.get('SELECT MAX(sort_order) as max_order FROM tasks WHERE job_id = ?', [jobId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    const sortOrder = (row.max_order || 0) + 1;
    
    db.run('INSERT INTO tasks (id, job_id, description, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [taskId, jobId, description.trim(), sortOrder, now, now],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({
          id: taskId,
          job_id: jobId,
          description: description.trim(),
          completed: 0,
          sort_order: sortOrder,
          created_at: now
        });
      }
    );
  });
});

app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { completed, description } = req.body;
  
  const now = new Date().toISOString();
  let query = 'UPDATE tasks SET updated_at = ?';
  let params = [now];
  
  if (typeof completed !== 'undefined') {
    query += ', completed = ?';
    params.push(completed ? 1 : 0);
  }
  
  if (description && description.trim()) {
    query += ', description = ?';
    params.push(description.trim());
  }
  
  query += ' WHERE id = ?';
  params.push(id);
  
  db.run(query, params, function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task updated' });
  });
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted' });
  });
});

// Update task order
app.put('/api/jobs/:jobId/tasks/reorder', (req, res) => {
  const { jobId } = req.params;
  const { taskIds } = req.body; // Array of task IDs in new order
  
  if (!Array.isArray(taskIds)) {
    return res.status(400).json({ error: 'Task IDs array is required' });
  }
  
  const now = new Date().toISOString();
  
  // Update each task's sort_order
  const promises = taskIds.map((taskId, index) => {
    return new Promise((resolve, reject) => {
      db.run('UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ? AND job_id = ?',
        [index + 1, now, taskId, jobId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  });
  
  Promise.all(promises)
    .then(() => res.json({ message: 'Task order updated' }))
    .catch(err => res.status(500).json({ error: 'Database error' }));
});

// Tools API - Similar to Tasks API
app.get('/api/jobs/:jobId/tools', (req, res) => {
  const { jobId } = req.params;
  db.all('SELECT * FROM tools WHERE job_id = ? ORDER BY sort_order, created_at', [jobId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

app.post('/api/jobs/:jobId/tools', (req, res) => {
  const { jobId } = req.params;
  const { description } = req.body;
  
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Tool description is required' });
  }
  
  const toolId = generateId('tool');
  const now = new Date().toISOString();
  
  // Get max sort_order for this job
  db.get('SELECT MAX(sort_order) as max_order FROM tools WHERE job_id = ?', [jobId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    const sortOrder = (row.max_order || 0) + 1;
    
    db.run('INSERT INTO tools (id, job_id, description, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [toolId, jobId, description.trim(), sortOrder, now, now],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({
          id: toolId,
          job_id: jobId,
          description: description.trim(),
          completed: 0,
          sort_order: sortOrder,
          created_at: now
        });
      }
    );
  });
});

app.put('/api/tools/:id', (req, res) => {
  const { id } = req.params;
  const { completed, description } = req.body;
  
  const now = new Date().toISOString();
  let query = 'UPDATE tools SET updated_at = ?';
  let params = [now];
  
  if (typeof completed !== 'undefined') {
    query += ', completed = ?';
    params.push(completed ? 1 : 0);
  }
  
  if (description && description.trim()) {
    query += ', description = ?';
    params.push(description.trim());
  }
  
  query += ' WHERE id = ?';
  params.push(id);
  
  db.run(query, params, function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    res.json({ message: 'Tool updated' });
  });
});

app.delete('/api/tools/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM tools WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    res.json({ message: 'Tool deleted' });
  });
});

// Update tool order
app.put('/api/jobs/:jobId/tools/reorder', (req, res) => {
  const { jobId } = req.params;
  const { toolIds } = req.body; // Array of tool IDs in new order
  
  if (!Array.isArray(toolIds)) {
    return res.status(400).json({ error: 'Tool IDs array is required' });
  }
  
  const now = new Date().toISOString();
  
  // Update each tool's sort_order
  const promises = toolIds.map((toolId, index) => {
    return new Promise((resolve, reject) => {
      db.run('UPDATE tools SET sort_order = ?, updated_at = ? WHERE id = ? AND job_id = ?',
        [index + 1, now, toolId, jobId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  });
  
  Promise.all(promises)
    .then(() => res.json({ message: 'Tool order updated' }))
    .catch(err => res.status(500).json({ error: 'Database error' }));
});

// Extra Costs API
app.get('/api/jobs/:jobId/extra-costs', (req, res) => {
  const { jobId } = req.params;
  db.all('SELECT * FROM extra_costs WHERE job_id = ? ORDER BY sort_order, created_at', [jobId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

app.post('/api/jobs/:jobId/extra-costs', (req, res) => {
  const { jobId } = req.params;
  const { description, amount } = req.body;
  
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }
  
  if (typeof amount !== 'number' || amount < 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }
  
  const costId = generateId('cost');
  const now = new Date().toISOString();
  
  // Get max sort_order for this job
  db.get('SELECT MAX(sort_order) as max_order FROM extra_costs WHERE job_id = ?', [jobId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    const sortOrder = (row.max_order || 0) + 1;
    
    db.run('INSERT INTO extra_costs (id, job_id, description, amount, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [costId, jobId, description.trim(), amount, sortOrder, now, now],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({
          id: costId,
          job_id: jobId,
          description: description.trim(),
          amount: amount,
          sort_order: sortOrder,
          created_at: now
        });
      }
    );
  });
});

app.delete('/api/extra-costs/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM extra_costs WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Extra cost not found' });
    }
    res.json({ message: 'Extra cost deleted' });
  });
});

// Photo API
app.get('/api/jobs/:jobId/photos', (req, res) => {
  const { jobId } = req.params;
  const { type } = req.query; // 'pics' or 'plans'
  
  let query = 'SELECT * FROM job_photos WHERE job_id = ?';
  const params = [jobId];
  
  if (type && (type === 'pics' || type === 'plans')) {
    query += ' AND photo_type = ?';
    params.push(type);
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

app.post('/api/jobs/:jobId/photos', upload.array('photos', 20), (req, res) => {
  const { jobId } = req.params;
  const { photoType = 'pics' } = req.body;
  
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  
  // Verify job exists
  db.get('SELECT id FROM jobs WHERE id = ?', [jobId], (err, job) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const now = new Date().toISOString();
    const uploadedFiles = [];
    let processedCount = 0;
    
    // Process each uploaded file
    req.files.forEach(file => {
      const photoId = generateId('photo');
      const filePath = path.relative(__dirname, file.path);
      
      db.run(`INSERT INTO job_photos 
              (id, job_id, filename, original_name, file_path, file_size, mime_type, photo_type, created_at) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [photoId, jobId, file.filename, file.originalname, filePath, file.size, file.mimetype, photoType, now],
        function(err) {
          if (err) {
            console.error('Failed to save photo metadata:', err);
            // Clean up uploaded file if database save fails
            fs.unlink(file.path, () => {});
          } else {
            uploadedFiles.push({
              id: photoId,
              job_id: jobId,
              filename: file.filename,
              original_name: file.originalname,
              file_path: filePath,
              file_size: file.size,
              mime_type: file.mimetype,
              photo_type: photoType,
              created_at: now
            });
          }
          
          processedCount++;
          if (processedCount === req.files.length) {
            res.json({
              message: `Uploaded ${uploadedFiles.length} of ${req.files.length} files successfully`,
              photos: uploadedFiles
            });
          }
        }
      );
    });
  });
});

app.get('/api/photos/:photoId', (req, res) => {
  const { photoId } = req.params;
  
  db.get('SELECT * FROM job_photos WHERE id = ?', [photoId], (err, photo) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    
    const filePath = path.join(__dirname, photo.file_path);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Photo file not found' });
    }
    
    // Set appropriate headers
    res.set({
      'Content-Type': photo.mime_type,
      'Content-Length': photo.file_size,
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      'Content-Disposition': `inline; filename="${photo.original_name}"`
    });
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (streamErr) => {
      console.error('Error streaming photo:', streamErr);
      res.status(500).json({ error: 'Error serving photo' });
    });
  });
});

app.delete('/api/photos/:photoId', (req, res) => {
  const { photoId } = req.params;
  
  // Get photo info first
  db.get('SELECT * FROM job_photos WHERE id = ?', [photoId], (err, photo) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    
    // Delete from database
    db.run('DELETE FROM job_photos WHERE id = ?', [photoId], function(dbErr) {
      if (dbErr) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Try to delete the physical file
      const filePath = path.join(__dirname, photo.file_path);
      fs.unlink(filePath, (fsErr) => {
        if (fsErr) {
          console.error('Failed to delete photo file:', fsErr);
          // Don't fail the request if file deletion fails - database record is gone
        }
      });
      
      res.json({ message: 'Photo deleted' });
    });
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
  const { name, role, hourly_rate, phone, email, address, hire_date, notes, initials } = req.body;
  
  if (!name || !role) {
    return res.status(400).json({ error: 'Name and role are required' });
  }
  
  const workerId = generateId('worker');
  const now = new Date().toISOString();
  
  db.run(`INSERT INTO workers 
          (id, name, role, hourly_rate, phone, email, address, hire_date, status, notes, initials, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [workerId, name, role, hourly_rate || 0, phone, email, address, hire_date, 'ACTIVE', notes, initials, now, now],
    function(err) {
      if (err) {
        console.error('Database error creating worker:', err);
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
        initials,
        created_at: now
      });
    });
});

app.put('/api/workers/:id', (req, res) => {
  const { id } = req.params;
  const { name, role, hourly_rate, phone, email, address, hire_date, status, notes, initials } = req.body;
  
  if (!name || !role) {
    return res.status(400).json({ error: 'Name and role are required' });
  }
  
  const now = new Date().toISOString();
  
  db.run(`UPDATE workers 
          SET name = ?, role = ?, hourly_rate = ?, phone = ?, email = ?, address = ?, 
              hire_date = ?, status = ?, notes = ?, initials = ?, updated_at = ?
          WHERE id = ?`,
    [name, role, hourly_rate, phone, email, address, hire_date, status, notes, initials, now, id],
    function(err) {
      if (err) {
        console.error('Database error updating worker:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Worker not found' });
      }
      
      res.json({ message: 'Worker updated', id, name, role, initials });
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
      return res.status(404).json({ error: 'Hours entry not found' });
    }
    
    res.json({ message: 'Hours deleted' });
  });
});

// USPS Address Validation API
app.post('/api/validate-address', async (req, res) => {
  const { street, city, state, zip } = req.body;
  
  if (!street) {
    return res.status(400).json({ error: 'Street address is required' });
  }
  
  try {
    // For now, return a mock response until USPS credentials are added
    // This will be replaced with actual USPS API call
    
    // Mock Hawaiian address validation
    const mockValidation = {
      street: street.trim(),
      city: city || 'Honolulu', // Default fallback
      state: 'HI',
      zip: zip || '96815' // Default Honolulu ZIP
    };
    
    console.log('Address validation request:', { street, city, state, zip });
    console.log('Mock validation response:', mockValidation);
    
    res.json({
      valid: true,
      address: mockValidation,
      source: 'mock' // Will be 'usps' when real API is implemented
    });
    
  } catch (error) {
    console.error('Address validation error:', error);
    res.status(500).json({ error: 'Address validation failed' });
  }
});

// Timesheet API - for bulk weekly timesheet submissions
app.post('/api/timesheet', (req, res) => {
  const { worker_id, week_start, timesheet_entries } = req.body;
  
  if (!worker_id || !week_start || !Array.isArray(timesheet_entries)) {
    return res.status(400).json({ error: 'Worker ID, week start date, and timesheet entries are required' });
  }
  
  // Begin transaction
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    let completed = 0;
    let hasError = false;
    const total = timesheet_entries.length;
    
    if (total === 0) {
      db.run('COMMIT');
      return res.json({ message: 'No entries to save' });
    }
    
    timesheet_entries.forEach((entry, index) => {
      const { day_of_week, work_date, start_time, end_time, lunch_minutes, job_location, work_type, notes } = entry;
      
      // Skip entries without required data
      if (!work_date || !start_time || !end_time || !work_type) {
        completed++;
        if (completed === total && !hasError) {
          db.run('COMMIT');
          res.json({ message: 'Timesheet saved successfully' });
        }
        return;
      }
      
      // Calculate hours worked
      const startDateTime = new Date(`${work_date}T${start_time}`);
      const endDateTime = new Date(`${work_date}T${end_time}`);
      const totalMinutes = (endDateTime - startDateTime) / (1000 * 60);
      const hoursWorked = Math.round(((totalMinutes - (lunch_minutes || 0)) / 60) * 100) / 100;
      
      // Calculate overtime (over 8 hours per day)
      const overtimeHours = hoursWorked > 8 ? hoursWorked - 8 : 0;
      
      const hoursId = generateId('hours');
      const now = new Date().toISOString();
      
      // Check if entry already exists for this date/worker
      db.get(`SELECT id FROM work_hours WHERE worker_id = ? AND work_date = ?`, [worker_id, work_date], (err, existing) => {
        if (err && !hasError) {
          hasError = true;
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Database error checking existing entries' });
        }
        
        if (existing) {
          // Update existing entry
          db.run(`UPDATE work_hours 
                  SET start_time = ?, end_time = ?, break_minutes = ?, hours_worked = ?, 
                      work_type = ?, description = ?, overtime_hours = ?, updated_at = ?
                  WHERE id = ?`,
            [start_time, end_time, lunch_minutes || 0, hoursWorked, work_type, 
             `${job_location ? 'Location: ' + job_location + '. ' : ''}${notes || ''}`, 
             overtimeHours, now, existing.id],
            function(updateErr) {
              if (updateErr && !hasError) {
                hasError = true;
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Database error updating timesheet' });
              }
              
              completed++;
              if (completed === total && !hasError) {
                db.run('COMMIT');
                res.json({ message: 'Timesheet updated successfully' });
              }
            });
        } else {
          // Insert new entry
          db.run(`INSERT INTO work_hours 
                  (id, worker_id, job_id, work_date, start_time, end_time, break_minutes, 
                   hours_worked, work_type, description, overtime_hours, created_at, updated_at) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [hoursId, worker_id, null, work_date, start_time, end_time, lunch_minutes || 0, 
             hoursWorked, work_type, 
             `${job_location ? 'Location: ' + job_location + '. ' : ''}${notes || ''}`, 
             overtimeHours, now, now],
            function(insertErr) {
              if (insertErr && !hasError) {
                hasError = true;
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Database error saving timesheet' });
              }
              
              completed++;
              if (completed === total && !hasError) {
                db.run('COMMIT');
                res.json({ message: 'Timesheet saved successfully' });
              }
            });
        }
      });
    });
  });
});

// Timesheet submit endpoint (alias for POST /api/timesheet)
app.post('/api/timesheet/submit', (req, res) => {
  const { entries } = req.body;
  
  if (!entries || !Array.isArray(entries)) {
    return res.status(400).json({ error: 'Entries array is required' });
  }
  
  if (entries.length === 0) {
    return res.json({ message: 'No entries to save' });
  }
  
  // Begin transaction
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    let completed = 0;
    let hasError = false;
    const total = entries.length;
    
    entries.forEach((entry) => {
      const { worker_id, work_date, start_time, end_time, break_minutes, work_type, job_location, description } = entry;
      
      // Skip entries without required data
      if (!worker_id || !work_date || !start_time || !end_time || !work_type) {
        completed++;
        if (completed === total && !hasError) {
          db.run('COMMIT');
          res.json({ message: 'Timesheet saved successfully' });
        }
        return;
      }
      
      // Calculate hours worked
      const startDateTime = new Date(`${work_date}T${start_time}`);
      const endDateTime = new Date(`${work_date}T${end_time}`);
      const totalMinutes = (endDateTime - startDateTime) / (1000 * 60);
      const hoursWorked = Math.max(0, Math.round(((totalMinutes - (break_minutes || 0)) / 60) * 100) / 100);
      
      // Calculate overtime (over 8 hours per day)
      const overtimeHours = hoursWorked > 8 ? hoursWorked - 8 : 0;
      
      const hoursId = generateId('hours');
      const now = new Date().toISOString();
      
      // Check if entry already exists for this date/worker
      db.get(`SELECT id FROM work_hours WHERE worker_id = ? AND work_date = ?`, [worker_id, work_date], (err, existing) => {
        if (err && !hasError) {
          hasError = true;
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Database error checking existing entries' });
        }
        
        const fullDescription = `${job_location ? 'Location: ' + job_location + '. ' : ''}${description || ''}`;
        
        if (existing) {
          // Update existing entry
          db.run(`UPDATE work_hours 
                  SET start_time = ?, end_time = ?, break_minutes = ?, hours_worked = ?, 
                      work_type = ?, description = ?, overtime_hours = ?, updated_at = ?
                  WHERE id = ?`,
            [start_time, end_time, break_minutes || 0, hoursWorked, work_type, 
             fullDescription, overtimeHours, now, existing.id],
            function(updateErr) {
              if (updateErr && !hasError) {
                hasError = true;
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Database error updating timesheet' });
              }
              
              completed++;
              if (completed === total && !hasError) {
                db.run('COMMIT');
                res.json({ message: 'Timesheet saved successfully' });
              }
            });
        } else {
          // Insert new entry
          db.run(`INSERT INTO work_hours 
                  (id, worker_id, job_id, work_date, start_time, end_time, break_minutes, 
                   hours_worked, work_type, description, overtime_hours, created_at, updated_at) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [hoursId, worker_id, null, work_date, start_time, end_time, break_minutes || 0, 
             hoursWorked, work_type, fullDescription, overtimeHours, now, now],
            function(insertErr) {
              if (insertErr && !hasError) {
                hasError = true;
                db.run('ROLLBACK');
                console.error('Insert error:', insertErr);
                return res.status(500).json({ error: 'Database error saving timesheet' });
              }
              
              completed++;
              if (completed === total && !hasError) {
                db.run('COMMIT');
                res.json({ message: 'Timesheet saved successfully' });
              }
            });
        }
      });
    });
  });
});

// Get timesheet data for a specific worker and week
app.get('/api/timesheet', (req, res) => {
  const { worker_id, week_start } = req.query;
  
  if (!worker_id || !week_start) {
    return res.status(400).json({ error: 'Worker ID and week start date are required' });
  }
  
  const query = `SELECT * FROM work_hours 
                 WHERE worker_id = ? 
                 AND work_date >= ? 
                 AND work_date <= date(?, "+6 days")
                 ORDER BY work_date`;
  
  db.all(query, [worker_id, week_start, week_start], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Transform the data into weekly grid format
    const weeklyData = {};
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    // Initialize empty week
    daysOfWeek.forEach(day => {
      weeklyData[day] = {
        work_date: '',
        start_time: '',
        end_time: '',
        lunch_minutes: 0,
        job_location: '',
        work_type: '',
        notes: '',
        hours_worked: 0
      };
    });
    
    // Fill in actual data
    rows.forEach(row => {
      const workDate = new Date(row.work_date + 'T00:00:00');
      const dayOfWeek = daysOfWeek[workDate.getDay()];
      
      // Parse job location from description
      let jobLocation = '';
      let notes = row.description || '';
      if (notes.startsWith('Location: ')) {
        const locationEnd = notes.indexOf('. ');
        if (locationEnd > -1) {
          jobLocation = notes.substring(10, locationEnd);
          notes = notes.substring(locationEnd + 2);
        } else {
          jobLocation = notes.substring(10);
          notes = '';
        }
      }
      
      weeklyData[dayOfWeek] = {
        work_date: row.work_date,
        start_time: row.start_time,
        end_time: row.end_time,
        lunch_minutes: row.break_minutes || 0,
        job_location: jobLocation,
        work_type: row.work_type,
        notes: notes,
        hours_worked: row.hours_worked
      };
    });
    
    res.json(weeklyData);
  });
});

// Data Export/Import Functions
function exportUserData() {
  return new Promise((resolve, reject) => {
    const exportData = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      data: {
        customers: [],
        jobs: [],
        workers: [],
        work_hours: [],
        tasks: [],
        extra_costs: [],
        calendar_events: [],
        materials: [],
        job_photos: [],
        worker_tasks: [],
        worker_notes: []
      }
    };
    
    // Export all user data tables
    const queries = [
      { table: 'customers', query: 'SELECT * FROM customers WHERE id NOT LIKE "demo-%"' },
      { table: 'jobs', query: 'SELECT * FROM jobs WHERE customer_id NOT IN (SELECT id FROM customers WHERE id LIKE "demo-%")' },
      { table: 'workers', query: 'SELECT * FROM workers WHERE id NOT LIKE "worker-%"' },
      { table: 'work_hours', query: 'SELECT * FROM work_hours WHERE worker_id NOT IN (SELECT id FROM workers WHERE id LIKE "worker-%")' },
      { table: 'tasks', query: 'SELECT * FROM tasks WHERE job_id NOT IN (SELECT id FROM jobs WHERE customer_id IN (SELECT id FROM customers WHERE id LIKE "demo-%"))' },
      { table: 'extra_costs', query: 'SELECT * FROM extra_costs WHERE job_id NOT IN (SELECT id FROM jobs WHERE customer_id IN (SELECT id FROM customers WHERE id LIKE "demo-%"))' },
      { table: 'calendar_events', query: 'SELECT * FROM calendar_events WHERE customer_id NOT IN (SELECT id FROM customers WHERE id LIKE "demo-%") OR customer_id IS NULL' },
      { table: 'materials', query: 'SELECT * FROM materials WHERE job_id NOT IN (SELECT id FROM jobs WHERE customer_id IN (SELECT id FROM customers WHERE id LIKE "demo-%"))' },
      { table: 'job_photos', query: 'SELECT * FROM job_photos WHERE job_id NOT IN (SELECT id FROM jobs WHERE customer_id IN (SELECT id FROM customers WHERE id LIKE "demo-%"))' },
      { table: 'worker_tasks', query: 'SELECT * FROM worker_tasks WHERE worker_id NOT IN (SELECT id FROM workers WHERE id LIKE "worker-%")' },
      { table: 'worker_notes', query: 'SELECT * FROM worker_notes WHERE worker_id NOT IN (SELECT id FROM workers WHERE id LIKE "worker-%")' }
    ];
    
    let completedQueries = 0;
    
    queries.forEach(({ table, query }) => {
      db.all(query, (err, rows) => {
        if (err) {
          console.error(`Error exporting ${table}:`, err);
          return reject(err);
        }
        
        exportData.data[table] = rows;
        completedQueries++;
        
        if (completedQueries === queries.length) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          const exportPath = path.join(__dirname, 'data-export.json');
          
          fs.writeFile(exportPath, JSON.stringify(exportData, null, 2), (err) => {
            if (err) {
              return reject(err);
            }
            
            console.log(`✅ User data exported to: data-export.json`);
            console.log(`📊 Exported ${Object.values(exportData.data).reduce((sum, arr) => sum + arr.length, 0)} records`);
            
            resolve({
              filename: 'data-export.json',
              path: exportPath,
              timestamp: exportData.timestamp,
              recordCount: Object.values(exportData.data).reduce((sum, arr) => sum + arr.length, 0)
            });
          });
        }
      });
    });
  });
}

function importUserData() {
  return new Promise((resolve, reject) => {
    const importPath = path.join(__dirname, 'data-export.json');
    
    if (!fs.existsSync(importPath)) {
      return resolve({ imported: false, message: 'No export file found' });
    }
    
    fs.readFile(importPath, 'utf8', (err, data) => {
      if (err) {
        return reject(err);
      }
      
      try {
        const importData = JSON.parse(data);
        
        if (!importData.data) {
          return reject(new Error('Invalid export file format'));
        }
        
        console.log(`📥 Importing user data from ${importData.timestamp}`);
        
        // Import data in the correct order to respect foreign key constraints
        const importOrder = [
          'customers',
          'workers', 
          'jobs',
          'tasks',
          'extra_costs',
          'calendar_events',
          'materials',
          'job_photos',
          'work_hours',
          'worker_tasks',
          'worker_notes'
        ];
        
        let totalImported = 0;
        let currentIndex = 0;
        
        function importNext() {
          if (currentIndex >= importOrder.length) {
            console.log(`✅ User data import completed: ${totalImported} records`);
            
            // Move the import file to prevent re-import
            const completedPath = path.join(__dirname, `data-export-imported-${Date.now()}.json`);
            fs.rename(importPath, completedPath, (err) => {
              if (err) console.error('Error moving import file:', err);
            });
            
            return resolve({ imported: true, recordCount: totalImported });
          }
          
          const table = importOrder[currentIndex];
          const records = importData.data[table] || [];
          
          if (records.length === 0) {
            currentIndex++;
            return importNext();
          }
          
          console.log(`📋 Importing ${records.length} ${table} records`);
          
          // Generate INSERT statements based on table structure
          const insertStatements = {
            customers: 'INSERT INTO customers (id, name, phone, email, address, notes, reference, customer_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            jobs: 'INSERT INTO jobs (id, customer_id, title, description, project_scope, status, priority, total_cost, start_date, end_date, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            workers: 'INSERT INTO workers (id, name, role, hourly_rate, phone, email, address, hire_date, status, notes, initials, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            work_hours: 'INSERT INTO work_hours (id, worker_id, job_id, work_date, start_time, end_time, break_minutes, hours_worked, work_type, description, overtime_hours, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            tasks: 'INSERT INTO tasks (id, job_id, description, completed, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            extra_costs: 'INSERT INTO extra_costs (id, job_id, description, amount, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            calendar_events: 'INSERT INTO calendar_events (id, title, description, event_date, start_time, end_time, event_type, customer_id, job_id, all_day, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            materials: 'INSERT INTO materials (id, job_id, item_name, quantity, unit, purchased, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            job_photos: 'INSERT INTO job_photos (id, job_id, filename, original_name, file_path, file_size, mime_type, photo_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            worker_tasks: 'INSERT INTO worker_tasks (id, worker_id, job_id, title, description, status, priority, due_date, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            worker_notes: 'INSERT INTO worker_notes (id, worker_id, category, title, content, is_private, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          };
          
          const stmt = db.prepare(insertStatements[table]);
          
          records.forEach(record => {
            const values = Object.values(record);
            stmt.run(values, (err) => {
              if (err) {
                console.error(`Error importing ${table} record:`, err);
              } else {
                totalImported++;
              }
            });
          });
          
          stmt.finalize((err) => {
            if (err) {
              console.error(`Error finalizing ${table} import:`, err);
            }
            currentIndex++;
            importNext();
          });
        }
        
        importNext();
        
      } catch (parseError) {
        reject(new Error('Invalid JSON in export file: ' + parseError.message));
      }
    });
  });
}

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
    const dbPath = process.env.RAILWAY_ENVIRONMENT ? '/app/data/crm.db' : 'crm.db';
    const sourcePath = path.join(__dirname, dbPath);
    
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

// Data Export/Import API Routes
app.post('/api/data/export', async (req, res) => {
  try {
    const exportResult = await exportUserData();
    res.json({
      success: true,
      export: exportResult
    });
  } catch (error) {
    console.error('Data export failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/data/import', async (req, res) => {
  try {
    const importResult = await importUserData();
    res.json({
      success: true,
      import: importResult
    });
  } catch (error) {
    console.error('Data import failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/data/export/download', (req, res) => {
  const exportPath = path.join(__dirname, 'data-export.json');
  
  if (!fs.existsSync(exportPath)) {
    return res.status(404).json({
      success: false,
      error: 'No export file found'
    });
  }
  
  res.download(exportPath, 'khs-crm-data-export.json', (err) => {
    if (err) {
      console.error('Download failed:', err);
      res.status(500).json({
        success: false,
        error: 'Download failed'
      });
    }
  });
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
    const dbPath = process.env.RAILWAY_ENVIRONMENT ? '/app/data/crm.db' : 'crm.db';
    const mainDbPath = path.join(__dirname, dbPath);
    
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
    
    // Reinitialize database connection with the restored data
    try {
      const dbPath = process.env.RAILWAY_ENVIRONMENT ? '/app/data/crm.db' : 'crm.db';
      db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Failed to reconnect to restored database:', err);
          return res.status(500).json({
            success: false,
            error: 'Failed to reconnect to restored database'
          });
        }
        
        console.log('✅ Reconnected to restored database');
        
        // Check if we're in a cloud environment (like Render, Heroku, etc.)
        const isCloudEnvironment = process.env.RENDER || process.env.HEROKU || (process.env.NODE_ENV === 'production' && !process.env.PM2_HOME);
        
        if (isCloudEnvironment) {
          // For cloud deployments, database is reconnected, just inform user
          console.log('✅ Database restored in cloud environment');
          
          res.json({
            success: true,
            message: 'Database restored successfully! Please refresh the page to see the restored data.',
            preRestoreBackup: preRestoreBackup.filename,
            requiresRefresh: true
          });
        } else {
          // Local development - database reconnected, no restart needed
          res.json({
            success: true,
            message: 'Database restored and reconnected successfully!',
            preRestoreBackup: preRestoreBackup.filename,
            requiresRefresh: false
          });
        }
      });
    } catch (error) {
      console.error('Failed to reinitialize database:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reinitialize database connection'
      });
    }
    
  } catch (error) {
    console.error('Restore failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Catch-all for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize server
async function startServer() {
  try {
    console.log('🔍 Initializing database...');
    await initializeDatabase();
    
    console.log('📋 Setting up database tables...');
    await initializeTables();
    
    // Wait a moment for database to fully initialize before backup
    console.log('⏳ Waiting for database to fully initialize...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Auto backup on server start
    try {
      const backup = await createBackup('startup');
      console.log(`🔄 Startup backup created: ${backup.filename}`);
    } catch (err) {
      console.error('Failed to create startup backup:', err);
    }
    
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
    
    // Start server with error handling
    const server = app.listen(PORT, HOST, () => {
      console.log('');
      console.log('🚀 KHS Simple CRM Server Started!');
      console.log('=====================================');
      console.log(`📍 URL: http://${HOST}:${PORT}`);
      console.log(`🌐 Local: http://localhost:${PORT}`);
      console.log('=====================================');
      console.log('');
    });
    
    // Handle server startup errors
    server.on('error', (err) => {
      console.error('🚫 Server startup error:', err);
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
      }
      process.exit(1);
    });
    
    return server;
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch(error => {
  console.error('❌ Server startup failed:', error);
  process.exit(1);
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
