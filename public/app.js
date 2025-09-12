// Global state
let currentUser = null;
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
  checkAuthState();
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  // Event listeners
  setupEventListeners();
});

function setupEventListeners() {
  // Login form
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', handleLogin);
  }
  
  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  
  // Navigation cards
  document.querySelectorAll('.nav-card').forEach(card => {
    card.addEventListener('click', function() {
      const page = this.dataset.page;
      if (page) {
        showPage(page);
      }
    });
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
  
  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      const filter = this.dataset.filter;
      setFilter(filter);
    });
  });
  
  // Search
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      filterCustomers(this.value);
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

// Authentication
function checkAuthState() {
  fetch('/api/auth/check')
    .then(response => response.json())
    .then(data => {
      if (data.authenticated) {
        currentUser = data.user;
        showApp();
        loadCustomers();
      } else {
        showLogin();
      }
    })
    .catch(error => {
      console.error('Auth check failed:', error);
      showLogin();
    });
}

async function handleLogin(e) {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('errorMessage');
  
  // Clear previous errors
  errorDiv.style.display = 'none';
  
  if (!username || !password) {
    showError('Please enter both username and password');
    return;
  }
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      currentUser = data.user;
      showApp();
      loadCustomers();
    } else {
      showError(data.message || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    showError('Connection error. Please try again.');
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    customers = [];
    showLogin();
  } catch (error) {
    console.error('Logout error:', error);
    // Force logout even if request fails
    currentUser = null;
    customers = [];
    showLogin();
  }
}

function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

// UI Navigation
function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appScreen').style.display = 'none';
  
  // Clear form
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  document.getElementById('errorMessage').style.display = 'none';
}

function showApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'block';
  
  // Update header with user info
  const userNameSpan = document.getElementById('userName');
  if (userNameSpan && currentUser) {
    userNameSpan.textContent = currentUser.name || currentUser.username;
  }
  
  showPage('dashboard');
}

function showPage(pageName) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  
  // Show selected page
  const targetPage = document.getElementById(pageName + 'Page');
  if (targetPage) {
    targetPage.classList.add('active');
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
  
  if (currentFilter !== 'all') {
    filteredCustomers = customers.filter(customer => customer.type === currentFilter);
  }
  
  const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
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
    <div class="customer-card" onclick="editCustomer(${customer.id})">
      <div class="customer-header">
        <div class="customer-name">${escapeHtml(customer.name)}</div>
        <div class="customer-type ${customer.type}">
          ${customer.type === 'current' ? 'Current' : 'Lead'}
        </div>
      </div>
      <div class="customer-info">
        <p><strong>Email:</strong> ${escapeHtml(customer.email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(customer.phone)}</p>
        ${customer.address ? `<p><strong>Address:</strong> ${escapeHtml(customer.address)}</p>` : ''}
        ${customer.notes ? `<p><strong>Notes:</strong> ${escapeHtml(customer.notes)}</p>` : ''}
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
  
  const activeTab = document.querySelector(`[data-filter="${filter}"]`);
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
    form.elements.name.value = customer.name;
    form.elements.email.value = customer.email;
    form.elements.phone.value = customer.phone;
    form.elements.address.value = customer.address || '';
    form.elements.type.value = customer.type;
    form.elements.notes.value = customer.notes || '';
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

async function handleCustomerSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const formData = new FormData(form);
  
  const customerData = {
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    type: formData.get('type'),
    notes: formData.get('notes')
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
