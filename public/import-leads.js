/**
 * Import Leads Management - Frontend JavaScript
 * Handles supplier lead imports, review, approve/reject workflow
 */

// Global state
let currentImportLeadId = null;
let currentFilterStatus = 'pending';

/**
 * Show notification message
 */
function showNotification(message, type = 'info') {
  // Simple alert for now - can be enhanced with toast notifications later
  if (type === 'error') {
    alert('❌ ' + message);
  } else if (type === 'success') {
    alert('✅ ' + message);
  } else {
    alert(message);
  }
}

/**
 * Load import leads based on status filter
 */
async function loadImportLeads(status = 'pending') {
  const listContainer = document.getElementById('importLeadsList');
  listContainer.innerHTML = '<div class="loading">Loading import leads...</div>';
  
  try {
    const response = await fetch(`/api/import-leads?status=${status}`);
    
    if (!response.ok) {
      throw new Error('Failed to load import leads');
    }
    
    const leads = await response.json();
    
    // Update stats
    updateImportStats();
    
    if (leads.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <p style="font-size: 48px; margin-bottom: 10px;">📭</p>
          <p style="font-size: 18px; font-weight: 600; color: #111827;">No ${status === 'all' ? '' : status} leads</p>
          <p style="color: #6B7280; margin-top: 5px;">Import leads will appear here when supplier emails are processed</p>
        </div>
      `;
      return;
    }
    
    // Render leads
    listContainer.innerHTML = leads.map(lead => createLeadCard(lead)).join('');
    
  } catch (error) {
    console.error('Error loading import leads:', error);
    listContainer.innerHTML = `
      <div class="error-state">
        <p style="color: #DC2626;">❌ Failed to load import leads</p>
        <button onclick="loadImportLeads('${status}')" class="retry-btn" style="margin-top: 10px; padding: 8px 16px; background: #3B82F6; color: white; border: none; border-radius: 6px; cursor: pointer;">Retry</button>
      </div>
    `;
  }
}

/**
 * Create lead card HTML
 */
function createLeadCard(lead) {
  const statusColors = {
    pending: '#F59E0B',
    approved: '#10B981',
    rejected: '#EF4444'
  };
  
  const statusIcons = {
    pending: '⏳',
    approved: '✅',
    rejected: '❌'
  };
  
  const importDate = new Date(lead.imported_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const attachmentCount = lead.attachments ? lead.attachments.length : 0;
  
  return `
    <div class="import-lead-card" onclick="openImportLeadModal(${lead.id})">
      <div class="lead-card-header">
        <div class="lead-main-info">
          <h3 class="lead-name">${escapeHtml(lead.name)}</h3>
          <p class="lead-subject">${escapeHtml(lead.subject_line || 'No subject')}</p>
        </div>
        <div class="lead-status-badge" style="background: ${statusColors[lead.status]}20; color: ${statusColors[lead.status]}; padding: 6px 12px; border-radius: 12px; font-size: 13px; font-weight: 600;">
          ${statusIcons[lead.status]} ${lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
        </div>
      </div>
      
      <div class="lead-card-body">
        <div class="lead-info-row">
          <div class="lead-info-item">
            <span class="info-icon">📍</span>
            <span class="info-text">${escapeHtml(lead.street_address || 'No address')}, ${escapeHtml(lead.city || '')}</span>
          </div>
          ${lead.phone ? `
          <div class="lead-info-item">
            <span class="info-icon">📞</span>
            <span class="info-text">${escapeHtml(lead.phone)}</span>
          </div>
          ` : ''}
          ${lead.email ? `
          <div class="lead-info-item">
            <span class="info-icon">✉️</span>
            <span class="info-text">${escapeHtml(lead.email)}</span>
          </div>
          ` : ''}
        </div>
        
        <div class="lead-meta">
          <span class="lead-job-type" style="background: #3B82F610; color: #3B82F6; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
            ${lead.job_type || 'Kitchen'}
          </span>
          ${attachmentCount > 0 ? `
          <span class="lead-attachments" style="color: #6B7280; font-size: 13px;">
            📎 ${attachmentCount} attachment${attachmentCount > 1 ? 's' : ''}
          </span>
          ` : ''}
          <span class="lead-date" style="color: #9CA3AF; font-size: 12px; margin-left: auto;">
            ${importDate}
          </span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Update import statistics
 */
async function updateImportStats() {
  try {
    const response = await fetch('/api/import-leads/stats/summary');
    const stats = await response.json();
    
    document.getElementById('pendingCount').textContent = `${stats.pending || 0} Pending`;
    document.getElementById('approvedCount').textContent = `${stats.approved || 0} Approved`;
  } catch (error) {
    console.error('Error updating stats:', error);
  }
}

/**
 * Filter import leads by status
 */
function filterImportLeads(status) {
  currentFilterStatus = status;
  
  // Update active tab
  document.querySelectorAll('.filter-tabs .filter-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.status === status);
  });
  
  // Load leads with filter
  loadImportLeads(status);
}

/**
 * Open import lead modal
 */
async function openImportLeadModal(leadId) {
  currentImportLeadId = leadId;
  
  try {
    const response = await fetch(`/api/import-leads/${leadId}`);
    
    if (!response.ok) {
      throw new Error('Failed to load lead details');
    }
    
    const lead = await response.json();
    
    // Populate modal
    populateImportLeadModal(lead);
    
    // Show modal
    document.getElementById('importLeadModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    
  } catch (error) {
    console.error('Error loading lead details:', error);
    showNotification('Failed to load lead details', 'error');
  }
}

/**
 * Populate modal with lead data
 */
function populateImportLeadModal(lead) {
  // Status badge
  const statusBadge = document.getElementById('importStatusBadge');
  const statusColors = {
    pending: { bg: '#FEF3C7', color: '#92400E', text: 'Pending Review' },
    approved: { bg: '#D1FAE5', color: '#065F46', text: 'Approved' },
    rejected: { bg: '#FEE2E2', color: '#991B1B', text: 'Rejected' }
  };
  
  const statusStyle = statusColors[lead.status] || statusColors.pending;
  statusBadge.style.background = statusStyle.bg;
  statusBadge.style.color = statusStyle.color;
  statusBadge.querySelector('.status-text').textContent = statusStyle.text;
  
  // Email info
  document.getElementById('importSubject').textContent = lead.subject_line || 'No subject';
  document.getElementById('importDate').textContent = new Date(lead.imported_at).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Customer info
  document.getElementById('importName').value = lead.name || '';
  document.getElementById('importPhone').value = formatPhoneNumber(lead.phone || '');
  document.getElementById('importEmail').value = lead.email || '';
  document.getElementById('importStreet').value = lead.street_address || '';
  document.getElementById('importCity').value = lead.city || '';
  document.getElementById('importState').value = lead.state || 'HI';
  document.getElementById('importZip').value = lead.zip_code || '';
  
  // Job type
  const jobType = lead.job_type || 'Kitchen';
  document.querySelector(`input[name="importJobType"][value="${jobType}"]`).checked = true;
  
  // Attachments
  const attachmentsContainer = document.getElementById('importAttachments');
  const attachmentCount = document.getElementById('attachmentCount');
  
  if (lead.attachments && lead.attachments.length > 0) {
    attachmentCount.textContent = lead.attachments.length;
    attachmentsContainer.innerHTML = lead.attachments.map(att => `
      <div class="attachment-item">
        <span class="attachment-icon">📄</span>
        <span class="attachment-name">${escapeHtml(att.filename)}</span>
        <span class="attachment-size">${formatFileSize(att.size || 0)}</span>
        <a href="/uploads/temp/${att.filename}" target="_blank" class="attachment-download" download>
          ⬇️ Download
        </a>
      </div>
    `).join('');
  } else {
    attachmentCount.textContent = '0';
    attachmentsContainer.innerHTML = '<p style="color: #6B7280; font-size: 14px;">No attachments</p>';
  }
  
  // Email body
  const emailBody = document.getElementById('importEmailBody');
  if (lead.email_body) {
    emailBody.innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit; font-size: 14px; color: #374151;">${escapeHtml(lead.email_body)}</pre>`;
  } else {
    emailBody.innerHTML = '<p style="color: #6B7280;">No content available</p>';
  }
  
  // Notes
  document.getElementById('importNotes').value = lead.notes || '';
  
  // Show/hide action buttons based on status
  const saveBtn = document.getElementById('saveLeadBtn');
  const approveBtn = document.getElementById('approveLeadBtn');
  const rejectBtn = document.getElementById('rejectLeadBtn');
  
  if (lead.status === 'pending') {
    saveBtn.style.display = 'inline-block';
    approveBtn.style.display = 'inline-block';
    rejectBtn.style.display = 'inline-block';
  } else {
    saveBtn.style.display = 'none';
    approveBtn.style.display = 'none';
    rejectBtn.style.display = 'none';
  }
}

/**
 * Close import lead modal
 */
function closeImportLeadModal() {
  document.getElementById('importLeadModal').classList.remove('active');
  document.body.style.overflow = '';
  currentImportLeadId = null;
}

/**
 * Save import lead changes
 */
async function saveImportLead() {
  if (!currentImportLeadId) return;
  
  const saveBtn = document.getElementById('saveLeadBtn');
  const originalText = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = '💾 Saving...';
  
  try {
    const data = {
      name: document.getElementById('importName').value.trim(),
      phone: document.getElementById('importPhone').value.trim(),
      email: document.getElementById('importEmail').value.trim(),
      street_address: document.getElementById('importStreet').value.trim(),
      city: document.getElementById('importCity').value.trim(),
      state: document.getElementById('importState').value.trim(),
      zip_code: document.getElementById('importZip').value.trim(),
      job_type: document.querySelector('input[name="importJobType"]:checked').value,
      notes: document.getElementById('importNotes').value.trim()
    };
    
    // Validation
    if (!data.name || !data.street_address || !data.city) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }
    
    const response = await fetch(`/api/import-leads/${currentImportLeadId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error('Failed to save changes');
    }
    
    showNotification('Changes saved successfully', 'success');
    
  } catch (error) {
    console.error('Error saving lead:', error);
    showNotification('Failed to save changes', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalText;
  }
}

/**
 * Approve import lead
 */
async function approveImportLead() {
  if (!currentImportLeadId) return;
  
  // Validate form
  const name = document.getElementById('importName').value.trim();
  const street = document.getElementById('importStreet').value.trim();
  const city = document.getElementById('importCity').value.trim();
  
  if (!name || !street || !city) {
    showNotification('Please fill in all required fields before approving', 'error');
    return;
  }
  
  // Confirm approval
  if (!confirm('Approve this lead? This will create a new customer and job.')) {
    return;
  }
  
  const approveBtn = document.getElementById('approveLeadBtn');
  const originalText = approveBtn.textContent;
  approveBtn.disabled = true;
  approveBtn.textContent = '⏳ Processing...';
  
  try {
    // Save any changes first
    await saveImportLead();
    
    // Approve
    const response = await fetch(`/api/import-leads/${currentImportLeadId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to approve lead');
    }
    
    const result = await response.json();
    
    showNotification(`✅ Lead approved! Customer #${result.customerId}, Job #${result.jobId}`, 'success');
    
    // Close modal and reload list
    closeImportLeadModal();
    loadImportLeads(currentFilterStatus);
    
  } catch (error) {
    console.error('Error approving lead:', error);
    showNotification(error.message || 'Failed to approve lead', 'error');
    approveBtn.disabled = false;
    approveBtn.textContent = originalText;
  }
}

/**
 * Reject import lead (show reason modal)
 */
function rejectImportLead() {
  document.getElementById('rejectReasonModal').classList.add('active');
  document.getElementById('rejectReason').value = '';
  document.getElementById('rejectReason').focus();
}

/**
 * Close reject reason modal
 */
function closeRejectReasonModal() {
  document.getElementById('rejectReasonModal').classList.remove('active');
}

/**
 * Confirm reject lead
 */
async function confirmRejectLead() {
  if (!currentImportLeadId) return;
  
  const reason = document.getElementById('rejectReason').value.trim();
  
  if (!reason) {
    showNotification('Please provide a reason for rejection', 'error');
    return;
  }
  
  try {
    const response = await fetch(`/api/import-leads/${currentImportLeadId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    
    if (!response.ok) {
      throw new Error('Failed to reject lead');
    }
    
    showNotification('Lead rejected successfully', 'success');
    
    // Close modals and reload list
    closeRejectReasonModal();
    closeImportLeadModal();
    loadImportLeads(currentFilterStatus);
    
  } catch (error) {
    console.error('Error rejecting lead:', error);
    showNotification('Failed to reject lead', 'error');
  }
}

/**
 * Format phone number
 */
function formatPhoneNumber(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Initialize import leads page
 */
function initImportLeadsPage() {
  // Load leads when page is shown
  if (document.getElementById('import-leads').classList.contains('active')) {
    loadImportLeads(currentFilterStatus);
  }
  
  // Phone input formatting
  const phoneInput = document.getElementById('importPhone');
  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 10) value = value.slice(0, 10);
      if (value.length >= 6) {
        value = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;
      } else if (value.length >= 3) {
        value = `(${value.slice(0, 3)}) ${value.slice(3)}`;
      }
      e.target.value = value;
    });
  }
  
  // Close modals on outside click
  const importModal = document.getElementById('importLeadModal');
  if (importModal) {
    importModal.addEventListener('click', (e) => {
      if (e.target.id === 'importLeadModal') {
        closeImportLeadModal();
      }
    });
  }
  
  const rejectModal = document.getElementById('rejectReasonModal');
  if (rejectModal) {
    rejectModal.addEventListener('click', (e) => {
      if (e.target.id === 'rejectReasonModal') {
        closeRejectReasonModal();
      }
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initImportLeadsPage);
} else {
  initImportLeadsPage();
}

// Export functions for global access
window.loadImportLeads = loadImportLeads;
window.filterImportLeads = filterImportLeads;
window.openImportLeadModal = openImportLeadModal;
window.closeImportLeadModal = closeImportLeadModal;
window.saveImportLead = saveImportLead;
window.approveImportLead = approveImportLead;
window.rejectImportLead = rejectImportLead;
window.closeRejectReasonModal = closeRejectReasonModal;
window.confirmRejectLead = confirmRejectLead;

