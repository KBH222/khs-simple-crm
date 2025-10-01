/**
 * Migration: Create import_leads table for temporary lead storage
 * Run this migration to add the new table to your database
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.RAILWAY_ENVIRONMENT 
  ? '/app/data/crm.db' 
  : path.join(__dirname, '../../crm.db');

const db = new sqlite3.Database(dbPath);

// Create import_leads table
const createImportLeadsTable = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS import_leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        street_address TEXT,
        city TEXT,
        state TEXT DEFAULT 'HI',
        zip_code TEXT,
        subject_line TEXT,
        email_body TEXT,
        job_type TEXT CHECK(job_type IN ('Kitchen', 'Bathroom', 'Other')),
        attachments TEXT,  -- JSON array of attachment file paths
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME,
        processed_by INTEGER,
        customer_id INTEGER,  -- Linked customer ID after approval
        job_id INTEGER,       -- Linked job ID after approval
        notes TEXT,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (job_id) REFERENCES jobs(id)
      )
    `;

    db.run(sql, (err) => {
      if (err) {
        console.error('❌ Error creating import_leads table:', err);
        reject(err);
      } else {
        console.log('✅ import_leads table created successfully');
        resolve();
      }
    });
  });
};

// Create index for faster queries on status
const createIndexes = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      CREATE INDEX IF NOT EXISTS idx_import_leads_status 
      ON import_leads(status);
    `;

    db.run(sql, (err) => {
      if (err) {
        console.error('❌ Error creating index:', err);
        reject(err);
      } else {
        console.log('✅ Indexes created successfully');
        resolve();
      }
    });
  });
};

// Run migration
const runMigration = async () => {
  try {
    await createImportLeadsTable();
    await createIndexes();
    console.log('✅ Migration completed successfully');
    db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    db.close();
    process.exit(1);
  }
};

// Execute if run directly
if (require.main === module) {
  console.log('🚀 Running import_leads migration...');
  runMigration();
}

// Export for use in server.js
module.exports = { createImportLeadsTable, createIndexes };

