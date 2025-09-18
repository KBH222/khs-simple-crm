// Initial data for Railway deployment
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

module.exports = { initializeCustomers };