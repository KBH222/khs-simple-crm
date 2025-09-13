// Global state
let customers = [];
let currentFilter = 'all';
let currentDate = new Date();
let calendarEvents = [];
let selectedDate = null;

// Utility functions
function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric', 
    month: 'long',
    day: 'numeric'
  });
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM Content Loaded!');
  updateDateTime();
  setInterval(updateDateTime, 1000);
  loadCustomers();
  
  // Event listeners
  setupEventListeners();
  
  // Add click test for debugging
  setTimeout(() => {
    testNavigation();
  }, 1000);
});

function setupEventListeners() {
  console.log('Setting up event listeners...');
  
  // Navigation cards
  const navCards = document.querySelectorAll('.nav-card');
  console.log('Found nav cards:', navCards.length);
  
  navCards.forEach((card, index) => {
    const page = card.dataset.page;
    console.log(`Nav card ${index}: page = ${page}`);
    
    card.addEventListener('click', function(e) {
      console.log('Nav card clicked:', page);
      e.preventDefault();
      if (page) {
        showPage(page);
      } else {
        console.error('No page data attribute found!');
      }
    });
    
    // Also add cursor pointer style to make it clear it's clickable
    card.style.cursor = 'pointer';
  });
  
  // Back buttons
  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => showPage('dashboard'));
  });
  
  // Add customer button
  const addCustomerBtn = document.getElementById('addCustomerBtn');
  if (addCustomerBtn) {
    addCustomerBtn.addEventListener('click', () => showCustomerModal());
  }
  
  // Modal close buttons
  document.querySelectorAll('.close-btn, .cancel-btn').forEach(btn => {
    btn.addEventListener('click', hideModals);
  });
  
  // Customer form
  const customerForm = document.getElementById('customerForm');
  if (customerForm) {
    customerForm.addEventListener('submit', handleCustomerSubmit);
  }
  
  // Job form
  const jobForm = document.getElementById('jobForm');
  if (jobForm) {
    jobForm.addEventListener('submit', handleJobSubmit);
  }
  
  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      const filter = this.dataset.type || 'all';
      setFilter(filter);
    });
  });
  
  // Search
  const searchInput = document.getElementById('customerSearch');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      renderCustomers();
    });
  }
  
  // Click outside modal to close
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        hideModals();
      }
    });
  });
}


function showPage(pageName) {
  console.log('Showing page:', pageName);
  
  // Hide all pages
  const allPages = document.querySelectorAll('.page');
  console.log('Found pages:', allPages.length);
  
  allPages.forEach(page => {
    page.classList.remove('active');
    console.log('Hiding page:', page.id);
  });
  
  // Show selected page
  const targetPage = document.getElementById(pageName);
  console.log('Target page element:', targetPage);
  
  if (targetPage) {
    targetPage.classList.add('active');
    console.log('Showing page:', pageName);
  } else {
    console.error('Page not found:', pageName);
  }
  
  // Load page-specific data
  if (pageName === 'customers') {
    loadCustomers();
  } else if (pageName === 'schedule') {
    initializeCalendar();
  }
}

function updateDateTime() {
  const now = new Date();
  
  const dateEl = document.getElementById('currentDate');
  const timeEl = document.getElementById('currentTime');
  
  if (dateEl) {
    dateEl.textContent = formatDate(now);
  }
  
  if (timeEl) {
    timeEl.textContent = formatTime(now);
  }
}

// Customer Management
async function loadCustomers() {
  try {
    const response = await fetch('/api/customers');
    const data = await response.json();
    
    if (response.ok) {
      customers = data;
      renderCustomers();
    } else {
      console.error('Failed to load customers:', data.message);
    }
  } catch (error) {
    console.error('Error loading customers:', error);
  }
}

// Load jobs for a specific customer
async function loadCustomerJobs(customerId) {
  try {
    const response = await fetch(`/api/jobs?customer_id=${customerId}`);
    const data = await response.json();
    
    const jobsContainer = document.querySelector(`#jobs-${customerId} .jobs-list`);
    const loadingSpan = document.querySelector(`#jobs-${customerId} .jobs-loading`);
    
    if (!jobsContainer || !loadingSpan) return;
    
    if (response.ok) {
      loadingSpan.style.display = 'none';
      
      if (data.length === 0) {
        jobsContainer.innerHTML = `
          <p style="color: #6B7280; font-size: 12px; margin: 5px 0;">No jobs yet</p>
        `;
      } else {
        jobsContainer.innerHTML = data.map(job => `
          <div class="job-item" style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 4px; padding: 4px 6px; margin: 2px 0; font-size: 12px; width: 200px; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#F3F4F6'" onmouseout="this.style.backgroundColor='#F9FAFB'">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div onclick="viewJob('${job.id}')" style="cursor: pointer; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                <strong>${escapeHtml(job.title)}</strong>
                ${job.total_cost > 0 ? `<span style="color: #6B7280; margin-left: 8px;">$${job.total_cost.toFixed(2)}</span>` : ''}
              </div>
              <button onclick="deleteJobFromTile('${job.id}'); event.stopPropagation();" style="background: none; border: none; color: #EF4444; font-size: 16px; font-weight: bold; cursor: pointer; padding: 2px; line-height: 1; flex-shrink: 0;">×</button>
            </div>
            ${job.description ? `<div onclick="viewJob('${job.id}')" style="color: #6B7280; margin-top: 2px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(job.description.substring(0, 30))}${job.description.length > 30 ? '...' : ''}</div>` : ''}
          </div>
        `).join('');
      }
    } else {
      loadingSpan.textContent = 'Failed to load';
      loadingSpan.style.color = '#EF4444';
    }
  } catch (error) {
    console.error('Error loading customer jobs:', error);
    const loadingSpan = document.querySelector(`#jobs-${customerId} .jobs-loading`);
    if (loadingSpan) {
      loadingSpan.textContent = 'Error loading';
      loadingSpan.style.color = '#EF4444';
    }
  }
}

// Helper function to get status colors
function getStatusColor(status) {
  switch(status) {
    case 'QUOTED': return '#6B7280';
    case 'APPROVED': return '#3B82F6';
    case 'IN_PROGRESS': return '#F59E0B';
    case 'COMPLETED': return '#10B981';
    case 'CANCELLED': return '#EF4444';
    default: return '#6B7280';
  }
}

function renderCustomers() {
  const container = document.getElementById('customersList');
  if (!container) return;
  
  // Filter customers based on current filter and search
  let filteredCustomers = customers;
  
  if (currentFilter !== 'all' && currentFilter !== '') {
    filteredCustomers = customers.filter(customer => customer.customer_type === currentFilter);
  }
  
  const searchTerm = document.getElementById('customerSearch')?.value.toLowerCase() || '';
  if (searchTerm) {
    filteredCustomers = filteredCustomers.filter(customer =>
      customer.name.toLowerCase().includes(searchTerm) ||
      customer.email.toLowerCase().includes(searchTerm) ||
      customer.phone.includes(searchTerm) ||
      (customer.address && customer.address.toLowerCase().includes(searchTerm))
    );
  }
  
  if (filteredCustomers.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #6B7280;">
        <p>No customers found${searchTerm ? ' matching your search' : ''}.</p>
        ${currentFilter === 'all' ? '<p>Add your first customer to get started!</p>' : ''}
      </div>
    `;
    return;
  }
  
  container.innerHTML = filteredCustomers.map(customer => `
    <div class="customer-card-grid">
      <div class="customer-name-cell">
        <div class="customer-name" style="font-size: 20.7px; line-height: 1.2; margin: 0; padding: 0;">${escapeHtml(customer.name)}</div>
        <div class="customer-type ${customer.customer_type?.toLowerCase()}" style="font-size: 13.8px; margin-top: 4px;">
          ${customer.customer_type === 'CURRENT' ? 'Current' : 'Lead'}
        </div>
      </div>
      
      <div class="customer-buttons-cell">
        <button onclick="editCustomer('${customer.id}')" style="background: #3B82F6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13.8px; width: 60px; margin-bottom: 8px;">Edit</button>
        <button onclick="createJob('${customer.id}')" style="background: #10B981; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13.8px; width: 60px; margin-bottom: 8px;">+ Job</button>
        <button onclick="sendText('${customer.phone}')" style="background: #8B5CF6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13.8px; width: 60px; margin-bottom: 16px;">Text</button>
        <button onclick="deleteCustomer('${customer.id}')" style="background: #EF4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13.8px; width: 60px;">Del</button>
      </div>
      
      <div class="customer-info-cell">
        <div style="margin: 0; padding: 0; line-height: 1.4;">
          <div style="margin-bottom: 8px; font-size: 16.1px; margin-top: 0; padding-top: 0;">
            <strong>Email:</strong>
            ${customer.email ? `<a href="mailto:${customer.email}" style="color: #3B82F6; text-decoration: none; margin-left: 4px;">${escapeHtml(customer.email)}</a>` : '<span style="color: #6B7280; margin-left: 4px;">Not provided</span>'}
          </div>
          <div style="margin-bottom: 8px; font-size: 16.1px;">
            <strong>Phone:</strong> 
            ${customer.phone ? `<a href="tel:${customer.phone}" style="color: #10B981; text-decoration: none; margin-left: 4px;">${escapeHtml(customer.phone)}</a>` : '<span style="color: #6B7280; margin-left: 4px;">Not provided</span>'}
          </div>
          ${customer.address ? `<div style="margin-bottom: 8px; font-size: 16.1px; line-height: 1.3;"><strong>Address:</strong><br><a href="https://maps.google.com/?q=${encodeURIComponent(customer.address)}" target="_blank" style="color: #F59E0B; text-decoration: none; display: inline-block;">${formatAddress(customer.address)}</a></div>` : ''}
          
          <div class="customer-jobs" id="jobs-${customer.id}" style="margin: 0 !important; padding: 0 !important;">
            <div class="jobs-header" style="margin: 0 !important; padding: 0 !important; margin-top: 8px !important; margin-bottom: 4px !important; font-weight: 600; color: #374151; font-size: 16.1px; display: flex; align-items: center;">
              📋 Jobs 
              <span class="jobs-loading" style="margin-left: 10px; font-size: 13.8px; color: #6B7280;">Loading...</span>
            </div>
            <div class="jobs-list" style="margin: 0 !important; padding: 0 !important;"></div>
          </div>
        </div>
      </div>
    </div>
  `).join('');
  
  // Load jobs for each customer - NOW WITH ZERO SPACING
  filteredCustomers.forEach(customer => {
    loadCustomerJobs(customer.id);
  });
}

function setFilter(filter) {
  currentFilter = filter;
  
  // Update active tab
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  const activeTab = document.querySelector(`[data-type="${filter}"]`);
  if (!activeTab) {
    const allTab = document.querySelector(`[data-type=""]:not([data-type="CURRENT"]):not([data-type="LEADS"])`);
    if (allTab) allTab.classList.add('active');
  }
  if (activeTab) {
    activeTab.classList.add('active');
  }
  
  renderCustomers();
}

function filterCustomers(searchTerm) {
  renderCustomers();
}

function showCustomerModal(customer = null) {
  const modal = document.getElementById('customerModal');
  const form = document.getElementById('customerForm');
  const title = modal.querySelector('.modal-header h3');
  
  if (customer) {
    // Edit mode
    title.textContent = 'Edit Customer';
    document.getElementById('customerName').value = customer.name;
    document.getElementById('customerEmail').value = customer.email || '';
    document.getElementById('customerPhone').value = customer.phone || '';
    document.getElementById('customerAddress').value = customer.address || '';
    document.getElementById('customerReference').value = customer.reference || '';
    document.getElementById('customerType').value = customer.customer_type || 'CURRENT';
    document.getElementById('customerNotes').value = customer.notes || '';
    form.dataset.customerId = customer.id;
  } else {
    // Add mode
    title.textContent = 'Add Customer';
    form.reset();
    delete form.dataset.customerId;
  }
  
  modal.classList.add('active');
}

function editCustomer(customerId) {
  const customer = customers.find(c => c.id === customerId);
  if (customer) {
    showCustomerModal(customer);
  }
}

async function deleteCustomer(customerId) {
  if (!confirm('Are you sure you want to delete this customer?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/customers/${customerId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      loadCustomers(); // Reload the list
    } else {
      const data = await response.json();
      alert(data.message || 'Failed to delete customer');
    }
  } catch (error) {
    console.error('Error deleting customer:', error);
    alert('Connection error. Please try again.');
  }
}

// Job Management Functions
function createJob(customerId) {
  const customer = customers.find(c => c.id === customerId);
  if (customer) {
    showJobModal(customer);
  }
}

function showJobModal(customer = null) {
  const modal = document.getElementById('jobModal');
  const form = document.getElementById('jobForm');
  const title = modal.querySelector('.modal-header h3');
  
  // Set customer info
  if (customer) {
    document.getElementById('jobCustomer').value = customer.name;
    form.dataset.customerId = customer.id;
    title.textContent = `Create Job for ${customer.name}`;
  } else {
    document.getElementById('jobCustomer').value = '';
    delete form.dataset.customerId;
    title.textContent = 'Create Job';
  }
  
  // Reset form
  document.querySelectorAll('input[name="jobType"]').forEach(radio => {
    radio.checked = false;
  });
  document.getElementById('jobDescription').value = '';
  document.getElementById('jobNotes').value = '';
  
  modal.classList.add('active');
}

async function handleJobSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const customerId = form.dataset.customerId;
  
  if (!customerId) {
    alert('Customer not selected');
    return;
  }
  
  // Get selected job type
  const selectedJobType = document.querySelector('input[name="jobType"]:checked');
  if (!selectedJobType) {
    alert('Please select a job type');
    return;
  }
  
  const jobData = {
    customer_id: customerId,
    title: selectedJobType.value,
    description: document.getElementById('jobDescription').value,
    status: 'QUOTED', // Default status
    priority: 'medium', // Default priority
    total_cost: 0, // Default cost
    start_date: null,
    end_date: null,
    notes: document.getElementById('jobNotes').value
  };
  
  try {
    const response = await fetch('/api/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jobData),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      hideModals();
      alert(`Job "${jobData.title}" created successfully!`);
      // Refresh the jobs for this customer
      loadCustomerJobs(customerId);
    } else {
      alert(data.message || 'Failed to create job');
    }
  } catch (error) {
    console.error('Error creating job:', error);
    alert('Connection error. Please try again.');
  }
}

async function handleCustomerSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const formData = new FormData(form);
  
  const customerData = {
    name: document.getElementById('customerName').value,
    email: document.getElementById('customerEmail').value,
    phone: document.getElementById('customerPhone').value,
    address: document.getElementById('customerAddress').value,
    reference: document.getElementById('customerReference').value,
    customer_type: document.getElementById('customerType').value,
    notes: document.getElementById('customerNotes').value
  };
  
  const customerId = form.dataset.customerId;
  const isEdit = !!customerId;
  
  try {
    const url = isEdit ? `/api/customers/${customerId}` : '/api/customers';
    const method = isEdit ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customerData),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      hideModals();
      loadCustomers(); // Reload the list
    } else {
      alert(data.message || 'Failed to save customer');
    }
  } catch (error) {
    console.error('Error saving customer:', error);
    alert('Connection error. Please try again.');
  }
}

function hideModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.classList.remove('active');
  });
}

// Utility functions
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Format address into two lines: street, then city/state/zip
function formatAddress(address) {
  if (!address) return '';
  
  // Common address patterns to split on
  const patterns = [
    // Pattern: "123 Main St, Anytown, ST 12345"
    /^(.+?),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5}(-\d{4})?)\s*$/,
    // Pattern: "123 Main St, Anytown ST 12345"
    /^(.+?),\s*([^,]+)\s+([A-Z]{2})\s*(\d{5}(-\d{4})?)\s*$/,
    // Pattern: "123 Main St Anytown, ST 12345"
    /^(.+?)\s+([^,]+),\s*([A-Z]{2})\s*(\d{5}(-\d{4})?)\s*$/,
    // Pattern: "123 Main St Anytown ST 12345"
    /^(.+?)\s+([A-Za-z\s]+)\s+([A-Z]{2})\s*(\d{5}(-\d{4})?)\s*$/
  ];
  
  for (const pattern of patterns) {
    const match = address.match(pattern);
    if (match) {
      const street = match[1].trim();
      const city = match[2].trim();
      const state = match[3].trim();
      const zip = match[4].trim();
      return `${escapeHtml(street)}<br>${escapeHtml(city)}, ${escapeHtml(state)} ${escapeHtml(zip)}`;
    }
  }
  
  // If no pattern matches, try to split on comma and assume last part has city/state/zip
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const street = parts.slice(0, -1).join(', ');
    const cityStateZip = parts[parts.length - 1];
    return `${escapeHtml(street)}<br>${escapeHtml(cityStateZip)}`;
  }
  
  // Fallback: return as-is if can't parse
  return escapeHtml(address);
}

// Placeholder functions for other sections
function showJobs() {
  alert('Jobs section coming soon!');
}

function showWorkers() {
  alert('Workers section coming soon!');
}

function showMaterials() {
  alert('Materials section coming soon!');
}

function showKHSInfo() {
  alert('Company Info section coming soon!');
}

function showProfile() {
  alert('Profile section coming soon!');
}

// Debug function to test navigation
function testNavigation() {
  console.log('=== NAVIGATION TEST ===');
  const navCards = document.querySelectorAll('.nav-card');
  console.log('Nav cards found:', navCards.length);
  
  navCards.forEach((card, index) => {
    console.log(`Card ${index}:`, {
      element: card,
      dataset: card.dataset,
      page: card.dataset.page,
      innerHTML: card.innerHTML.substring(0, 100)
    });
  });
  
  const pages = document.querySelectorAll('.page');
  console.log('Pages found:', pages.length);
  
  pages.forEach((page, index) => {
    console.log(`Page ${index}:`, {
      id: page.id,
      classList: Array.from(page.classList),
      visible: page.classList.contains('active')
    });
  });
  
  console.log('=== END TEST ===');
}

// Job viewing and management
let currentJob = null;

async function viewJob(jobId) {
  try {
    const response = await fetch(`/api/jobs/${jobId}`);
    const job = await response.json();
    
    if (response.ok) {
      currentJob = job;
      showJobDetailsModal(job);
    } else {
      alert('Failed to load job details');
    }
  } catch (error) {
    console.error('Error loading job:', error);
    alert('Error loading job details');
  }
}

function showJobDetailsModal(job) {
  const modal = document.getElementById('jobDetailsModal');
  
  document.getElementById('jobDetailCustomer').textContent = job.customer_name || 'Unknown';
  document.getElementById('jobDetailType').textContent = job.title;
  
  // Handle project scope
  const projectScopeEl = document.getElementById('projectScope');
  if (projectScopeEl) {
    projectScopeEl.value = job.project_scope || '';
    // Auto-save project scope on change
    projectScopeEl.onblur = () => saveProjectScope(job.id, projectScopeEl.value);
  }
  
  // Handle description
  const descGroup = document.getElementById('jobDetailDescriptionGroup');
  const descEl = document.getElementById('jobDetailDescription');
  if (job.description && job.description.trim()) {
    descEl.textContent = job.description;
    descGroup.style.display = 'block';
  } else {
    descGroup.style.display = 'none';
  }
  
  // Handle notes
  const notesGroup = document.getElementById('jobDetailNotesGroup');
  const notesEl = document.getElementById('jobDetailNotes');
  if (job.notes && job.notes.trim()) {
    notesEl.textContent = job.notes;
    notesGroup.style.display = 'block';
  } else {
    notesGroup.style.display = 'none';
  }
  
  // Initialize tabs and content
  switchJobTab('info');
  setupFileDropZones();
  loadJobTasks(job.id);
  loadJobFiles(job.id);
  loadExtraCosts(job.id);
  
  modal.classList.add('active');
}

function editJob() {
  if (currentJob) {
    alert('Job editing feature coming soon!');
    // TODO: Implement job editing
  }
}

async function deleteJob() {
  if (!currentJob) return;
  
  if (!confirm(`Are you sure you want to delete the job "${currentJob.title}"?`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/jobs/${currentJob.id}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      hideModals();
      // Refresh the jobs for this customer
      loadCustomerJobs(currentJob.customer_id);
      currentJob = null;
    } else {
      const data = await response.json();
      alert(data.message || 'Failed to delete job');
    }
  } catch (error) {
    console.error('Error deleting job:', error);
    alert('Connection error. Please try again.');
  }
}

// Delete job directly from customer tile
async function deleteJobFromTile(jobId) {
  if (!confirm('Are you sure you want to delete this job?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/jobs/${jobId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      // Find which customer this job belongs to and refresh their jobs
      const job = await fetch(`/api/jobs/${jobId}`).then(r => r.json()).catch(() => null);
      if (job && job.customer_id) {
        loadCustomerJobs(job.customer_id);
      } else {
        // Refresh all customers if we can't determine the specific customer
        loadCustomers();
      }
    } else {
      const data = await response.json();
      alert(data.message || 'Failed to delete job');
    }
  } catch (error) {
    console.error('Error deleting job:', error);
    alert('Connection error. Please try again.');
  }
}

// Save project scope
async function saveProjectScope(jobId, scope) {
  try {
    const response = await fetch(`/api/jobs/${jobId}/scope`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ project_scope: scope }),
    });
    
    if (!response.ok) {
      console.error('Failed to save project scope');
    }
  } catch (error) {
    console.error('Error saving project scope:', error);
  }
}

// Tab switching functionality
function switchJobTab(tabName) {
  // Hide all tab panels
  document.querySelectorAll('.job-tab-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  
  // Remove active class from all tabs
  document.querySelectorAll('.job-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Show selected tab panel
  const targetPanel = document.getElementById(`jobTab-${tabName}`);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }
  
  // Add active class to selected tab
  const targetTab = document.querySelector(`[data-tab="${tabName}"]`);
  if (targetTab) {
    targetTab.classList.add('active');
  }
}

// File handling functions
function setupFileDropZones() {
  // Setup pictures drop zone
  const picsDropZone = document.getElementById('picsDropZone');
  const picsFileInput = document.getElementById('picsFileInput');
  
  if (picsDropZone && picsFileInput) {
    picsDropZone.onclick = () => picsFileInput.click();
    
    picsFileInput.addEventListener('change', (e) => handleFileSelect(e, 'pics'));
    
    picsDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      picsDropZone.classList.add('dragover');
    });
    
    picsDropZone.addEventListener('dragleave', () => {
      picsDropZone.classList.remove('dragover');
    });
    
    picsDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      picsDropZone.classList.remove('dragover');
      handleFileDrop(e, 'pics');
    });
  }
  
  // Setup plans drop zone
  const plansDropZone = document.getElementById('plansDropZone');
  const plansFileInput = document.getElementById('plansFileInput');
  
  if (plansDropZone && plansFileInput) {
    plansDropZone.onclick = () => plansFileInput.click();
    
    plansFileInput.addEventListener('change', (e) => handleFileSelect(e, 'plans'));
    
    plansDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      plansDropZone.classList.add('dragover');
    });
    
    plansDropZone.addEventListener('dragleave', () => {
      plansDropZone.classList.remove('dragover');
    });
    
    plansDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      plansDropZone.classList.remove('dragover');
      handleFileDrop(e, 'plans');
    });
  }
}

function handleFileSelect(event, type) {
  const files = Array.from(event.target.files);
  uploadFiles(files, type);
}

function handleFileDrop(event, type) {
  const files = Array.from(event.dataTransfer.files);
  uploadFiles(files, type);
}

function uploadFiles(files, type) {
  console.log(`Uploading ${files.length} files to ${type}`);
  // TODO: Implement file upload to server
  alert(`File upload functionality coming soon! Selected ${files.length} ${type} files.`);
}

// Placeholder functions for tab features
function loadJobTasks(jobId) {
  console.log('Loading tasks for job:', jobId);
  // TODO: Load tasks from server
}

function loadJobFiles(jobId) {
  console.log('Loading files for job:', jobId);
  // TODO: Load files from server
}

function loadExtraCosts(jobId) {
  console.log('Loading extra costs for job:', jobId);
  // TODO: Load extra costs from server
}

function addTask() {
  alert('Add task functionality coming soon!');
}

function addExtraCost() {
  alert('Add extra cost functionality coming soon!');
}

// Communication functions
function sendText(phoneNumber) {
  if (!phoneNumber || phoneNumber === 'Not provided') {
    alert('No phone number available for this customer.');
    return;
  }
  
  // Clean phone number (remove formatting)
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  
  // Try SMS protocol first (works on mobile devices)
  if (navigator.userAgent.match(/iPhone|iPad|iPod|Android/i)) {
    window.location.href = `sms:${cleanPhone}`;
  } else {
    // For desktop, copy number to clipboard
    navigator.clipboard.writeText(cleanPhone).then(() => {
      alert(`Phone number ${phoneNumber} copied to clipboard!`);
    }).catch(() => {
      alert(`Phone number: ${phoneNumber}`);
    });
  }
}

// Calendar Functions
function initializeCalendar() {
  console.log('Initializing calendar...');
  setupCalendarEventListeners();
  renderCalendar();
  loadCalendarEvents();
}

function setupCalendarEventListeners() {
  // Navigation buttons
  const prevBtn = document.getElementById('prevMonth');
  const nextBtn = document.getElementById('nextMonth');
  const todayBtn = document.getElementById('todayBtn');
  const addEventBtn = document.getElementById('addEventBtn');
  
  if (prevBtn) prevBtn.addEventListener('click', () => navigateMonth(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => navigateMonth(1));
  if (todayBtn) todayBtn.addEventListener('click', goToToday);
  if (addEventBtn) addEventBtn.addEventListener('click', () => showEventModal());
  
  // Event form
  const eventForm = document.getElementById('eventForm');
  if (eventForm) {
    eventForm.addEventListener('submit', handleEventSubmit);
  }
  
  // All-day checkbox toggle
  const allDayCheckbox = document.getElementById('eventAllDay');
  if (allDayCheckbox) {
    allDayCheckbox.addEventListener('change', toggleTimeFields);
  }
  
  // Event type radio buttons
  const eventTypeRadios = document.querySelectorAll('input[name="eventType"]');
  eventTypeRadios.forEach(radio => {
    radio.addEventListener('change', toggleCustomerJobFields);
  });
}

function navigateMonth(direction) {
  currentDate.setMonth(currentDate.getMonth() + direction);
  renderCalendar();
  loadCalendarEvents();
}

function goToToday() {
  currentDate = new Date();
  renderCalendar();
  loadCalendarEvents();
}

function renderCalendar() {
  const monthHeader = document.getElementById('currentMonth');
  const calendarDays = document.getElementById('calendarDays');
  
  if (!monthHeader || !calendarDays) return;
  
  // Update month header
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];
  monthHeader.textContent = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  
  // Generate calendar days
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());
  
  const today = new Date();
  let calendarHTML = '';
  
  // Generate 42 days (6 weeks)
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    
    const isCurrentMonth = date.getMonth() === month;
    const isToday = date.toDateString() === today.toDateString();
    const isPast = date < today && !isToday;
    const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
    
    let classes = ['calendar-day'];
    if (!isCurrentMonth) classes.push('other-month');
    if (isToday) classes.push('today');
    if (isPast) classes.push('past');
    if (isSelected) classes.push('selected');
    
    const dateStr = date.toISOString().split('T')[0];
    
    calendarHTML += `
      <div class="${classes.join(' ')}" data-date="${dateStr}" onclick="selectDate('${dateStr}')">
        <div class="calendar-day-number">${date.getDate()}</div>
        <div class="calendar-events" id="events-${dateStr}"></div>
      </div>
    `;
  }
  
  calendarDays.innerHTML = calendarHTML;
}

function selectDate(dateStr) {
  selectedDate = new Date(dateStr + 'T12:00:00');
  
  // Update visual selection
  document.querySelectorAll('.calendar-day').forEach(day => {
    day.classList.remove('selected');
  });
  document.querySelector(`[data-date="${dateStr}"]`).classList.add('selected');
  
  // Show event modal with selected date
  showEventModal(dateStr);
}

function showEventModal(dateStr = null) {
  const modal = document.getElementById('eventModal');
  const form = document.getElementById('eventForm');
  const title = document.getElementById('eventModalTitle');
  const dateInput = document.getElementById('eventDate');
  
  if (!modal || !form) return;
  
  // Reset form
  form.reset();
  title.textContent = 'Add Event';
  delete form.dataset.eventId;
  
  // Set date if provided
  if (dateStr) {
    dateInput.value = dateStr;
  } else {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  
  // Load customers for dropdown
  populateCustomerDropdown();
  
  modal.classList.add('active');
}

function populateCustomerDropdown() {
  const customerSelect = document.getElementById('eventCustomer');
  if (!customerSelect || !customers.length) return;
  
  customerSelect.innerHTML = '<option value="">Select customer...</option>';
  customers.forEach(customer => {
    customerSelect.innerHTML += `<option value="${customer.id}">${escapeHtml(customer.name)}</option>`;
  });
}

function toggleTimeFields() {
  const allDayCheckbox = document.getElementById('eventAllDay');
  const startTimeInput = document.getElementById('eventStartTime');
  const endTimeInput = document.getElementById('eventEndTime');
  
  if (allDayCheckbox && startTimeInput && endTimeInput) {
    const disabled = allDayCheckbox.checked;
    startTimeInput.disabled = disabled;
    endTimeInput.disabled = disabled;
    if (disabled) {
      startTimeInput.value = '';
      endTimeInput.value = '';
    }
  }
}

function toggleCustomerJobFields() {
  const eventTypeRadio = document.querySelector('input[name="eventType"]:checked');
  const eventType = eventTypeRadio ? eventTypeRadio.value : 'business';
  const customerJobGroup = document.getElementById('customerJobGroup');
  
  if (customerJobGroup) {
    customerJobGroup.style.display = eventType === 'business' ? 'block' : 'none';
  }
}

async function handleEventSubmit(e) {
  e.preventDefault();
  
  const eventTypeRadio = document.querySelector('input[name="eventType"]:checked');
  
  const formData = {
    title: document.getElementById('eventTitle').value,
    description: document.getElementById('eventDescription').value,
    event_date: document.getElementById('eventDate').value,
    start_time: document.getElementById('eventStartTime').value || null,
    end_time: document.getElementById('eventEndTime').value || null,
    event_type: eventTypeRadio ? eventTypeRadio.value : 'business',
    customer_id: document.getElementById('eventCustomer').value || null,
    job_id: document.getElementById('eventJob').value || null,
    all_day: document.getElementById('eventAllDay').checked ? 1 : 0
  };
  
  try {
    const response = await fetch('/api/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    if (response.ok) {
      hideModals();
      loadCalendarEvents();
      alert('Event created successfully!');
    } else {
      const error = await response.json();
      alert(error.message || 'Failed to create event');
    }
  } catch (error) {
    console.error('Error creating event:', error);
    alert('Failed to create event');
  }
}

async function loadCalendarEvents() {
  try {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const response = await fetch(`/api/calendar/events?year=${year}&month=${month}`);
    const events = await response.json();
    
    if (response.ok) {
      calendarEvents = events;
      renderEvents();
    } else {
      console.error('Failed to load calendar events');
    }
  } catch (error) {
    console.error('Error loading calendar events:', error);
  }
}

function renderEvents() {
  // Clear existing events
  document.querySelectorAll('.calendar-events').forEach(container => {
    container.innerHTML = '';
  });
  
  calendarEvents.forEach(event => {
    const eventContainer = document.getElementById(`events-${event.event_date}`);
    if (eventContainer) {
      const eventElement = document.createElement('div');
      eventElement.className = `calendar-event ${event.event_type}`;
      eventElement.textContent = event.title;
      eventElement.title = `${event.title}\n${event.description || ''}`;
      eventElement.draggable = true;
      eventElement.dataset.eventId = event.id;
      eventElement.dataset.eventDate = event.event_date;
      
      // Add drag event listeners
      eventElement.addEventListener('dragstart', handleEventDragStart);
      eventElement.addEventListener('dragend', handleEventDragEnd);
      
      // Click handler (prevent when dragging)
      eventElement.addEventListener('click', (e) => {
        if (!eventElement.classList.contains('dragging')) {
          viewEvent(event);
        }
      });
      
      eventContainer.appendChild(eventElement);
    }
  });
  
  // Add drop event listeners to calendar days
  setupCalendarDayDropListeners();
}

function viewEvent(event) {
  alert(`Event: ${event.title}\nDate: ${event.event_date}\nType: ${event.event_type}\n\n${event.description || 'No description'}`);
}

// Drag and Drop Functions
let draggedEvent = null;
let draggedEventElement = null;

function handleEventDragStart(e) {
  draggedEventElement = e.target;
  draggedEvent = {
    id: e.target.dataset.eventId,
    originalDate: e.target.dataset.eventDate,
    title: e.target.textContent
  };
  
  e.target.classList.add('dragging');
  
  // Set drag data
  e.dataTransfer.setData('text/plain', draggedEvent.id);
  e.dataTransfer.effectAllowed = 'move';
  
  // Add visual feedback to all calendar days
  document.querySelectorAll('.calendar-day').forEach(day => {
    day.classList.add('drop-zone');
  });
  
  console.log('Started dragging event:', draggedEvent.title);
}

function handleEventDragEnd(e) {
  e.target.classList.remove('dragging');
  
  // Clean up visual feedback
  document.querySelectorAll('.calendar-day').forEach(day => {
    day.classList.remove('drop-zone', 'drag-over', 'drop-valid', 'drop-invalid');
  });
  
  draggedEvent = null;
  draggedEventElement = null;
  
  console.log('Ended dragging event');
}

function setupCalendarDayDropListeners() {
  document.querySelectorAll('.calendar-day').forEach(day => {
    // Remove existing listeners to prevent duplicates
    day.removeEventListener('dragover', handleDayDragOver);
    day.removeEventListener('dragenter', handleDayDragEnter);
    day.removeEventListener('dragleave', handleDayDragLeave);
    day.removeEventListener('drop', handleDayDrop);
    
    // Add new listeners
    day.addEventListener('dragover', handleDayDragOver);
    day.addEventListener('dragenter', handleDayDragEnter);
    day.addEventListener('dragleave', handleDayDragLeave);
    day.addEventListener('drop', handleDayDrop);
  });
}

function handleDayDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDayDragEnter(e) {
  e.preventDefault();
  if (draggedEvent && e.target.classList.contains('calendar-day')) {
    const targetDate = e.target.dataset.date;
    
    // Remove previous drag-over states
    document.querySelectorAll('.calendar-day').forEach(day => {
      day.classList.remove('drag-over', 'drop-valid', 'drop-invalid');
    });
    
    // Add drag-over state to current target
    e.target.classList.add('drag-over');
    
    // Validate drop (can't drop on same date)
    if (targetDate === draggedEvent.originalDate) {
      e.target.classList.add('drop-invalid');
    } else {
      e.target.classList.add('drop-valid');
    }
  }
}

function handleDayDragLeave(e) {
  // Only remove classes if we're actually leaving the day (not entering a child element)
  if (!e.target.contains(e.relatedTarget)) {
    e.target.classList.remove('drag-over', 'drop-valid', 'drop-invalid');
  }
}

async function handleDayDrop(e) {
  e.preventDefault();
  
  if (!draggedEvent) return;
  
  const targetDate = e.target.closest('.calendar-day')?.dataset.date;
  
  if (!targetDate) {
    console.error('No target date found');
    return;
  }
  
  // Don't allow dropping on the same date
  if (targetDate === draggedEvent.originalDate) {
    console.log('Cannot drop event on the same date');
    return;
  }
  
  console.log(`Moving event ${draggedEvent.title} from ${draggedEvent.originalDate} to ${targetDate}`);
  
  try {
    // Update event date via API
    const response = await fetch(`/api/calendar/events/${draggedEvent.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_date: targetDate,
        // Get the existing event data to preserve other fields
        ...getEventById(draggedEvent.id)
      })
    });
    
    if (response.ok) {
      console.log('Event moved successfully');
      // Reload calendar events to reflect the change
      await loadCalendarEvents();
      
      // Show success feedback
      showMoveSuccessFeedback(targetDate);
    } else {
      console.error('Failed to move event');
      alert('Failed to move event. Please try again.');
    }
  } catch (error) {
    console.error('Error moving event:', error);
    alert('Error moving event. Please try again.');
  }
}

function getEventById(eventId) {
  const event = calendarEvents.find(e => e.id === eventId);
  if (!event) return {};
  
  return {
    title: event.title,
    description: event.description,
    start_time: event.start_time,
    end_time: event.end_time,
    event_type: event.event_type,
    customer_id: event.customer_id,
    job_id: event.job_id,
    all_day: event.all_day
  };
}

function showMoveSuccessFeedback(targetDate) {
  const targetDay = document.querySelector(`[data-date="${targetDate}"]`);
  if (targetDay) {
    // Add a brief success animation
    targetDay.style.backgroundColor = '#D1FAE5';
    targetDay.style.transform = 'scale(1.05)';
    
    setTimeout(() => {
      targetDay.style.backgroundColor = '';
      targetDay.style.transform = '';
      targetDay.style.transition = 'all 0.3s ease';
    }, 500);
  }
}

// Make functions globally accessible
window.showPage = showPage;
window.editCustomer = editCustomer;
window.deleteCustomer = deleteCustomer;
window.createJob = createJob;
window.viewJob = viewJob;
window.editJob = editJob;
window.deleteJob = deleteJob;
window.deleteJobFromTile = deleteJobFromTile;
window.sendText = sendText;
window.switchJobTab = switchJobTab;
window.addTask = addTask;
window.addExtraCost = addExtraCost;
window.showCustomerModal = showCustomerModal;
window.showJobModal = showJobModal;
window.testNavigation = testNavigation;
window.selectDate = selectDate;
window.viewEvent = viewEvent;
