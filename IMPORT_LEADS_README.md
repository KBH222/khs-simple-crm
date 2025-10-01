# Import Leads Feature

A comprehensive lead management system for importing and processing supplier email leads in KHS CRM.

## 🎯 Overview

The Import Leads feature provides a structured workflow for:
- **Temporarily storing** supplier email leads before committing to the main database
- **Reviewing and editing** lead information in a dedicated interface
- **Approving** leads to automatically create customers and jobs
- **Rejecting** leads while maintaining a log for future reference
- **Attaching** supplier documents directly to job plans

## ✨ Key Features

### 1. **Import Queue Dashboard**
- View all pending, approved, and rejected leads
- Filter by status
- Quick statistics overview
- Mobile-responsive card layout

### 2. **Lead Review Interface**
- Pre-filled customer information from email
- Edit capabilities before approval
- Kitchen/Bathroom job type selection
- Attachment preview and management
- Email content display

### 3. **Smart Customer Matching**
- Automatic duplicate detection by email
- Fallback matching by last name + address
- Creates new customer only if no match found

### 4. **Automated Job Creation**
- Job created automatically on approval
- Attachments moved to job's Plans folder
- Job type pre-selected from import data

### 5. **Audit Trail**
- Tracks import date/time
- Records who approved/rejected
- Maintains history of all leads

## 📦 What's Included

### Backend Components
```
routes/import-leads.js              # API endpoints
db/migrations/add-import-leads-table.js  # Database schema
```

### Frontend Components
```
public/import-leads.js              # JavaScript functionality
public/import-leads.css             # Styles
public/import-leads-page.html       # HTML structure
```

### Setup & Testing
```
setup-import-leads.js               # Automated setup script
test-import-leads-sample.js         # Sample data generator
IMPORT_LEADS_INTEGRATION_GUIDE.md   # Detailed integration guide
```

## 🚀 Quick Start

### 1. Run Setup Script
```bash
node setup-import-leads.js
```

This will:
- Create database table
- Set up required directories
- Verify all files are present
- Show integration checklist

### 2. Integrate Components

#### Add to `server.js`:
```javascript
// Add import
const importLeadsRoutes = require('./routes/import-leads');

// Add route
app.use('/api/import-leads', importLeadsRoutes);
```

#### Update `public/index.html`:
```html
<!-- In <head> -->
<link rel="stylesheet" href="import-leads.css">

<!-- Add dashboard card (see import-leads-page.html) -->

<!-- Add page content (see import-leads-page.html) -->

<!-- Before </body> -->
<script src="import-leads.js"></script>
```

### 3. Test with Sample Data
```bash
node test-import-leads-sample.js
```

This creates 6 sample leads with realistic data.

### 4. Access the Feature
1. Start your server: `npm start`
2. Navigate to Dashboard
3. Click **Import Queue** card
4. Review and approve sample leads

## 📊 Database Schema

```sql
CREATE TABLE import_leads (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  street_address TEXT,
  city TEXT,
  state TEXT DEFAULT 'HI',
  zip_code TEXT,
  subject_line TEXT,
  email_body TEXT,
  job_type TEXT,                    -- Kitchen, Bathroom, Other
  attachments TEXT,                 -- JSON array
  status TEXT DEFAULT 'pending',    -- pending, approved, rejected
  imported_at DATETIME,
  processed_at DATETIME,
  processed_by INTEGER,
  customer_id INTEGER,              -- Linked after approval
  job_id INTEGER,                   -- Linked after approval
  notes TEXT
);
```

## 🔄 Workflow

### Standard Approval Flow

```
1. Lead imported → Stored in import_leads table
2. User reviews in Import Queue
3. User edits/updates information if needed
4. User selects job type (Kitchen/Bathroom)
5. User clicks "Approve & Create Job"
   ├─ System checks for existing customer
   ├─ Creates new customer (if needed)
   ├─ Creates job under customer
   ├─ Moves attachments to job folder
   └─ Updates lead status to 'approved'
6. User can view customer/job in main CRM
```

### Rejection Flow

```
1. User clicks "Reject" button
2. System prompts for rejection reason
3. Lead marked as rejected
4. Reason logged in notes
5. Lead stays in system for reference
```

## 🎨 UI Components

### Import Lead Card
- **Header**: Name, subject line, status badge
- **Body**: Address, phone, email
- **Footer**: Job type, attachment count, import date

### Import Lead Modal
- **Email Info**: Subject, received date
- **Customer Form**: Name, contact info, address
- **Job Type Selector**: Radio cards for Kitchen/Bathroom/Other
- **Attachments**: List with download links
- **Email Content**: Full email body preview
- **Notes**: Editable notes field
- **Actions**: Close, Reject, Save, Approve buttons

## 🔌 API Reference

### List Leads
```http
GET /api/import-leads?status=pending
```

### Get Lead Details
```http
GET /api/import-leads/:id
```

### Update Lead
```http
PUT /api/import-leads/:id
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "job_type": "Kitchen"
}
```

### Approve Lead
```http
POST /api/import-leads/:id/approve
```

### Reject Lead
```http
POST /api/import-leads/:id/reject
Content-Type: application/json

{
  "reason": "Out of service area"
}
```

### Get Statistics
```http
GET /api/import-leads/stats/summary

Response:
{
  "total": 50,
  "pending": 12,
  "approved": 35,
  "rejected": 3
}
```

## 🔧 Configuration

### File Upload Settings

Attachments are stored in:
- **Temporary**: `uploads/temp/` (before approval)
- **Permanent**: `uploads/plans/job-{jobId}/` (after approval)

Make sure these directories exist and have write permissions.

### Job Type Options

Default options: Kitchen, Bathroom, Other

To add more job types, update:
1. Database constraint in migration
2. Frontend radio options in HTML
3. Validation in routes

## 📱 Mobile Support

The Import Leads UI is fully responsive:
- **Desktop**: Multi-column layout, expanded details
- **Tablet**: Adapted grid, touch-friendly
- **Mobile**: Stacked layout, large tap targets

## 🔐 Security

- All routes require authentication
- Session-based access control
- SQL injection prevention via parameterized queries
- XSS protection via HTML escaping
- File upload validation (type, size)

## 🧪 Testing

### Manual Testing
1. Run sample data script
2. Navigate to Import Queue
3. Click a lead card
4. Edit information
5. Test approve workflow
6. Verify customer and job created
7. Check attachments moved

### Test Cases
- ✅ Import lead with all fields
- ✅ Import lead with minimal fields
- ✅ Approve new customer
- ✅ Approve existing customer
- ✅ Reject lead with reason
- ✅ Edit lead before approval
- ✅ Filter by status
- ✅ Attachment handling

## 🚧 Future Enhancements

### Phase 2 (Optional)
- [ ] Email parsing integration (webhook)
- [ ] Bulk approve/reject
- [ ] Search and advanced filtering
- [ ] Export to CSV
- [ ] Email notifications
- [ ] SMS alerts for urgent leads
- [ ] Lead scoring system
- [ ] Duplicate lead merging
- [ ] Scheduled reports

### Email Integration Options
- **Zapier**: Email Parser + Webhook
- **SendGrid**: Inbound Parse
- **Mailgun**: Routes API
- **Custom**: IMAP polling script

## 📖 Documentation

- **Integration Guide**: `IMPORT_LEADS_INTEGRATION_GUIDE.md`
- **This README**: `IMPORT_LEADS_README.md`
- **Inline Comments**: All files have detailed comments

## 🐛 Troubleshooting

### Leads not showing?
- Check database migration ran
- Verify routes registered in server.js
- Check browser console for errors

### Approve not working?
- Ensure all required fields filled
- Check server logs for errors
- Verify customers/jobs tables exist

### Attachments not moving?
- Check directory permissions
- Verify temp folder exists
- Check file paths in database

### Styles not applied?
- Clear browser cache
- Verify CSS file linked
- Check file path is correct

## 💡 Tips

1. **Test with sample data first** before integrating real emails
2. **Review integration guide** for step-by-step instructions
3. **Check server logs** when troubleshooting
4. **Use browser DevTools** to inspect API responses
5. **Keep import_leads table** for historical reference

## 📞 Support

For integration assistance:
1. Review integration guide
2. Check troubleshooting section
3. Verify all setup steps completed
4. Test with sample data
5. Check server and browser logs

## 📄 License

Part of KHS CRM - Private/Proprietary

---

**Version**: 1.0.0  
**Last Updated**: January 2025  
**Compatible with**: KHS CRM v1.0.0+

