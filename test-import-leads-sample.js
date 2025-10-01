/**
 * Test Script: Create Sample Import Leads
 * Run this script to populate sample import leads for testing
 * 
 * Usage: node test-import-leads-sample.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.RAILWAY_ENVIRONMENT 
  ? '/app/data/crm.db' 
  : path.join(__dirname, 'crm.db');

const db = new sqlite3.Database(dbPath);

// Sample leads data
const sampleLeads = [
  {
    name: 'Robert Johnson',
    email: 'robert.johnson@email.com',
    phone: '(808) 555-0123',
    street_address: '456 Kalakaua Avenue',
    city: 'Honolulu',
    state: 'HI',
    zip_code: '96815',
    subject_line: 'Kitchen Renovation - Diamond Head Area',
    email_body: `Hello,

I am interested in getting a quote for a complete kitchen renovation. The kitchen is approximately 200 sq ft and I would like to update cabinets, countertops, and appliances.

The property is located in the Diamond Head area. Please let me know your availability for a consultation.

Thank you,
Robert Johnson`,
    job_type: 'Kitchen',
    status: 'pending'
  },
  {
    name: 'Lisa Chen',
    email: 'lisa.chen@gmail.com',
    phone: '(808) 555-0456',
    street_address: '789 Beretania Street',
    city: 'Honolulu',
    state: 'HI',
    zip_code: '96814',
    subject_line: 'Master Bathroom Remodel Inquiry',
    email_body: `Hi there,

We're looking to remodel our master bathroom. Current bathroom is dated (1980s) and we want a modern update with walk-in shower, double vanity, and new tile work.

Timeline: Would like to start in the next 2-3 months.
Budget: Flexible, quality is important to us.

Please contact me to schedule an estimate.

Best regards,
Lisa Chen`,
    job_type: 'Bathroom',
    status: 'pending'
  },
  {
    name: 'Michael Santos',
    email: 'msantos@yahoo.com',
    phone: '(808) 555-0789',
    street_address: '321 Kapiolani Boulevard',
    city: 'Honolulu',
    state: 'HI',
    zip_code: '96814',
    subject_line: 'Guest Bathroom Update',
    email_body: `Hello KHS Team,

I need a guest bathroom updated. Simple refresh - new toilet, vanity, mirror, and paint. Nothing too fancy.

Available for consultation next week. Let me know your rates.

Thanks,
Mike`,
    job_type: 'Bathroom',
    status: 'pending'
  },
  {
    name: 'Sarah Williams',
    email: 'sarah.w@hawaii.rr.com',
    phone: '(808) 555-0234',
    street_address: '567 Ala Moana Boulevard',
    city: 'Honolulu',
    state: 'HI',
    zip_code: '96813',
    subject_line: 'Kitchen + Bathroom Remodel Package',
    email_body: `Good morning,

I am interested in doing both a kitchen and bathroom remodel. I received your information from Yelp and would like to get a comprehensive quote.

Kitchen: Full remodel including cabinets, granite countertops, new appliances
Bathroom: Two bathrooms - one full remodel, one refresh

Property: Single family home in Ala Moana area
Timeline: 3-4 months from start date

Please contact me at your earliest convenience.

Sarah Williams`,
    job_type: 'Kitchen',
    status: 'pending',
    notes: 'High-value lead, two projects'
  },
  {
    name: 'David Kim',
    email: 'davidkim@outlook.com',
    phone: '(808) 555-0567',
    street_address: '890 Wilder Avenue',
    city: 'Honolulu',
    state: 'HI',
    zip_code: '96822',
    subject_line: 'Condo Kitchen Renovation',
    email_body: `Hi,

Small condo kitchen needs updating. Looking for modern, space-efficient design. Approximately 120 sq ft.

Budget: $30-40k
Timeline: Flexible

Please advise on next steps.

David`,
    job_type: 'Kitchen',
    status: 'pending'
  },
  {
    name: 'Jennifer Lee',
    email: 'jlee@example.com',
    phone: '(808) 555-0890',
    street_address: '234 Punahou Street',
    city: 'Honolulu',
    state: 'HI',
    zip_code: '96826',
    subject_line: 'Bathroom Accessibility Modifications',
    email_body: `Hello,

We need to make our bathroom more accessible for my elderly mother. Looking for grab bars, walk-in tub or shower, and other safety modifications.

This is somewhat urgent. Please call as soon as possible.

Jennifer Lee
(808) 555-0890`,
    job_type: 'Bathroom',
    status: 'pending'
  }
];

// Insert sample leads
async function insertSampleLeads() {
  console.log('🚀 Creating sample import leads...\n');
  
  const sql = `
    INSERT INTO import_leads (
      name, email, phone, street_address, city, state, zip_code,
      subject_line, email_body, job_type, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const lead of sampleLeads) {
    try {
      await new Promise((resolve, reject) => {
        db.run(
          sql,
          [
            lead.name,
            lead.email,
            lead.phone,
            lead.street_address,
            lead.city,
            lead.state,
            lead.zip_code,
            lead.subject_line,
            lead.email_body,
            lead.job_type,
            lead.status,
            lead.notes || null
          ],
          function(err) {
            if (err) {
              console.error(`❌ Failed to insert ${lead.name}:`, err.message);
              errorCount++;
              reject(err);
            } else {
              console.log(`✅ Created lead #${this.lastID}: ${lead.name} - ${lead.subject_line}`);
              successCount++;
              resolve(this.lastID);
            }
          }
        );
      });
    } catch (error) {
      // Error already logged above
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Successfully created: ${successCount} leads`);
  if (errorCount > 0) {
    console.log(`❌ Failed to create: ${errorCount} leads`);
  }
  console.log('='.repeat(60));
  console.log('\n📊 Summary:');
  console.log(`   - Total leads: ${sampleLeads.length}`);
  console.log(`   - Kitchen leads: ${sampleLeads.filter(l => l.job_type === 'Kitchen').length}`);
  console.log(`   - Bathroom leads: ${sampleLeads.filter(l => l.job_type === 'Bathroom').length}`);
  console.log('\n🌐 Access Import Queue at: http://localhost:3001');
  console.log('   Navigate to Dashboard → Import Queue\n');
}

// Check if table exists
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='import_leads'", (err, row) => {
  if (err) {
    console.error('❌ Database error:', err);
    process.exit(1);
  }
  
  if (!row) {
    console.error('❌ Error: import_leads table does not exist!');
    console.log('📝 Please run the migration first:');
    console.log('   node db/migrations/add-import-leads-table.js\n');
    process.exit(1);
  }
  
  // Table exists, insert sample data
  insertSampleLeads()
    .then(() => {
      db.close();
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed to create sample leads:', error);
      db.close();
      process.exit(1);
    });
});

