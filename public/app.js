// Global state
let customers = [];
let currentFilter = 'all';

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
    <div class="customer-card">
      <div class="customer-header">
        <div class="customer-name">${escapeHtml(customer.name)}</div>
        <div class="customer-type ${customer.customer_type?.toLowerCase()}">
          ${customer.customer_type === 'CURRENT' ? 'Current' : 'Lead'}
        </div>
      </div>
      <div class="customer-info">
        <p><strong>Email:</strong> ${escapeHtml(customer.email || '')}</p>
        <p><strong>Phone:</strong> ${escapeHtml(customer.phone || '')}</p>
        ${customer.address ? `<p><strong>Address:</strong> ${escapeHtml(customer.address)}</p>` : ''}
        ${customer.notes ? `<p><strong>Notes:</strong> ${escapeHtml(customer.notes)}</p>` : ''}
        <div style="margin-top: 10px;">
          <button onclick="editCustomer('${customer.id}')" style="background: #3B82F6; color: white; border: none; padding: 5px 10px; margin-right: 5px; border-radius: 4px; cursor: pointer;">Edit</button>
          <button onclick="createJob('${customer.id}')" style="background: #10B981; color: white; border: none; padding: 5px 10px; margin-right: 5px; border-radius: 4px; cursor: pointer;">Create Job</button>
          <button onclick="deleteCustomer('${customer.id}')" style="background: #EF4444; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
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
  document.getElementById('jobTitle').value = '';
  document.getElementById('jobDescription').value = '';
  document.getElementById('jobStatus').value = 'QUOTED';
  document.getElementById('jobPriority').value = 'medium';
  document.getElementById('jobCost').value = '';
  document.getElementById('jobStartDate').value = '';
  document.getElementById('jobEndDate').value = '';
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
  
  const jobData = {
    customer_id: customerId,
    title: document.getElementById('jobTitle').value,
    description: document.getElementById('jobDescription').value,
    status: document.getElementById('jobStatus').value,
    priority: document.getElementById('jobPriority').value,
    total_cost: parseFloat(document.getElementById('jobCost').value) || 0,
    start_date: document.getElementById('jobStartDate').value || null,
    end_date: document.getElementById('jobEndDate').value || null,
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
      // Could load jobs page or refresh customer data here
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

// Make functions globally accessible
window.showPage = showPage;
window.editCustomer = editCustomer;
window.deleteCustomer = deleteCustomer;
window.createJob = createJob;
window.showCustomerModal = showCustomerModal;
window.showJobModal = showJobModal;
window.testNavigation = testNavigation;
