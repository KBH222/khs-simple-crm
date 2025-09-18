// Initial data for Railway deployment
// Initial jobs data
const initialJobs = [
  {
    id: "job-1758094061607-9d1me6la7",
    customer_id: "cust-1758094030880-u886npesg",
    title: "Kitchen",
    description: "Demo/install kitchen cabinets",
    status: "QUOTED",
    priority: "medium",
    total_cost: 0,
    start_date: null,
    end_date: null,
    notes: "",
    created_at: "2025-09-17T07:27:41.607Z",
    updated_at: "2025-09-17T07:27:41.607Z",
    project_scope: null
  },
  {
    id: "job-1758095224167-mrgrhg19p",
    customer_id: "cust-1758094934619-vb3vdt1qd",
    title: "Bathroom",
    description: "",
    status: "QUOTED",
    priority: "medium",
    total_cost: 0,
    start_date: null,
    end_date: null,
    notes: "",
    created_at: "2025-09-17T07:47:04.167Z",
    updated_at: "2025-09-17T07:47:04.167Z",
    project_scope: null
  },
  {
    id: "job-1758095366903-yfxb0fwki",
    customer_id: "cust-1758095350124-oxu1cmyl6",
    title: "Kitchen",
    description: "",
    status: "QUOTED",
    priority: "medium",
    total_cost: 0,
    start_date: null,
    end_date: null,
    notes: "",
    created_at: "2025-09-17T07:49:26.903Z",
    updated_at: "2025-09-17T07:49:26.903Z",
    project_scope: null
  }
];

const initialCustomers = [
  {
    id: "cust-1758094934619-vb3vdt1qd",
    name: "Phil & Mimi Nakagawa",
    phone: "8087283164",
    email: "jiipapaphil@gmail.com",
    address: "1345 Miloiki St, Honolulu, HI 96825",
    notes: "",
    reference: "HOD",
    customer_type: "CURRENT",
    created_at: "2025-09-17T07:42:14.619Z",
    updated_at: "2025-09-17T07:42:14.619Z"
  },
  {
    id: "cust-1758095350124-oxu1cmyl6",
    name: "Jed Taba",
    phone: "8082949653",
    email: "jtaba53@gmail.com",
    address: "99-1393 Aiea Hts Dr, Aiea, HI 96701",
    notes: "",
    reference: "Yelp",
    customer_type: "CURRENT",
    created_at: "2025-09-17T07:49:10.124Z",
    updated_at: "2025-09-17T07:49:10.124Z"
  },
  {
    id: "cust-1758094030880-u886npesg",
    name: "Donna Maeda",
    phone: "8085610069",
    email: "donnamaeda1@gmail.com",
    address: "98-1764 B Kaahumanu Street, Pearl City, HI 96782",
    notes: "",
    reference: "HOD",
    customer_type: "CURRENT",
    created_at: "2025-09-17T07:27:10.880Z",
    updated_at: "2025-09-17T07:27:10.880Z"
  }
];

function initializeCustomers(db) {
  return new Promise((resolve, reject) => {
    // Check if customers already exist
    db.get("SELECT COUNT(*) as count FROM customers", (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (row.count > 0) {
        console.log("✅ Customers already exist, skipping initialization");
        resolve();
        return;
      }
      
      console.log("🔄 Initializing customers data...");
      
      const stmt = db.prepare(`
        INSERT INTO customers (id, name, phone, email, address, notes, reference, customer_type, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      let completed = 0;
      initialCustomers.forEach(customer => {
        stmt.run([
          customer.id,
          customer.name,
          customer.phone,
          customer.email,
          customer.address,
          customer.notes,
          customer.reference,
          customer.customer_type,
          customer.created_at,
          customer.updated_at
        ], (err) => {
          if (err) {
            console.error("Error inserting customer:", err);
          }
          completed++;
          if (completed === initialCustomers.length) {
            stmt.finalize();
            console.log(`✅ Initialized ${initialCustomers.length} customers`);
            resolve();
          }
        });
      });
    });
  });
}

function initializeJobs(db) {
  return new Promise((resolve, reject) => {
    // Check if jobs already exist
    db.get("SELECT COUNT(*) as count FROM jobs", (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (row.count > 0) {
        console.log("✅ Jobs already exist, skipping initialization");
        resolve();
        return;
      }
      
      console.log("🔄 Initializing jobs data...");
      
      const stmt = db.prepare(`
        INSERT INTO jobs (id, customer_id, title, description, status, priority, total_cost, start_date, end_date, notes, created_at, updated_at, project_scope) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      let completed = 0;
      initialJobs.forEach(job => {
        stmt.run([
          job.id,
          job.customer_id,
          job.title,
          job.description,
          job.status,
          job.priority,
          job.total_cost,
          job.start_date,
          job.end_date,
          job.notes,
          job.created_at,
          job.updated_at,
          job.project_scope
        ], (err) => {
          if (err) {
            console.error("Error inserting job:", err);
          }
          completed++;
          if (completed === initialJobs.length) {
            stmt.finalize();
            console.log(`✅ Initialized ${initialJobs.length} jobs`);
            resolve();
          }
        });
      });
    });
  });
}

async function initializeAllData(db) {
  try {
    await initializeCustomers(db);
    await initializeJobs(db);
    console.log('✅ All data initialization complete');
  } catch (error) {
    console.error('❌ Data initialization error:', error);
    throw error;
  }
}

module.exports = { initializeCustomers, initializeJobs, initializeAllData };
