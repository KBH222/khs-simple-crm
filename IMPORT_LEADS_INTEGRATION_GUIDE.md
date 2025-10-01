# Import Leads Feature - Integration Guide

This guide will help you integrate the new Import Leads feature into your KHS CRM application.

## Overview

The Import Leads feature allows you to:
- Store supplier email leads temporarily in a dedicated database table
- Review and edit lead information before committing
- Approve leads to automatically create customers and jobs
- Reject leads while keeping them for logging
- Attach supplier documents to job plans

## Files Created

### Backend
1. **`db/migrations/add-import-leads-table.js`** - Database migration script
2. **`routes/import-leads.js`** - API routes for import leads management

### Frontend
3. **`public/import-leads-page.html`** - HTML structure for the Import Queue page
4. **`public/import-leads.js`** - JavaScript functionality
5. **`public/import-leads.css`** - Styles for import leads UI

## Step-by-Step Integration

### Step 1: Run Database Migration

First, run the database migration to create the `import_leads` table:

```bash
node db/migrations/add-import-leads-table.js
```

Expected output:
```
🚀 Running import_leads migration...
✅ import_leads table created successfully
✅ Indexes created successfully
✅ Migration completed successfully
```

### Step 2: Register API Routes in server.js

Add the import leads routes to your `server.js`:

```javascript
// Add near the top with other require statements
const importLeadsRoutes = require('./routes/import-leads');

// Add after other route registrations (around line 200+)
app.use('/api/import-leads', importLeadsRoutes);

// Make sure db is accessible to routes
app.locals.db = db;
```

**Example placement in server.js:**
```javascript
// Around line 15-20 (with other imports)
const importLeadsRoutes = require('./routes/import-leads');

// Around line 250-300 (with other routes)
app.use('/api/customers', customersRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/import-leads', importLeadsRoutes);  // ADD THIS LINE
```

### Step 3: Update Frontend HTML (index.html)

#### 3.1 Add Import Queue Navigation Card

Find the dashboard `nav-grid` section in `public/index.html` (around line 68) and add the Import Queue card:

```html
<!-- Add this card inside the nav-grid div -->
<div class="nav-card" data-page="import-leads" onclick="showPage('import-leads')">
  <div class="nav-card-header" style="background-color: #EC4899;"></div>
  <div class="nav-card-content">
    <div class="nav-card-icon">📥</div>
    <div class="nav-card-info">
      <h3>Import Queue</h3>
      <p>Review supplier lead imports</p>
    </div>
    <div class="nav-card-arrow">→</div>
  </div>
</div>
```

#### 3.2 Add Import Leads Page Content

Copy the entire content from `public/import-leads-page.html` and paste it inside the `<main class="app-main">` section, after the existing pages (around line 1480, after the profile page).

### Step 4: Add JavaScript and CSS

#### 4.1 Add JavaScript Reference

Add the import leads script to `public/index.html` **before** the closing `</body>` tag:

```html
<!-- Add before </body> tag (around line 1780) -->
<script src="import-leads.js?v=20250101000000"></script>
<script src="app.js?v=20250928000033"></script>
</body>
```

#### 4.2 Add CSS Reference

Add the import leads stylesheet to the `<head>` section of `public/index.html`:

```html
<!-- Add in <head> section (around line 29) -->
<link rel="stylesheet" href="style.css?v=20250922000002&t=1737523200000">
<link rel="stylesheet" href="import-leads.css?v=20250101000000">
```

### Step 5: Update App.js Navigation

Update the `showPage()` function in `public/app.js` to handle the import-leads page:

```javascript
// In the showPage() function, add this case:
function showPage(pageId) {
  // ... existing code ...
  
  // Load import leads when showing the page
  if (pageId === 'import-leads') {
    loadImportLeads('pending');
  }
  
  // ... rest of existing code ...
}
```

### Step 6: Create Temp Upload Directory

Create a temporary upload directory for import attachments:

```bash
mkdir -p uploads/temp
```

Update your `.gitignore` to include:
```
uploads/temp/*
!uploads/temp/.gitkeep
```

Create a `.gitkeep` file:
```bash
touch uploads/temp/.gitkeep
```

## Testing the Integration

### Option 1: Manual Testing with Sample Data

Use the provided test script to create sample import leads:

```bash
node test-import-leads-sample.js
```

### Option 2: Create Test Lead via SQL

```sql
INSERT INTO import_leads (
  name, email, phone, street_address, city, state, zip_code,
  subject_line, email_body, job_type, status
) VALUES (
  'John Smith', 
  'john@example.com', 
  '(808) 555-1234',
  '123 Main Street',
  'Honolulu',
  'HI',
  '96815',
  'Kitchen Remodel Inquiry',
  'Hi, I am interested in remodeling my kitchen. Please contact me.',
  'Kitchen',
  'pending'
);
```

## API Endpoints Reference

### GET /api/import-leads
List all import leads with optional status filter.

**Query Parameters:**
- `status` - Filter by status: `pending`, `approved`, `rejected`, or `all`

**Response:**
```json
[
  {
    "id": 1,
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "(808) 555-1234",
    "street_address": "123 Main Street",
    "city": "Honolulu",
    "state": "HI",
    "zip_code": "96815",
    "subject_line": "Kitchen Remodel Inquiry",
    "job_type": "Kitchen",
    "status": "pending",
    "imported_at": "2025-01-01T12:00:00.000Z",
    "attachments": []
  }
]
```

### GET /api/import-leads/:id
Fetch single import lead with full details.

### PUT /api/import-leads/:id
Update import lead details (only for pending leads).

**Request Body:**
```json
{
  "name": "John Smith",
  "email": "john@example.com",
  "phone": "(808) 555-1234",
  "street_address": "123 Main Street",
  "city": "Honolulu",
  "state": "HI",
  "zip_code": "96815",
  "job_type": "Kitchen",
  "notes": "Customer wants modern finishes"
}
```

### POST /api/import-leads/:id/approve
Approve lead and create customer + job.

**Response:**
```json
{
  "success": true,
  "message": "Lead approved successfully",
  "customerId": 42,
  "jobId": 15,
  "attachmentsMoved": 2
}
```

**Process:**
1. Checks if customer exists (by email or last name + address)
2. Creates new customer if not exists, or uses existing
3. Creates new job under customer
4. Moves attachments from `uploads/temp/` to `uploads/plans/job-{jobId}/`
5. Updates import lead status to 'approved'

### POST /api/import-leads/:id/reject
Reject lead with optional reason.

**Request Body:**
```json
{
  "reason": "Out of service area"
}
```

### DELETE /api/import-leads/:id
Delete import lead and associated files (admin only).

### GET /api/import-leads/stats/summary
Get statistics summary.

**Response:**
```json
{
  "total": 50,
  "pending": 12,
  "approved": 35,
  "rejected": 3
}
```

## Database Schema

```sql
CREATE TABLE import_leads (
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
  attachments TEXT,  -- JSON array of attachment objects
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  processed_by INTEGER,
  customer_id INTEGER,
  job_id INTEGER,
  notes TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);
```

## Future Enhancements (Optional)

### Email Parsing Integration

To automatically import leads from supplier emails, you could:

1. **Set up email forwarding** - Forward supplier emails to a dedicated address
2. **Use email parsing service** - Services like Zapier, SendGrid Inbound Parse, or Mailgun Routes
3. **Create webhook endpoint** - Add a POST endpoint to receive parsed email data:

```javascript
// Example webhook endpoint
app.post('/api/webhooks/email-import', async (req, res) => {
  const { from, subject, text, html, attachments } = req.body;
  
  // Parse email content to extract lead information
  const leadData = parseEmailContent(text || html);
  
  // Save attachments to temp folder
  const savedAttachments = await saveAttachments(attachments);
  
  // Insert into import_leads table
  db.run(
    `INSERT INTO import_leads (name, email, subject_line, email_body, attachments)
     VALUES (?, ?, ?, ?, ?)`,
    [leadData.name, from, subject, text, JSON.stringify(savedAttachments)],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});
```

### Search and Filter Enhancements

- Add search by name, email, or address
- Date range filtering
- Bulk operations (approve/reject multiple)
- Export to CSV

### Notifications

- Email notification when new lead is imported
- SMS notification for urgent leads
- In-app notification badge

## Troubleshooting

### Issue: Import leads not showing
**Solution:** Check that:
1. Migration ran successfully
2. Routes are registered in server.js
3. JavaScript file is loaded in index.html
4. No console errors in browser DevTools

### Issue: Approve button not working
**Solution:** Check:
1. All required fields are filled
2. User is authenticated
3. Check server logs for errors
4. Ensure customer and job tables exist

### Issue: Attachments not moving
**Solution:** Verify:
1. `uploads/temp/` directory exists and is writable
2. `uploads/plans/` directory exists and is writable
3. Attachment filenames are correct in database

### Issue: Styles not applied
**Solution:** 
1. Check CSS file is linked in index.html
2. Clear browser cache (Ctrl+Shift+R)
3. Verify CSS file path is correct

## Support

For issues or questions about this integration:
1. Check the console logs (server and browser)
2. Verify all steps in this guide were completed
3. Test with sample data first
4. Review the API endpoint responses

## Next Steps

After successful integration:
1. Test the complete workflow (import → review → approve)
2. Set up email parsing webhook (optional)
3. Train staff on the Import Queue workflow
4. Monitor import lead statistics
5. Consider adding custom fields based on your supplier emails

---

**Version:** 1.0.0  
**Last Updated:** January 2025  
**Compatible with:** KHS CRM v1.0.0+

