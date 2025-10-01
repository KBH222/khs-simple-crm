/**
 * Import Leads Routes
 * Handles supplier email lead imports, approval/rejection workflow
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Middleware to check authentication (support both admin/user and worker sessions)
const requireAuth = (req, res, next) => {
  const hasAdminSession = !!(req.session && req.session.user);
  const hasWorkerSession = !!(req.session && req.session.userType === 'worker' && req.session.workerId);
  if (hasAdminSession || hasWorkerSession) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
};

// Apply auth middleware to all routes
router.use(requireAuth);

/**
 * GET /api/import-leads
 * List all pending import leads
 */
router.get('/', (req, res) => {
  const { status = 'pending' } = req.query;
  
  let sql = `
    SELECT 
      id, name, email, phone, street_address, city, state, zip_code,
      subject_line, job_type, status, imported_at, 
      attachments, customer_id, job_id
    FROM import_leads
  `;
  
  const params = [];
  
  // Filter by status if provided
  if (status && status !== 'all') {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY imported_at DESC';
  
  req.app.locals.db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Error fetching import leads:', err);
      return res.status(500).json({ error: 'Failed to fetch import leads' });
    }
    
    // Parse attachments JSON for each lead
    const leads = rows.map(lead => ({
      ...lead,
      attachments: lead.attachments ? JSON.parse(lead.attachments) : []
    }));
    
    res.json(leads);
  });
});

/**
 * GET /api/import-leads/:id
 * Fetch single import lead with full details
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  const sql = `
    SELECT * FROM import_leads WHERE id = ?
  `;
  
  req.app.locals.db.get(sql, [id], (err, lead) => {
    if (err) {
      console.error('Error fetching import lead:', err);
      return res.status(500).json({ error: 'Failed to fetch import lead' });
    }
    
    if (!lead) {
      return res.status(404).json({ error: 'Import lead not found' });
    }
    
    // Parse attachments
    lead.attachments = lead.attachments ? JSON.parse(lead.attachments) : [];
    
    res.json(lead);
  });
});

/**
 * PUT /api/import-leads/:id
 * Update import lead details (before approval)
 */
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, email, phone, street_address, city, state, zip_code, job_type, notes } = req.body;
  
  const sql = `
    UPDATE import_leads 
    SET name = ?, email = ?, phone = ?, street_address = ?, 
        city = ?, state = ?, zip_code = ?, job_type = ?, notes = ?
    WHERE id = ? AND status = 'pending'
  `;
  
  req.app.locals.db.run(
    sql,
    [name, email, phone, street_address, city, state || 'HI', zip_code, job_type, notes, id],
    function(err) {
      if (err) {
        console.error('Error updating import lead:', err);
        return res.status(500).json({ error: 'Failed to update import lead' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Import lead not found or already processed' });
      }
      
      res.json({ success: true, message: 'Import lead updated successfully' });
    }
  );
});

/**
 * POST /api/import-leads/:id/approve
 * Approve lead: create/update customer, create job, move attachments
 */
router.post('/:id/approve', async (req, res) => {
  const { id } = req.params;
  const db = req.app.locals.db;
  const userId = req.session.user.id;
  
  try {
    // Get the import lead
    const lead = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM import_leads WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else if (!row) reject(new Error('Lead not found'));
        else resolve(row);
      });
    });
    
    if (lead.status !== 'pending') {
      return res.status(400).json({ error: 'Lead already processed' });
    }
    
    // Parse attachments
    const attachments = lead.attachments ? JSON.parse(lead.attachments) : [];
    
    // Check if customer exists (by email or last name)
    let customer = null;
    if (lead.email) {
      customer = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM customers WHERE email = ? LIMIT 1', [lead.email], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    }
    
    // If no match by email, try by last name + address
    if (!customer && lead.name && lead.street_address) {
      const lastName = lead.name.split(' ').pop();
      customer = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM customers WHERE name LIKE ? AND street_address = ? LIMIT 1',
          [`%${lastName}%`, lead.street_address],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
    }
    
    let customerId;
    
    // Create new customer if not exists
    if (!customer) {
      customerId = await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO customers (name, email, phone, street_address, city, state, zip_code, type, reference, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'CURRENT', 'Supplier Import', ?)
        `;
        
        db.run(
          sql,
          [
            lead.name,
            lead.email,
            lead.phone,
            lead.street_address,
            lead.city,
            lead.state || 'HI',
            lead.zip_code,
            `Imported from: ${lead.subject_line || 'Supplier email'}`
          ],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
      
      console.log(`✅ Created new customer ID: ${customerId}`);
    } else {
      customerId = customer.id;
      console.log(`✅ Using existing customer ID: ${customerId}`);
    }
    
    // Create job under customer
    const jobType = lead.job_type || 'Kitchen';
    const jobDescription = lead.email_body || `Imported from supplier email: ${lead.subject_line}`;
    
    const jobId = await new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO jobs (customer_id, job_type, description, notes, status)
        VALUES (?, ?, ?, ?, 'OPEN')
      `;
      
      db.run(
        sql,
        [customerId, jobType, jobDescription, lead.notes || ''],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
    
    console.log(`✅ Created job ID: ${jobId}`);
    
    // Move attachments to job's plans folder
    const jobPlansDir = path.join(__dirname, '../uploads/plans', `job-${jobId}`);
    
    if (attachments.length > 0) {
      // Create job plans directory
      if (!fs.existsSync(jobPlansDir)) {
        fs.mkdirSync(jobPlansDir, { recursive: true });
      }
      
      // Move each attachment
      for (const attachment of attachments) {
        const sourcePath = path.join(__dirname, '../uploads/temp', attachment.filename);
        const destPath = path.join(jobPlansDir, attachment.filename);
        
        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, destPath);
          console.log(`✅ Moved attachment: ${attachment.filename}`);
        }
      }
      
      console.log(`✅ Moved ${attachments.length} attachments to job ${jobId}`);
    }
    
    // Update import lead status
    await new Promise((resolve, reject) => {
      const sql = `
        UPDATE import_leads 
        SET status = 'approved', 
            processed_at = CURRENT_TIMESTAMP,
            processed_by = ?,
            customer_id = ?,
            job_id = ?
        WHERE id = ?
      `;
      
      db.run(sql, [userId, customerId, jobId, id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    res.json({
      success: true,
      message: 'Lead approved successfully',
      customerId,
      jobId,
      attachmentsMoved: attachments.length
    });
    
  } catch (error) {
    console.error('Error approving lead:', error);
    res.status(500).json({ error: error.message || 'Failed to approve lead' });
  }
});

/**
 * POST /api/import-leads/:id/reject
 * Reject lead (mark as rejected, keep for logging)
 */
router.post('/:id/reject', (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.session.user.id;
  
  const sql = `
    UPDATE import_leads 
    SET status = 'rejected',
        processed_at = CURRENT_TIMESTAMP,
        processed_by = ?,
        notes = COALESCE(notes || '\n', '') || 'Rejection reason: ' || ?
    WHERE id = ? AND status = 'pending'
  `;
  
  req.app.locals.db.run(
    sql,
    [userId, reason || 'No reason provided', id],
    function(err) {
      if (err) {
        console.error('Error rejecting lead:', err);
        return res.status(500).json({ error: 'Failed to reject lead' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Import lead not found or already processed' });
      }
      
      res.json({ success: true, message: 'Lead rejected successfully' });
    }
  );
});

/**
 * DELETE /api/import-leads/:id
 * Delete an import lead (admin only, for cleanup)
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  // First get attachments to delete files
  req.app.locals.db.get(
    'SELECT attachments FROM import_leads WHERE id = ?',
    [id],
    (err, lead) => {
      if (err) {
        console.error('Error fetching lead for deletion:', err);
        return res.status(500).json({ error: 'Failed to delete lead' });
      }
      
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      // Delete attachment files
      const attachments = lead.attachments ? JSON.parse(lead.attachments) : [];
      attachments.forEach(att => {
        const filePath = path.join(__dirname, '../uploads/temp', att.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      
      // Delete from database
      req.app.locals.db.run(
        'DELETE FROM import_leads WHERE id = ?',
        [id],
        function(err) {
          if (err) {
            console.error('Error deleting lead:', err);
            return res.status(500).json({ error: 'Failed to delete lead' });
          }
          
          res.json({ success: true, message: 'Lead deleted successfully' });
        }
      );
    }
  );
});

/**
 * GET /api/import-leads/stats
 * Get statistics about import leads
 */
router.get('/stats/summary', (req, res) => {
  const sql = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
    FROM import_leads
  `;
  
  req.app.locals.db.get(sql, [], (err, stats) => {
    if (err) {
      console.error('Error fetching stats:', err);
      return res.status(500).json({ error: 'Failed to fetch statistics' });
    }
    
    res.json(stats);
  });
});

module.exports = router;

