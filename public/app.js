// API base URL patching for local UI using Railway API
(function() {
  try {
    const BASE = (typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL.trim() : '';
    if (BASE) {
      const baseNoSlash = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
      
      // Store original fetch before any modifications
      const originalFetch = window.fetch.bind(window);
      
      // First wrap with API base URL rewriting
      const fetchWithBase = function(resource, init) {
        try {
          if (typeof resource === 'string') {
            if (resource.startsWith('/api/')) {
              resource = baseNoSlash + resource;
            }
          } else if (resource instanceof Request) {
            if (resource.url && resource.url.startsWith('/api/')) {
              resource = new Request(baseNoSlash + resource.url, resource);
            }
          }
        } catch (e) {
          // no-op
        }
        return originalFetch(resource, init);
      };
      
      // Then wrap with reliable fetch if available
      if (window.apiUtils && window.apiUtils.reliableFetch) {
        // Override the reliableFetch to use our base-URL-aware fetch
        const originalReliableFetch = window.apiUtils.reliableFetch;
        window.apiUtils.reliableFetch = async function(url, options) {
          // Apply base URL transformation
          if (typeof url === 'string' && url.startsWith('/api/')) {
            url = baseNoSlash + url;
          }
          // Use the original reliable fetch with transformed URL
          return originalReliableFetch.call(this, url, options);
        };
        console.log('[API] Using reliable fetch with Railway base URL');
      } else {
        // Fallback to simple base URL wrapper
        window.fetch = fetchWithBase;
      }
      
      window.__API_BASE = baseNoSlash;
      console.log('[API_BASE_URL] Using remote API base:', baseNoSlash);
    }
  } catch (err) {
    console.warn('API base URL patch failed:', err);
    window.__API_BASE = '';
  }
})();

// Helper function to get the appropriate fetch function
function getReliableFetch() {
  return (window.apiUtils && window.apiUtils.reliableFetch) ? window.apiUtils.reliableFetch : fetch;
}

// 🚀 BEAST MODE: Global state + optimized logging
const isDev = location.hostname === 'localhost';
const log = (...args) => isDev && console.log(...args);
const logError = (...args) => console.error(...args);

let customers = [], currentFilter = 'all', currentDate = new Date();
let calendarEvents = [], selectedDate = null, autoRefreshInterval = null, isPageVisible = true;

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

// Modal management functions - define early
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
  }
}

function hideModals() {
  // Close all modals
  document.querySelectorAll('.modal').forEach(modal => {
    modal.style.display = 'none';
  });
}

// Make modal functions globally accessible immediately
window.closeModal = closeModal;
window.hideModals = hideModals;

// Initialize app
function updateEnvBadge() {
  try {
    const badge = document.getElementById('envBadge');
    if (!badge) {
      console.warn('envBadge element not found');
      return false; // Return false to indicate it needs to be retried
    }
    const base = window.__API_BASE || '';
    if (base) {
      badge.textContent = 'API: Railway';
      badge.style.backgroundColor = '#DBEAFE';
      badge.style.color = '#1D4ED8';
    } else {
      badge.textContent = 'API: Local';
      badge.style.backgroundColor = '#FEF3C7';
      badge.style.color = '#92400E';
    }
    console.log('Environment badge updated:', badge.textContent);
    console.log('Badge element:', badge);
    console.log('Badge visibility:', window.getComputedStyle(badge).display);
    return true; // Return true to indicate success
  } catch (error) {
    console.error('Error updating environment badge:', error);
    return false;
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 DOM Content Loaded - initializing app...');
  
  try {
    updateEnvBadge();
    console.log('✅ Environment badge updated');
  } catch (error) {
    console.error('❌ Error updating environment badge:', error);
  }
  
  log('DOM Content Loaded!');
  updateDateTime();
  setInterval(updateDateTime, 1000);
  loadCustomers();
  loadBackupInfo();
  loadTextSendContacts(); // Load Text Send contacts
  updateCustomNotesList(); // Initialize custom notes list
  setupEventListeners();
  setTimeout(() => testNavigation(), 1000);
});

// Fallback for environment badge if DOMContentLoaded doesn't fire
setTimeout(() => {
  if (!updateEnvBadge()) {
    // Retry every 100ms until successful
    const retryInterval = setInterval(() => {
      if (updateEnvBadge()) {
        clearInterval(retryInterval);
      }
    }, 100);
    
    // Stop retrying after 5 seconds
    setTimeout(() => clearInterval(retryInterval), 5000);
  }
}, 100);

function setupEventListeners() {
  // Contact form
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', handleContactSubmit);
  }
  log('Setting up event listeners...');
  
  // 🚀 BEAST MODE: Customer modal setup
  const customerModal = document.getElementById('customerModal');
  if (customerModal) {
    const observer = new MutationObserver(() => {
      if (customerModal.classList.contains('active')) {
        setTimeout(() => {
          setupPhoneFormatting();
          setupGoogleMapsAddressHelper();
        }, 10);
      }
    });
    observer.observe(customerModal, { attributes: true, attributeFilter: ['class'] });
  }
  
  // 🚀 BEAST MODE: Navigation cards
  const navCards = document.querySelectorAll('.nav-card');
  log('Found nav cards:', navCards.length);
  
  navCards.forEach((card, index) => {
    const page = card.dataset.page;
    log(`Nav card ${index}: page = ${page}`);
    
    card.addEventListener('click', function(e) {
      log('Nav card clicked:', page);
      e.preventDefault();
      if (page) {
        showPage(page);
      } else {
        logError('No page data attribute found!');
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
  
  // Click outside modal to close (improved detection)
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
      // Only close if clicking directly on the modal backdrop
      // Check if the click target is the modal itself (not any child elements)
      if (e.target === modal) {
        hideModals();
      }
    });
  });
  
  // Prevent modal content clicks from bubbling to the modal
  document.querySelectorAll('.modal-content').forEach(content => {
    content.addEventListener('click', function(e) {
      e.stopPropagation(); // Prevent the click from reaching the modal
    });
  });
  
  // Prevent all form element events from bubbling up and closing modals
  document.addEventListener('DOMContentLoaded', function() {
    // Add event stopping to all form elements in modals
    const formElements = 'input, textarea, select, button[type="button"], label';
    document.querySelectorAll('.modal ' + formElements).forEach(element => {
      ['click', 'focus', 'blur', 'input', 'change'].forEach(eventType => {
        element.addEventListener(eventType, function(e) {
          e.stopPropagation();
        });
      });
    });
  });
  
  // Workers event listeners
  setupWorkerEventListeners();
}


window.showPage = function(pageName) {
  log('🚀 Showing page:', pageName);
  
  // Hide all pages
  const allPages = document.querySelectorAll('.page');
  log('Found pages:', allPages.length);
  
  allPages.forEach(page => {
    page.classList.remove('active');
    log('Hiding page:', page.id);
  });
  
  // Show selected page
  const targetPage = document.getElementById(pageName);
  log('Target page element:', targetPage);
  
  if (targetPage) {
    targetPage.classList.add('active');
    // Reset scroll position on all scroll containers, including the active page element itself
    try {
      // The .page element is the actual scroll container (overflow-y: auto)
      targetPage.scrollTop = 0;
      const main = document.querySelector('.app-main');
      if (main) main.scrollTop = 0;
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0; else window.scrollTo(0, 0);
    } catch (_) {}
    log('✅ Successfully showing page:', pageName);
  } else {
    logError('❌ Page not found:', pageName);
  }
  
  // Load page-specific data
  if (pageName === 'customers') {
    loadCustomers();
  } else if (pageName === 'schedule') {
    initializeCalendar();
  } else if (pageName === 'settings') {
    setupSettingsTabs();
    loadBackupHistory();
  } else if (pageName === 'workers') {
    initializeTeamMembers();
  } else if (pageName === 'materials') {
    loadMasterLists();
    loadMasterListPreferences();
  } else if (pageName === 'profile') {
    showProfile();
  } else if (pageName === 'import-leads') {
    if (typeof loadImportLeads === 'function') {
      loadImportLeads('pending');
    }
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
    const fetchFn = getReliableFetch();
    const response = await fetchFn('/api/customers');
    const data = await response.json();
    
    if (response.ok) {
      customers = data;
      renderCustomers();
    } else {
      logError('Failed to load customers:', data.message);
    }
  } catch (error) {
    logError('Error loading customers:', error);
  }
}

// Load jobs for a specific customer
async function loadCustomerJobs(customerId) {
  try {
    const fetchFn = getReliableFetch();
    const response = await fetchFn(`/api/jobs?customer_id=${customerId}`);
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
<div class="job-item job-${job.title.toLowerCase()}" style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 12px 5px; margin: 4px 0 2px 0; font-size: 16.1px; width: 110px; transition: background-color 0.2s;">
<div style="display: flex; justify-content: space-between; align-items: center;">
<div onclick="viewJob('${job.id}')" style="cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                <strong class="job-title" style="font-size: 14px;">${escapeHtml(job.title)}</strong></div>
<button onclick="deleteJobFromTile('${job.id}'); event.stopPropagation();" style="background: none; border: none; color: #EF4444; font-size: 18px; font-weight: bold; cursor: pointer; padding: 0; line-height: 1; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">×</button>
              </div>
            ${job.description ? `<div onclick="viewJob('${job.id}')" style="color: #6B7280; margin-top: 6px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px;">${escapeHtml(job.description.substring(0, 30))}${job.description.length > 30 ? '...' : ''}</div>` : ''}
          </div>
        `).join('');
      }
    } else {
      loadingSpan.textContent = 'Failed to load';
      loadingSpan.style.color = '#EF4444';
    }
  } catch (error) {
    logError('Error loading customer jobs:', error);
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
          <div style="display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0;">
            <div style="display: flex; gap: 12px; margin: 0; padding: 0;">
              <div class="customer-name" style="font-size: 20.7px; line-height: 1.2; margin: 0; padding: 0;">${escapeHtml(customer.name)}</div>
              <div class="customer-type ${customer.customer_type?.toLowerCase()}" style="font-size: 13.8px; padding: 4px 8px; border-radius: 4px; font-weight: 500; white-space: nowrap; margin: 0; display: flex; align-items: center;">
                ${customer.customer_type === 'CURRENT' ? 'C' : 'L'}
              </div>
            </div>
            ${/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? 
              `<button class="text-to-sub-btn" onclick="console.log('Button clicked!'); shareCustomerInfo('${customer.id}')" 
                title="Share customer info">Share Info</button>` : ''}
          </div>
      </div>
      
      <div class="customer-buttons-cell">
        <button onclick="editCustomer('${customer.id}')" style="background: #DBEAFE; border: 1px solid #3B82F6; color: #1E40AF; padding: 6px 4px; border-radius: 6px; cursor: pointer; font-size: 12px; width: 50px; transition: all 0.2s; text-align: center; white-space: nowrap; overflow: hidden;" onmouseover="this.style.backgroundColor='#3B82F6'; this.style.color='white'; this.style.borderColor='#3B82F6';" onmouseout="this.style.backgroundColor='#DBEAFE'; this.style.color='#1E40AF'; this.style.borderColor='#3B82F6';">Edit</button>
        <button onclick="createJob('${customer.id}')" style="background: #DCFCE7; border: 1px solid #10B981; color: #065F46; padding: 6px 4px; border-radius: 6px; cursor: pointer; font-size: 12px; width: 50px; transition: all 0.2s; text-align: center; white-space: nowrap; overflow: hidden;" onmouseover="this.style.backgroundColor='#10B981'; this.style.color='white'; this.style.borderColor='#10B981';" onmouseout="this.style.backgroundColor='#DCFCE7'; this.style.color='#065F46'; this.style.borderColor='#10B981';">Job</button>
        <button onclick="deleteCustomer('${customer.id}')" style="background: #DC2626; border: 1px solid #991B1B; color: #FFFFFF; padding: 6px 4px; border-radius: 6px; cursor: pointer; font-size: 12px; width: 50px; transition: all 0.2s; text-align: center; white-space: nowrap; overflow: hidden; font-weight: 600;" onmouseover="this.style.backgroundColor='#B91C1C'; this.style.color='#FFFFFF'; this.style.borderColor='#7F1D1D';" onmouseout="this.style.backgroundColor='#DC2626'; this.style.color='#FFFFFF'; this.style.borderColor='#991B1B';">Del</button>
      </div>
      
      <div class="customer-info-cell">
        <div style="margin: 0; padding: 0; line-height: 1.4;">
          <div style="margin-bottom: 8px; font-size: 16.1px; margin-top: 16px; padding-top: 0;">
            <strong>Email:</strong>
            ${customer.email ? `<a href=\"mailto:${customer.email}\" style=\"color: #3B82F6; text-decoration: none; margin-left: 4px;\">${escapeHtml(customer.email)}</a>` : '<span style=\"color: #6B7280; margin-left: 4px;\">Not provided</span>'}
          </div>
          <div style="margin-bottom: 8px; font-size: 16.1px; display: flex; align-items: center; gap: 12px;">
            <div>
              <strong>Phone:</strong> 
              ${customer.phone ? `<a href=\"tel:${customer.phone}\" style=\"color: #10B981; text-decoration: none; margin-left: 4px;\">${formatPhoneNumber(customer.phone)}</a>` : '<span style=\"color: #6B7280; margin-left: 4px;\">Not provided</span>'}
            </div>
            ${customer.phone ? `<button onclick=\"sendText('${customer.phone}')\" style=\"background: #FEF3C7; border: 1px solid #F59E0B; color: #92400E; padding: 0; border-radius: 6px; cursor: pointer; font-size: 12px; white-space: nowrap; transition: all 0.2s; display: flex; align-items: center; justify-content: center; height: 28px; min-width: 40px;\" onmouseover=\"this.style.backgroundColor='#F59E0B'; this.style.color='white'; this.style.borderColor='#F59E0B';\" onmouseout=\"this.style.backgroundColor='#FEF3C7'; this.style.color='#92400E'; this.style.borderColor='#F59E0B';\">Text</button>` : ''}
          </div>
          ${customer.address ? `<div style=\"margin-bottom: 8px; font-size: 16.1px; line-height: 1.3;\"><div style=\"display: flex; align-items: flex-start;\"><strong style=\"margin-right: 4px; flex-shrink: 0;\">Site:</strong><a href=\"https://maps.google.com/?q=${encodeURIComponent(customer.address)}\" target=\"_blank\" style=\"color: #3B82F6; text-decoration: none; flex: 1;\">${formatAddress(customer.address)}</a></div></div>` : ''}
          
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
    document.getElementById('customerPhone').value = formatPhoneNumber(customer.phone || '');
    
    // Parse existing address or set defaults
    if (customer.address) {
      const addressParts = parseAddress(customer.address);
      document.getElementById('customerStreet').value = addressParts.street;
      document.getElementById('customerCity').value = addressParts.city;
      document.getElementById('customerState').value = addressParts.state || 'Hawaii';
      document.getElementById('customerZip').value = addressParts.zip;
    } else {
      document.getElementById('customerStreet').value = '';
      document.getElementById('customerCity').value = '';
      document.getElementById('customerState').value = 'HI';
      document.getElementById('customerZip').value = '';
    }
    
    // Set radio buttons for reference and type
    const referenceRadio = document.querySelector(`input[name="customerReference"][value="${customer.reference}"]`);
    if (referenceRadio) {
      referenceRadio.checked = true;
    }
    
    const typeRadio = document.querySelector(`input[name="customerType"][value="${customer.customer_type || 'CURRENT'}"]`);
    if (typeRadio) {
      typeRadio.checked = true;
    }
    document.getElementById('customerNotes').value = customer.notes || '';
    form.dataset.customerId = customer.id;
  } else {
    // Add mode
    title.textContent = 'Add Customer';
    form.reset();
    // Set HI as default state for new customers (after reset)
    setTimeout(() => {
      document.getElementById('customerState').value = 'HI';
    }, 10);
    delete form.dataset.customerId;
  }
  
  modal.classList.add('active');
  
  // 🚀 BEAST MODE setup - phone formatting and Google Maps helper
  setTimeout(() => {
    setupPhoneFormatting(); // Universal phone formatter!
    setupGoogleMapsAddressHelper();
  }, 50);
}

function editCustomer(customerId) {
  const customer = customers.find(c => c.id === customerId);
  if (customer) {
    showCustomerModal(customer);
  }
}

async function deleteCustomer(customerId) {
  try {
    const fetchFn = getReliableFetch();
    const response = await fetchFn(`/api/customers/${customerId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      loadCustomers(); // Reload the list
    } else {
      logError('Failed to delete customer');
    }
  } catch (error) {
    logError('Error deleting customer:', error);
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
    logError('❌ Customer not selected');
    return;
  }
  
  // Get selected job type
  const selectedJobType = document.querySelector('input[name="jobType"]:checked');
  if (!selectedJobType) {
    logError('❌ Please select a job type');
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
    const fetchFn = getReliableFetch();
    const response = await fetchFn('/api/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jobData),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      hideModals();
      log(`✅ Job "${jobData.title}" created successfully!`);
      // Refresh the jobs for this customer
      loadCustomerJobs(customerId);
    } else {
      logError(data.message || 'Failed to create job');
    }
  } catch (error) {
    logError('Error creating job:', error);
  }
}

async function handleCustomerSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const formData = new FormData(form);
  
  // Get and clean phone number (remove formatting)
  const phoneValue = document.getElementById('customerPhone').value.trim();
  const cleanPhone = phoneValue.replace(/\D/g, ''); // Remove all non-digits
  
  // Combine address fields into single address string
  const street = document.getElementById('customerStreet').value.trim();
  const city = document.getElementById('customerCity').value.trim();
  const state = document.getElementById('customerState').value.trim(); // Should be 'HI'
  const zip = document.getElementById('customerZip').value.trim();
  
  let fullAddress = '';
  if (street) {
    fullAddress = street;
    if (city && zip) {
      fullAddress += `, ${city}, ${state} ${zip}`;
    } else if (city) {
      fullAddress += `, ${city}, ${state}`;
    }
  }
  
  // Get selected radio button values
  const selectedReference = document.querySelector('input[name="customerReference"]:checked');
  const selectedType = document.querySelector('input[name="customerType"]:checked');
  
  const customerData = {
    name: document.getElementById('customerName').value,
    email: document.getElementById('customerEmail').value,
    phone: cleanPhone, // Store clean digits only
    address: fullAddress,
    reference: selectedReference ? selectedReference.value : '',
    customer_type: selectedType ? selectedType.value : 'CURRENT',
    notes: document.getElementById('customerNotes').value
  };
  
  const customerId = form.dataset.customerId;
  const isEdit = !!customerId;
  
  try {
    const url = isEdit ? `/api/customers/${customerId}` : '/api/customers';
    const method = isEdit ? 'PUT' : 'POST';
    
    const fetchFn = getReliableFetch();
    const response = await fetchFn(url, {
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
      logError(data.message || 'Failed to save customer');
    }
  } catch (error) {
    logError('Error saving customer:', error);
  }
}

function hideModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.classList.remove('active');
  });
  
  // Reset file drop zones setup flag so they can be set up for next job
  fileDropZonesSetup = false;
}

// Utility functions
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Text to Sub functionality
function textToSub(name, phone, address) {
  // Create the message text
  const messageLines = [];
  messageLines.push(`Customer: ${name}`);
  if (phone) messageLines.push(`Phone: ${formatPhoneNumber(phone)}`);
  
  // Format address with city, state, zip if available
  if (address) {
    const addressParts = parseAddress(address);
    if (addressParts.street) {
      messageLines.push(`Address: ${addressParts.street}`);
      const cityStateZip = `${addressParts.city}${addressParts.state ? ', ' + addressParts.state : ''}${addressParts.zip ? ' ' + addressParts.zip : ''}`;
      if (cityStateZip.trim()) {
        messageLines.push(`         ${cityStateZip}`);
      }
    } else {
      // Fallback to full address if parsing fails
      messageLines.push(`Address: ${address}`);
    }
  }
  
  // URL encode the message for SMS
  const message = encodeURIComponent(messageLines.join('\n'));
  
  // Try to use the native SMS app
  window.location.href = `sms:?body=${message}`;
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

// 🚀 BEAST MODE: Placeholder functions for other sections
function showJobs() {
  log('🚧 Jobs section coming soon!');
}

function showWorkers() {
  log('🚧 Workers section coming soon!');
}

function showMaterials() {
  log('🚧 Materials section coming soon!');
}

function showKHSInfo() {
  log('🚧 Company Info section coming soon!');
}

// Profile Module Functions
let currentProfileData = null;

function showProfile() {
  log('📋 Loading profile page...');
  setupProfileTabs();
  loadProfileData();
}

// Load profile data on page load
document.addEventListener('DOMContentLoaded', async function() {
  // Get display elements
  const displayName = document.getElementById('displayName');
  const displayEmail = document.getElementById('displayEmail');
  const displayRole = document.getElementById('displayRole');
  
  try {
    log('📡 Fetching profile data on page load...');
    
    // Set loading state with classes
    if (displayName) {
      displayName.textContent = 'Loading...';
      displayName.classList.add('status-loading');
      displayName.classList.remove('status-error');
    }
    if (displayEmail) {
      displayEmail.textContent = 'Loading...';
      displayEmail.classList.add('status-loading');
      displayEmail.classList.remove('status-error');
    }
    if (displayRole) {
      displayRole.textContent = 'Loading...';
      displayRole.classList.add('status-loading');
      displayRole.classList.remove('status-error');
    }
    
    const response = await fetch('/api/profile');
    
    // Check if response is ok (status 200-299)
    if (!response.ok) {
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      console.log(`[${timestamp}] Error loading profile: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    const data = await response.json();
    
    if (data.success && data.user) {
      // Update header display elements with real data and remove status classes
      if (displayName) {
        displayName.textContent = data.user.name;
        displayName.classList.remove('status-loading', 'status-error');
      }
      if (displayEmail) {
        displayEmail.textContent = data.user.email;
        displayEmail.classList.remove('status-loading', 'status-error');
      }
      if (displayRole) {
        displayRole.textContent = data.user.role;
        displayRole.classList.remove('status-loading', 'status-error');
      }
      
      log('✅ Profile data loaded and UI updated');
    } else {
      throw new Error(data.error || 'Failed to load profile data');
    }
  } catch (error) {
    // Log error with timestamp in the requested format
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    console.log(`[${timestamp}] Error loading profile: ${error.message}`);
    
    // Set error state for display elements with classes
    if (displayName) {
      displayName.textContent = 'Error loading profile';
      displayName.classList.remove('status-loading');
      displayName.classList.add('status-error');
    }
    if (displayEmail) {
      displayEmail.textContent = 'Error loading profile';
      displayEmail.classList.remove('status-loading');
      displayEmail.classList.add('status-error');
    }
    if (displayRole) {
      displayRole.textContent = 'Error loading profile';
      displayRole.classList.remove('status-loading');
      displayRole.classList.add('status-error');
    }
    
    // Keep existing error logging for debugging
    console.error('Error loading profile data on page load:', error);
    log('❌ Failed to load profile data:', error.message);
  }
});

// 🚀 BEAST MODE: Debug function to test navigation
function testNavigation() {
  log('=== NAVIGATION TEST ===');
  const navCards = document.querySelectorAll('.nav-card');
  log('Nav cards found:', navCards.length);
  
  navCards.forEach((card, index) => {
    log(`Card ${index}:`, {
      element: card,
      dataset: card.dataset,
      page: card.dataset.page,
      innerHTML: card.innerHTML.substring(0, 100)
    });
  });
  
  const pages = document.querySelectorAll('.page');
  log('Pages found:', pages.length);
  
  pages.forEach((page, index) => {
    log(`Page ${index}:`, {
      id: page.id,
      classList: Array.from(page.classList),
      visible: page.classList.contains('active')
    });
  });
  
  log('=== END TEST ===');
}

// Job viewing and management
let currentJob = null;
let jobWorkers = []; // Store workers for task assignment

async function viewJob(jobId) {
  try {
    // Load job details
    const response = await fetch(`/api/jobs/${jobId}`);
    const job = await response.json();
    
    if (response.ok) {
      currentJob = job;
      
      // Load workers for task assignment
      try {
        const workersResponse = await fetch('/api/workers?status=ACTIVE');
        if (workersResponse.ok) {
          jobWorkers = await workersResponse.json();
        }
      } catch (err) {
        logError('Failed to load workers:', err);
        jobWorkers = [];
      }
      
      showJobDetailsModal(job);
    } else {
      logError('Failed to load job details');
    }
  } catch (error) {
    logError('Error loading job:', error);
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
  loadJobTools(job.id);
  loadJobMaterials(job.id);
  loadJobFiles(job.id);
  loadExtraCosts(job.id);
  
  modal.classList.add('active');
}

function editJob() {
  if (currentJob) {
    log('🚧 Job editing feature coming soon!');
    // TODO: Implement job editing
  }
}

async function deleteJob() {
  if (!currentJob) return;
  
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
      logError('Failed to save job');
    }
  } catch (error) {
    logError('Error saving job:', error);
  }
}

// Delete job directly from customer tile
async function deleteJobFromTile(jobId) {
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
      logError('Failed to delete job');
    }
  } catch (error) {
    logError('Error deleting job:', error);
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
      logError('Failed to save project scope');
    }
  } catch (error) {
    logError('Error saving project scope:', error);
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
  
// Load data for specific tabs
  if (currentJob && currentJob.id) {
    if (tabName === 'tasks') {
      log('📋 Loading tasks for job:', currentJob.id);
      loadJobTasks(currentJob.id);
    } else if (tabName === 'tools') {
      log('🔧 Loading tools for job:', currentJob.id);
      loadJobTools(currentJob.id);
    } else if (tabName === 'materials') {
      log('📦 Loading materials for job:', currentJob.id);
      loadJobMaterials(currentJob.id);
    } else if (tabName === 'extra') {
      log('💰 Loading extra costs for job:', currentJob.id);
      loadExtraCosts(currentJob.id);
    } else if (tabName === 'pics' || tabName === 'plans') {
      log(`📁 Setting up file drop zones for ${tabName} tab`);
      // Re-setup file drop zones to ensure they're working
      setTimeout(() => setupFileDropZones(), 100);
    }
  } else {
    log('⚠️ No currentJob set or no ID:', { currentJob });
  }
}

// File handling functions
let fileDropZonesSetup = false;

function setupFileDropZones() {
  log('📁 Setting up file drop zones...');
  
  // Prevent duplicate setup
  if (fileDropZonesSetup) {
    log('🚫 File drop zones already set up, skipping...');
    return;
  }
  
  // Setup pictures drop zone
  const picsDropZone = document.getElementById('picsDropZone');
  const picsFileInput = document.getElementById('picsFileInput');
  
  log('Pics drop zone elements:', { picsDropZone, picsFileInput });
  
  if (picsDropZone && picsFileInput) {
    log('🌄 Setting up pics drop zone event listeners');
    
    picsDropZone.onclick = () => {
      log('🌄 Pics drop zone clicked - opening file dialog');
      picsFileInput.click();
    };
    
    picsFileInput.addEventListener('change', (e) => {
      log('📝 File input changed:', e.target.files);
      handleFileSelect(e, 'pics');
    });
    
    picsDropZone.addEventListener('dragenter', (e) => {
      log('➡️ Dragenter on pics zone');
      e.preventDefault();
      picsDropZone.classList.add('dragover');
    });
    
    picsDropZone.addEventListener('dragover', (e) => {
      log('➡️ Dragover on pics zone');
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      picsDropZone.classList.add('dragover');
    });
    
    picsDropZone.addEventListener('dragleave', (e) => {
      log('⬅️ Dragleave on pics zone');
      // Only remove class if we're actually leaving the drop zone (not entering a child)
      if (!picsDropZone.contains(e.relatedTarget)) {
        picsDropZone.classList.remove('dragover');
      }
    });
    
    picsDropZone.addEventListener('drop', (e) => {
      log('📦 Drop on pics zone:', e.dataTransfer.files);
      e.preventDefault();
      picsDropZone.classList.remove('dragover');
      handleFileDrop(e, 'pics');
    });
    
    log('✅ Pics drop zone setup complete');
  } else {
    logError('❌ Could not find pics drop zone elements:', { picsDropZone, picsFileInput });
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
  
  fileDropZonesSetup = true;
}

function handleFileSelect(event, type) {
  log(`📝 handleFileSelect called for type: ${type}`);
  const files = Array.from(event.target.files);
  log('📁 Selected files:', files.map(f => ({ name: f.name, type: f.type, size: f.size })));
  uploadFiles(files, type);
}

function handleFileDrop(event, type) {
  log(`📦 handleFileDrop called for type: ${type}`);
  const files = Array.from(event.dataTransfer.files);
  log('📦 Dropped files:', files.map(f => ({ name: f.name, type: f.type, size: f.size })));
  uploadFiles(files, type);
}

async function uploadFiles(files, type) {
  log(`🚀 uploadFiles called: ${files.length} files to ${type}`);
  
  if (files.length === 0) {
    log('⚠️ No files provided to upload');
    return;
  }
  
  if (!currentJob || !currentJob.id) {
    logError('❌ No current job selected for upload');
    alert('Please select a job first before uploading photos');
    return;
  }
  
  // Show immediate feedback to user
  log(`📤 Uploading ${files.length} ${type} files to job ${currentJob.id}`);
  
  // Create FormData for upload
  const formData = new FormData();
  files.forEach(file => {
    formData.append('photos', file);
  });
  formData.append('photoType', type);
  
  try {
    // Show loading state
    const uploadStatus = document.createElement('div');
    uploadStatus.innerHTML = `<p>Uploading ${files.length} ${type} files...</p>`;
    uploadStatus.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #EBF8FF; border: 1px solid #3B82F6; padding: 10px; border-radius: 4px; z-index: 1000;';
    document.body.appendChild(uploadStatus);
    
    const response = await fetch(`/api/jobs/${currentJob.id}/photos`, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    // Remove loading status
    document.body.removeChild(uploadStatus);
    
    if (response.ok) {
      log('✅ Upload successful:', result);
      
      // Show success message
      const successMsg = document.createElement('div');
      successMsg.innerHTML = `<p>✅ ${result.message}</p>`;
      successMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #F0FDF4; border: 1px solid #22C55E; color: #166534; padding: 10px; border-radius: 4px; z-index: 1000;';
      document.body.appendChild(successMsg);
      setTimeout(() => document.body.removeChild(successMsg), 5000);
      
      // Reload photos for this job
      await loadJobFiles(currentJob.id);
    } else {
      logError('Upload failed:', result);
      alert(`Upload failed: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    logError('Upload error:', error);
    alert(`Upload error: ${error.message}`);
  }
}

// Keep track of uploaded files for management
let currentJobPics = [];

// Task management variables
let currentJobTasks = [];
let currentJobTools = [];
let currentJobExtraCosts = [];
let taskDraggedElement = null;
let toolDraggedElement = null;

// Load and display tasks
async function loadJobTasks(jobId) {
  log('loadJobTasks called with jobId:', jobId);
  try {
    const url = `/api/jobs/${jobId}/tasks`;
    log('Fetching:', url);
    const response = await fetch(url);
    const tasks = await response.json();
    
    log('API Response:', { status: response.status, tasks });
    
    if (response.ok) {
      currentJobTasks = tasks;
      log('About to render tasks:', tasks);
      renderTasks();
    } else {
      logError('Failed to load tasks:', tasks.error);
    }
  } catch (error) {
    logError('Error loading tasks:', error);
  }
}

function renderTasks() {
  const tasksList = document.getElementById('tasksList');
  
  if (!currentJobTasks || currentJobTasks.length === 0) {
    tasksList.innerHTML = `
      <div class="tasks-wrapper">
        <p style="color: #6B7280; text-align: center; padding: 20px 20px 40px 20px;">No tasks yet. Add your first task below!</p>
      </div>
      <div class="task-input-container">
        <input type="text" id="newTaskInput" placeholder="Add a task and press Enter..." class="task-input">
      </div>
    `;
  } else {
    // Build worker options for dropdown
    const workerOptions = jobWorkers.map(w => 
      `<option value="${w.id}">${w.initials || w.name.split(' ').map(n => n[0]).join('').toUpperCase()}</option>`
    ).join('');
    
    tasksList.innerHTML = `
      <div class="list-header-actions">
        <button class="clear-list-btn" onclick="clearJobTasks()" title="Clear all tasks">
          <span>🗑️</span> Clear List
        </button>
      </div>
      <div class="tasks-wrapper">
        <div class="tasks-container" id="tasksContainer">
          ${currentJobTasks.map(task => {
            const workerInitials = task.worker_initials || '';
            return `
            <div class="task-item" data-task-id="${task.id}" draggable="true">
              <div class="task-content">
                <input type="checkbox" class="task-checkbox" 
                       ${task.completed ? 'checked' : ''} 
                       onchange="toggleTask('${task.id}', this.checked)">
                <span class="task-description ${task.completed ? 'completed' : ''}">${escapeHtml(task.description)}</span>
                <select class="task-worker-select" 
                        onchange="assignWorkerToTask('${task.id}', this.value)"
                        style="margin-left: 8px; padding: 2px 4px; font-size: 12px; border: 1px solid #D1D5DB; border-radius: 4px; background: white;">
                  <option value="">--</option>
                  ${workerOptions}
                </select>
                ${workerInitials ? `<span class="task-worker-initials" style="margin-left: 4px; color: #3B82F6; font-weight: 600; font-size: 11px;">[${workerInitials}]</span>` : ''}
              </div>
              <button class="task-delete-btn" onclick="deleteTask('${task.id}')" title="Delete task">×</button>
            </div>
            `;
          }).join('')}
        </div>
      </div>
      <div class="task-input-container">
        <input type="text" id="newTaskInput" placeholder="Add a task and press Enter..." class="task-input">
      </div>
    `;
    
    // Set selected workers in dropdowns
    currentJobTasks.forEach(task => {
      if (task.worker_id) {
        const select = document.querySelector(`[data-task-id="${task.id}"] .task-worker-select`);
        if (select) select.value = task.worker_id;
      }
    });
    
    setupTaskDragAndDrop();
  }
  
  setupTaskInput();
}

function setupTaskInput() {
  const taskInput = document.getElementById('newTaskInput');
  if (taskInput) {
    taskInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter' && taskInput.value.trim()) {
        await addTask(taskInput.value.trim());
        taskInput.value = '';
        // Keep focus in the input for continuous task adding
        taskInput.focus();
      }
    });
    // Auto-focus when the input is created
    taskInput.focus();
  }
}

async function addTask(description) {
  if (!currentJob || !description) return;
  
  try {
    const response = await fetch(`/api/jobs/${currentJob.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ description }),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      await loadJobTasks(currentJob.id); // Reload tasks
      // Auto-scroll to show the newly added task - optimized for bottom input
      setTimeout(() => {
        const tasksContainer = document.getElementById('tasksContainer');
        if (tasksContainer) {
          const lastTask = tasksContainer.lastElementChild;
          
          // Always scroll to bottom since input is now at bottom
          tasksContainer.scrollTo({
            top: tasksContainer.scrollHeight,
            behavior: 'smooth'
          });
          
          // For mobile devices, ensure the new task is visible
          if (lastTask) {
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            
            if (isMobile) {
              // Scroll to make the new task visible but not necessarily at bottom
              // This works better with the input being at the bottom
              lastTask.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest',
                inline: 'nearest'
              });
            }
          }
        }
      }, 300);
    } else {
      logError('Failed to add task:', result.error);
    }
  } catch (error) {
    logError('Error adding task:', error);
  }
}

async function toggleTask(taskId, completed) {
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ completed }),
    });
    
    if (response.ok) {
      // Update local state
      const task = currentJobTasks.find(t => t.id === taskId);
      if (task) {
        task.completed = completed;
        renderTasks();
      }
    } else {
      logError('Failed to update task');
    }
  } catch (error) {
    logError('Error updating task:', error);
  }
}

async function assignWorkerToTask(taskId, workerId) {
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ worker_id: workerId }),
    });
    
    if (response.ok) {
      // Reload tasks to get updated worker initials
      await loadJobTasks(currentJob.id);
    } else {
      logError('Failed to assign worker to task');
    }
  } catch (error) {
    logError('Error assigning worker:', error);
  }
}

async function deleteTask(taskId) {
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE',
    });
    
    if (response.ok) {
      await loadJobTasks(currentJob.id); // Reload tasks
    } else {
      logError('Failed to delete task');
    }
  } catch (error) {
    logError('Error deleting task:', error);
  }
}

// Drag and drop for task reordering
function setupTaskDragAndDrop() {
  const taskItems = document.querySelectorAll('.task-item');
  const tasksContainer = document.getElementById('tasksContainer');
  
  taskItems.forEach(item => {
    item.addEventListener('dragstart', handleTaskDragStart);
    item.addEventListener('dragend', handleTaskDragEnd);
  });
  
  if (tasksContainer) {
    tasksContainer.addEventListener('dragover', handleTaskDragOver);
    tasksContainer.addEventListener('drop', handleTaskDrop);
  }
}

function handleTaskDragStart(e) {
  taskDraggedElement = e.target;
  e.target.classList.add('dragging');
}

function handleTaskDragEnd(e) {
  e.target.classList.remove('dragging');
  taskDraggedElement = null;
}

function handleTaskDragOver(e) {
  e.preventDefault();
  const container = e.currentTarget;
  const afterElement = getDragAfterElement(container, e.clientY);
  const draggable = document.querySelector('.dragging');
  
  if (afterElement == null) {
    container.appendChild(draggable);
  } else {
    container.insertBefore(draggable, afterElement);
  }
}

function handleTaskDrop(e) {
  e.preventDefault();
  updateTaskOrder();
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function updateTaskOrder() {
  const taskItems = document.querySelectorAll('.task-item');
  const taskIds = Array.from(taskItems).map(item => item.dataset.taskId);
  
  try {
    const response = await fetch(`/api/jobs/${currentJob.id}/tasks/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskIds }),
    });
    
    if (!response.ok) {
      logError('Failed to update task order');
      // Reload tasks to revert to original order
      await loadJobTasks(currentJob.id);
    }
  } catch (error) {
    logError('Error updating task order:', error);
  }
}

// Tool management functions - Similar to task management
async function loadJobTools(jobId) {
  log('loadJobTools called with jobId:', jobId);
  try {
    const url = `/api/jobs/${jobId}/tools`;
    log('Fetching:', url);
    const response = await fetch(url);
    const tools = await response.json();
    
    log('API Response:', { status: response.status, tools });
    
    if (response.ok) {
      currentJobTools = tools;
      log('About to render tools:', tools);
      renderTools();
    } else {
      logError('Failed to load tools:', tools.error);
    }
  } catch (error) {
    logError('Error loading tools:', error);
  }
}

function renderTools() {
  const toolsList = document.getElementById('toolsList');
  
  if (!currentJobTools || currentJobTools.length === 0) {
    toolsList.innerHTML = `
      <div class="tools-wrapper">
        <p style="color: #6B7280; text-align: center; padding: 20px 20px 40px 20px;">No tools yet. Add your first tool below!</p>
      </div>
      <div class="tool-input-container">
        <input type="text" id="newToolInput" placeholder="Add a tool and press Enter..." class="tool-input">
      </div>
    `;
  } else {
    toolsList.innerHTML = `
      <div class="list-header-actions">
        <button class="clear-list-btn" onclick="clearJobTools()" title="Clear all tools">
          <span>🗑️</span> Clear List
        </button>
      </div>
      <div class="tools-wrapper">
        <div class="tools-container" id="toolsContainer">
          ${currentJobTools.map(tool => `
            <div class="tool-item" data-tool-id="${tool.id}" draggable="true">
              <div class="tool-content">
                <input type="checkbox" class="tool-checkbox" 
                       ${tool.completed ? 'checked' : ''} 
                       onchange="toggleTool('${tool.id}', this.checked)">
                <span class="tool-description ${tool.completed ? 'completed' : ''}">${escapeHtml(tool.description)}</span>
              </div>
              <button class="tool-delete-btn" onclick="deleteTool('${tool.id}')" title="Delete tool">×</button>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="tool-input-container">
        <input type="text" id="newToolInput" placeholder="Add a tool and press Enter..." class="tool-input">
      </div>
    `;
    
    setupToolDragAndDrop();
  }
  
  setupToolInput();
}

function setupToolInput() {
  const toolInput = document.getElementById('newToolInput');
  if (toolInput) {
    toolInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter' && toolInput.value.trim()) {
        await addTool(toolInput.value.trim());
        toolInput.value = '';
        // Keep focus in the input for continuous tool adding
        toolInput.focus();
      }
    });
    // Auto-focus when the input is created
    toolInput.focus();
  }
}

async function addTool(description) {
  if (!currentJob || !description) return;
  
  try {
    const response = await fetch(`/api/jobs/${currentJob.id}/tools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ description }),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      await loadJobTools(currentJob.id); // Reload tools
      // Auto-scroll to show the newly added tool - optimized for bottom input
      setTimeout(() => {
        const toolsContainer = document.getElementById('toolsContainer');
        if (toolsContainer) {
          const lastTool = toolsContainer.lastElementChild;
          
          // Always scroll to bottom since input is now at bottom
          toolsContainer.scrollTo({
            top: toolsContainer.scrollHeight,
            behavior: 'smooth'
          });
          
          // For mobile devices, ensure the new tool is visible
          if (lastTool) {
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            
            if (isMobile) {
              // Scroll to make the new tool visible but not necessarily at bottom
              // This works better with the input being at the bottom
              lastTool.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest',
                inline: 'nearest'
              });
            }
          }
        }
      }, 300);
    } else {
      logError('Failed to add tool:', result.error);
    }
  } catch (error) {
    logError('Error adding tool:', error);
  }
}

async function toggleTool(toolId, completed) {
  try {
    const response = await fetch(`/api/tools/${toolId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ completed }),
    });
    
    if (response.ok) {
      // Update local state
      const tool = currentJobTools.find(t => t.id === toolId);
      if (tool) {
        tool.completed = completed;
        renderTools();
      }
    } else {
      logError('Failed to update tool');
    }
  } catch (error) {
    logError('Error updating tool:', error);
  }
}

async function deleteTool(toolId) {
  try {
    const response = await fetch(`/api/tools/${toolId}`, {
      method: 'DELETE',
    });
    
    if (response.ok) {
      await loadJobTools(currentJob.id); // Reload tools
    } else {
      logError('Failed to delete tool');
    }
  } catch (error) {
    logError('Error deleting tool:', error);
  }
}

// Drag and drop for tool reordering
function setupToolDragAndDrop() {
  const toolItems = document.querySelectorAll('.tool-item');
  const toolsContainer = document.getElementById('toolsContainer');
  
  toolItems.forEach(item => {
    item.addEventListener('dragstart', handleToolDragStart);
    item.addEventListener('dragend', handleToolDragEnd);
  });
  
  if (toolsContainer) {
    toolsContainer.addEventListener('dragover', handleToolDragOver);
    toolsContainer.addEventListener('drop', handleToolDrop);
  }
}

function handleToolDragStart(e) {
  toolDraggedElement = e.target;
  e.target.classList.add('dragging');
}

function handleToolDragEnd(e) {
  e.target.classList.remove('dragging');
  toolDraggedElement = null;
}

function handleToolDragOver(e) {
  e.preventDefault();
  const container = e.currentTarget;
  const afterElement = getDragAfterElementTool(container, e.clientY);
  const draggable = document.querySelector('.tool-item.dragging');
  
  if (afterElement == null) {
    container.appendChild(draggable);
  } else {
    container.insertBefore(draggable, afterElement);
  }
}

function handleToolDrop(e) {
  e.preventDefault();
  updateToolOrder();
}

function getDragAfterElementTool(container, y) {
  const draggableElements = [...container.querySelectorAll('.tool-item:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function updateToolOrder() {
  const toolItems = document.querySelectorAll('.tool-item');
  const toolIds = Array.from(toolItems).map(item => item.dataset.toolId);
  
  try {
    const response = await fetch(`/api/jobs/${currentJob.id}/tools/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ toolIds }),
    });
    
    if (!response.ok) {
      logError('Failed to update tool order');
      // Reload tools to revert to original order
      await loadJobTools(currentJob.id);
    }
  } catch (error) {
    logError('Error updating tool order:', error);
  }
}

// Materials management functions - Similar to task/tool management
let currentJobMaterials = [];
let materialDraggedElement = null;

async function loadJobMaterials(jobId) {
  log('loadJobMaterials called with jobId:', jobId);
  try {
    const url = `/api/jobs/${jobId}/materials`;
    log('Fetching:', url);
    const response = await fetch(url);
    const materials = await response.json();
    
    log('API Response:', { status: response.status, materials });
    
    if (response.ok) {
      currentJobMaterials = materials;
      log('About to render materials:', materials);
      renderMaterials();
    } else {
      logError('Failed to load materials:', materials.error);
    }
  } catch (error) {
    logError('Error loading materials:', error);
  }
}

function renderMaterials() {
  const materialsList = document.getElementById('materialsList');
  
  if (!currentJobMaterials || currentJobMaterials.length === 0) {
    materialsList.innerHTML = `
      <div class="materials-wrapper">
        <p style="color: #6B7280; text-align: center; padding: 20px 20px 40px 20px;">No materials yet. Add your first material below!</p>
      </div>
      <div class="material-input-container">
        <input type="text" id="newMaterialInput" placeholder="Add a material and press Enter..." class="material-input">
      </div>
    `;
  } else {
    materialsList.innerHTML = `
      <div class="list-header-actions">
        <button class="clear-list-btn" onclick="clearJobMaterials()" title="Clear all materials">
          <span>🗑️</span> Clear List
        </button>
      </div>
      <div class="materials-wrapper">
        <div class="materials-container" id="materialsContainer">
          ${currentJobMaterials.map(material => {
            const supplierId = `supplier-${material.id}`;
            return `
            <div class="material-item" data-material-id="${material.id}" draggable="true">
              <div class="material-content">
                <input type="checkbox" class="material-checkbox" 
                       ${material.completed ? 'checked' : ''} 
                       onchange="toggleMaterial('${material.id}', this.checked)">
                <span class="material-description ${material.completed ? 'completed' : ''}">${escapeHtml(material.description)}</span>
                <div class="material-supplier-group" style="display: inline-flex; margin-left: 8px; gap: 6px; font-size: 11px;">
                  <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="radio" name="${supplierId}" value="" 
                           ${!material.supplier ? 'checked' : ''}
                           onchange="updateMaterialSupplier('${material.id}', '')"
                           style="margin-right: 2px; width: 12px; height: 12px;">
                    <span style="color: #6B7280;">--</span>
                  </label>
                  <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="radio" name="${supplierId}" value="HD" 
                           ${material.supplier === 'HD' ? 'checked' : ''}
                           onchange="updateMaterialSupplier('${material.id}', 'HD')"
                           style="margin-right: 2px; width: 12px; height: 12px;">
                    <span style="color: #EA580C; font-weight: 600;">HD</span>
                  </label>
                  <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="radio" name="${supplierId}" value="Lowes" 
                           ${material.supplier === 'Lowes' ? 'checked' : ''}
                           onchange="updateMaterialSupplier('${material.id}', 'Lowes')"
                           style="margin-right: 2px; width: 12px; height: 12px;">
                    <span style="color: #0369A1; font-weight: 600;">LOW</span>
                  </label>
                  <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="radio" name="${supplierId}" value="Grabber" 
                           ${material.supplier === 'Grabber' ? 'checked' : ''}
                           onchange="updateMaterialSupplier('${material.id}', 'Grabber')"
                           style="margin-right: 2px; width: 12px; height: 12px;">
                    <span style="color: #059669; font-weight: 600;">GRB</span>
                  </label>
                </div>
              </div>
              <button class="material-delete-btn" onclick="deleteMaterial('${material.id}')" title="Delete material">×</button>
            </div>
            `;
          }).join('')}
        </div>
      </div>
      <div class="material-input-container">
        <input type="text" id="newMaterialInput" placeholder="Add a material and press Enter..." class="material-input">
      </div>
    `;
    
    setupMaterialDragAndDrop();
  }
  
  setupMaterialInput();
}

function setupMaterialInput() {
  const materialInput = document.getElementById('newMaterialInput');
  if (materialInput) {
    materialInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter' && materialInput.value.trim()) {
        await addMaterial(materialInput.value.trim());
        materialInput.value = '';
        // Keep focus in the input for continuous material adding
        materialInput.focus();
      }
    });
    // Auto-focus when the input is created
    materialInput.focus();
  }
}

async function addMaterial(description) {
  if (!currentJob || !description) return;
  
  try {
    const response = await fetch(`/api/jobs/${currentJob.id}/materials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ description }),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      await loadJobMaterials(currentJob.id); // Reload materials
      // Auto-scroll to show the newly added material
      setTimeout(() => {
        const materialsContainer = document.getElementById('materialsContainer');
        if (materialsContainer) {
          materialsContainer.scrollTo({
            top: materialsContainer.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 300);
    } else {
      logError('Failed to add material:', result.error);
    }
  } catch (error) {
    logError('Error adding material:', error);
  }
}

async function toggleMaterial(materialId, completed) {
  try {
    const response = await fetch(`/api/materials/${materialId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ completed }),
    });
    
    if (response.ok) {
      // Update local state
      const material = currentJobMaterials.find(m => m.id === materialId);
      if (material) {
        material.completed = completed;
        renderMaterials();
      }
    } else {
      logError('Failed to update material');
    }
  } catch (error) {
    logError('Error updating material:', error);
  }
}

async function updateMaterialSupplier(materialId, supplier) {
  try {
    const response = await fetch(`/api/materials/${materialId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ supplier }),
    });
    
    if (response.ok) {
      // Update local state
      const material = currentJobMaterials.find(m => m.id === materialId);
      if (material) {
        material.supplier = supplier;
      }
    } else {
      logError('Failed to update material supplier');
    }
  } catch (error) {
    logError('Error updating material supplier:', error);
  }
}

async function deleteMaterial(materialId) {
  try {
    const response = await fetch(`/api/materials/${materialId}`, {
      method: 'DELETE',
    });
    
    if (response.ok) {
      await loadJobMaterials(currentJob.id); // Reload materials
    } else {
      logError('Failed to delete material');
    }
  } catch (error) {
    logError('Error deleting material:', error);
  }
}

// Drag and drop for material reordering
function setupMaterialDragAndDrop() {
  const materialItems = document.querySelectorAll('.material-item');
  const materialsContainer = document.getElementById('materialsContainer');
  
  materialItems.forEach(item => {
    item.addEventListener('dragstart', handleMaterialDragStart);
    item.addEventListener('dragend', handleMaterialDragEnd);
  });
  
  if (materialsContainer) {
    materialsContainer.addEventListener('dragover', handleMaterialDragOver);
    materialsContainer.addEventListener('drop', handleMaterialDrop);
  }
}

function handleMaterialDragStart(e) {
  materialDraggedElement = e.target;
  e.target.classList.add('dragging');
}

function handleMaterialDragEnd(e) {
  e.target.classList.remove('dragging');
  materialDraggedElement = null;
}

function handleMaterialDragOver(e) {
  e.preventDefault();
  const container = e.currentTarget;
  const afterElement = getDragAfterElementMaterial(container, e.clientY);
  const draggable = document.querySelector('.material-item.dragging');
  
  if (afterElement == null) {
    container.appendChild(draggable);
  } else {
    container.insertBefore(draggable, afterElement);
  }
}

function handleMaterialDrop(e) {
  e.preventDefault();
  updateMaterialOrder();
}

function getDragAfterElementMaterial(container, y) {
  const draggableElements = [...container.querySelectorAll('.material-item:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function updateMaterialOrder() {
  const materialItems = document.querySelectorAll('.material-item');
  const materialIds = Array.from(materialItems).map(item => item.dataset.materialId);
  
  try {
    const response = await fetch(`/api/jobs/${currentJob.id}/materials/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ materialIds }),
    });
    
    if (!response.ok) {
      logError('Failed to update material order');
      // Reload materials to revert to original order
      await loadJobMaterials(currentJob.id);
    }
  } catch (error) {
    logError('Error updating material order:', error);
  }
}

async function loadJobFiles(jobId) {
  log('Loading files for job:', jobId);
  
  if (!jobId) {
    log('No job ID provided to loadJobFiles');
    clearPicsDisplay();
    clearPlansDisplay();
    return;
  }
  
  try {
    // Load pics
    const picsResponse = await fetch(`/api/jobs/${jobId}/photos?type=pics`);
    if (picsResponse.ok) {
      const picsData = await picsResponse.json();
      log(`Loaded ${picsData.length} pics for job ${jobId}`);
      displayServerPhotos(picsData, 'pics');
    } else {
      logError('Failed to load pics:', picsResponse.status);
      clearPicsDisplay();
    }
    
    // Load plans
    const plansResponse = await fetch(`/api/jobs/${jobId}/photos?type=plans`);
    if (plansResponse.ok) {
      const plansData = await plansResponse.json();
      log(`Loaded ${plansData.length} plans for job ${jobId}`);
      displayServerPhotos(plansData, 'plans');
    } else {
      logError('Failed to load plans:', plansResponse.status);
      clearPlansDisplay();
    }
  } catch (error) {
    logError('Error loading job files:', error);
    clearPicsDisplay();
    clearPlansDisplay();
  }
}

async function createSharpThumbnail(file, container) {
  const TARGET = 120; // CSS size for square thumbs
  const DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1)); // cap to keep memory sane
  const PIXELS = TARGET * DPR; // actual canvas pixel size
  
  try {
    // Use createImageBitmap for faster decode than <img>
    const bmp = await createImageBitmap(file);
    const blob = await makeThumb(bmp, PIXELS);
    
    // Create image element for display
    const img = document.createElement('img');
    img.style.width = TARGET + 'px';
    img.style.height = TARGET + 'px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '6px';
    img.src = URL.createObjectURL(blob);
    
    // Clean up blob URL when image loads
    img.onload = () => URL.revokeObjectURL(img.src);
    
    container.appendChild(img);
    
    // Click to enlarge
    container.addEventListener('click', () => {
      enlargeImage(file, img.src);
    });
    
    log(`Sharp thumbnail created for: ${file.name} (DPR: ${DPR}, Canvas: ${PIXELS}x${PIXELS}, CSS: ${TARGET}x${TARGET})`);
    return Promise.resolve(); // Explicitly return resolved promise
  } catch (err) {
    logError('Thumbnail creation error:', err);
    // Fallback to simple image display
    const img = document.createElement('img');
    img.style.width = TARGET + 'px';
    img.style.height = TARGET + 'px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '6px';
    img.src = URL.createObjectURL(file);
    container.appendChild(img);
    
    container.addEventListener('click', () => {
      enlargeImage(file, img.src);
    });
    
    return Promise.reject(err); // Return rejected promise for error handling
  }
}

async function makeThumb(bmp, pixels) {
  // center-crop to square, then downscale to crisp pixels size
  const srcSize = Math.min(bmp.width, bmp.height);
  const sx = (bmp.width  - srcSize) / 2;
  const sy = (bmp.height - srcSize) / 2;

  // draw to a high-DPR canvas to avoid blur on Retina/HiDPI
  const canvas = document.createElement('canvas');
  canvas.width  = pixels;
  canvas.height = pixels;
  const ctx = canvas.getContext('2d');

  // high quality resample
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, sx, sy, srcSize, srcSize, 0, 0, pixels, pixels);

  // export as WebP for small + sharp. Use JPEG if you prefer: 'image/jpeg', 0.85
  return await new Promise(res => canvas.toBlob(res, 'image/webp', 0.9));
}


function createSimpleImagePreview(file, container) {
  // Simple approach: just show file info and let user click to download
  const preview = document.createElement('div');
  preview.style.cssText = `
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #F3F4F6;
    color: #374151;
    text-align: center;
    font-size: 11px;
    cursor: pointer;
    border: 2px dashed #D1D5DB;
  `;
  
  const fileExt = file.name.split('.').pop().toUpperCase();
  const fileSize = (file.size / 1024 / 1024).toFixed(1);
  
  preview.innerHTML = `
    <div style="font-size: 32px; margin-bottom: 8px;">🖼️</div>
    <div style="font-weight: bold; margin-bottom: 4px;">${fileExt}</div>
    <div style="font-size: 9px; opacity: 0.8;">${fileSize} MB</div>
    <div style="font-size: 8px; opacity: 0.6; margin-top: 4px;">Click to view</div>
  `;
  
  preview.addEventListener('click', () => {
    // Try to open the file in a new tab - browser will handle what it can
    const url = URL.createObjectURL(file);
    const newWindow = window.open(url, '_blank');
    // Clean up URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  
  container.appendChild(preview);
}

// OLD displaySelectedPics function removed - now using displayServerPics instead

function enlargeImage(file, currentSrc) {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    cursor: zoom-out;
  `;
  
  // Create image container
  const container = document.createElement('div');
  container.style.cssText = `
    text-align: center;
    max-width: 95%;
    max-height: 95%;
    cursor: default;
  `;
  
  // Create close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  
  // Detect mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    // Bottom right for mobile
    closeBtn.style.cssText = `
      position: fixed !important; 
      bottom: 30px !important; 
      right: 30px !important;
      transform: none !important;
      background: rgba(239, 68, 68, 0.9) !important; 
      color: white !important;
      border: none !important; 
      font-size: 50px !important; 
      cursor: pointer !important;
      width: 70px !important; 
      height: 70px !important; 
      border-radius: 35px !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
      transition: all 0.2s ease !important;
      z-index: 10001 !important;
    `;
  } else {
    // Vertically centered for desktop
    closeBtn.style.cssText = `
      position: fixed !important; 
      top: 50% !important; 
      right: 15px !important;
      transform: translateY(-50%) !important;
      background: rgba(239, 68, 68, 0.9) !important; 
      color: white !important;
      border: none !important; 
      font-size: 60px !important; 
      cursor: pointer !important;
      width: 80px !important; 
      height: 80px !important; 
      border-radius: 40px !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
      transition: all 0.2s ease !important;
      z-index: 10001 !important;
    `;
  }
  
  // Add hover effect
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.setProperty('background', 'rgba(220, 38, 38, 1)', 'important');
    if (isMobile) {
      closeBtn.style.setProperty('transform', 'scale(1.1)', 'important');
    } else {
      closeBtn.style.setProperty('transform', 'translateY(-50%) scale(1.1)', 'important');
    }
  });
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.setProperty('background', 'rgba(239, 68, 68, 0.9)', 'important');
    if (isMobile) {
      closeBtn.style.setProperty('transform', 'scale(1)', 'important');
    } else {
      closeBtn.style.setProperty('transform', 'translateY(-50%) scale(1)', 'important');
    }
  });
  
  // Create resizable image container
  const imgContainer = document.createElement('div');
  imgContainer.style.cssText = `
    position: relative;
    width: 60vw;
    height: 60vh;
    min-width: 300px;
    min-height: 200px;
    max-width: 95vw;
    max-height: 90vh;
    border: 2px solid rgba(255,255,255,0.3);
    border-radius: 8px;
    cursor: move;
    resize: both;
    overflow: hidden;
  `;
  
  // Create image element
  const img = document.createElement('img');
  img.style.cssText = `
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: 6px;
    opacity: 0;
    transition: opacity 0.3s;
  `;
  
  // Create filename label
  const filename = document.createElement('div');
  filename.textContent = file.name;
  filename.style.cssText = `
    color: white;
    margin-top: 15px;
    font-size: 16px;
    font-weight: 500;
    text-shadow: 0 1px 3px rgba(0,0,0,0.5);
  `;
  
  // Create file info
  const fileInfo = document.createElement('div');
  fileInfo.textContent = `${file.type} • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  fileInfo.style.cssText = `
    color: rgba(255, 255, 255, 0.8);
    margin-top: 8px;
    font-size: 12px;
    text-shadow: 0 1px 3px rgba(0,0,0,0.5);
  `;
  
  // Load high-quality image
  const reader = new FileReader();
  reader.onload = function(e) {
    img.src = e.target.result;
    img.onload = () => {
      img.style.opacity = '1';
    };
  };
  reader.onerror = function() {
    img.src = currentSrc;
    img.onload = () => {
      img.style.opacity = '1';
    };
  };
  
  // Assemble modal
  imgContainer.appendChild(img);
  container.appendChild(imgContainer);
  container.appendChild(filename);
  container.appendChild(fileInfo);
  modal.appendChild(container);
  modal.appendChild(closeBtn);
  document.body.appendChild(modal);
  
  // Add drag functionality for moving the image around
  let isDragging = false;
  let dragStartX, dragStartY, initialX, initialY;
  
  imgContainer.addEventListener('mousedown', (e) => {
    // Only start dragging if not on resize handle
    if (e.target === imgContainer || e.target === img) {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const rect = imgContainer.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      imgContainer.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });
  
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const deltaX = e.clientX - dragStartX;
      const deltaY = e.clientY - dragStartY;
      imgContainer.style.position = 'absolute';
      imgContainer.style.left = (initialX + deltaX) + 'px';
      imgContainer.style.top = (initialY + deltaY) + 'px';
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      imgContainer.style.cursor = 'move';
    }
  });
  
  // Close modal handlers
  const closeModal = () => {
    // Clean up event listeners
    document.removeEventListener('keydown', handleKeydown);
    document.body.removeChild(modal);
  };
  
  closeBtn.onclick = closeModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };
  
  // ESC key to close
  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  };
  document.addEventListener('keydown', handleKeydown);
  
  // Start loading the image
  reader.readAsDataURL(file);
}

function createHighQualityThumbnail(file, imgElement, containerElement) {
  const reader = new FileReader();
  
  reader.onload = function(e) {
    const tempImg = new Image();
    tempImg.onload = function() {
      // Create a canvas for high-quality thumbnail
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size (thumbnail size)
      const size = 200; // High resolution thumbnail
      canvas.width = size;
      canvas.height = size;
      
      // Enable high-quality rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Calculate aspect ratio and draw
      const aspectRatio = tempImg.width / tempImg.height;
      let drawWidth, drawHeight, drawX, drawY;
      
      if (aspectRatio > 1) {
        // Landscape
        drawHeight = size;
        drawWidth = size * aspectRatio;
        drawX = -(drawWidth - size) / 2;
        drawY = 0;
      } else {
        // Portrait
        drawWidth = size;
        drawHeight = size / aspectRatio;
        drawX = 0;
        drawY = -(drawHeight - size) / 2;
      }
      
      ctx.drawImage(tempImg, drawX, drawY, drawWidth, drawHeight);
      
      // Convert canvas to high-quality data URL
      const highQualityDataUrl = canvas.toDataURL('image/png', 1.0);
      
      // Set the high-quality thumbnail
      imgElement.src = highQualityDataUrl;
      imgElement.alt = file.name;
      
      containerElement.appendChild(imgElement);
    };
    
    tempImg.src = e.target.result;
  };
  
  reader.onerror = function() {
    // Fallback to regular blob URL if FileReader fails
    imgElement.src = URL.createObjectURL(file);
    imgElement.alt = file.name;
    containerElement.appendChild(imgElement);
  };
  
  reader.readAsDataURL(file);
}

function createSharpThumbnail(file, container) {
  const reader = new FileReader();
  
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Simple approach: exact 120px canvas
      canvas.width = 120;
      canvas.height = 120;
      canvas.style.width = '120px';
      canvas.style.height = '120px';
      
      // High quality settings
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Center crop calculation
      const size = Math.min(img.width, img.height);
      const x = (img.width - size) / 2;
      const y = (img.height - size) / 2;
      
      // Draw with high quality
      ctx.drawImage(img, x, y, size, size, 0, 0, 120, 120);
      
      container.appendChild(canvas);
      
      // Click to enlarge
      container.addEventListener('click', () => {
        enlargeImage(file, e.target.result);
      });
      
      log(`Sharp thumbnail created for: ${file.name}`);
    };
    img.src = e.target.result;
  };
  
  reader.readAsDataURL(file);
}

function createPixelPerfectThumbnail_OLD(file, container) {
  const reader = new FileReader();
  
  reader.onload = function(e) {
    const tempImg = new Image();
    tempImg.onload = function() {
      // Get device pixel ratio for crisp rendering
      const dpr = window.devicePixelRatio || 1;
      const cssSize = 120; // CSS size in pixels
      const canvasSize = Math.floor(cssSize * dpr); // Canvas size for device pixels
      
      // Create canvas at device pixel resolution
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size to device pixels
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      
      // Set CSS size (this prevents browser scaling blur)
      canvas.style.width = cssSize + 'px';
      canvas.style.height = cssSize + 'px';
      canvas.style.objectFit = 'cover';
      
      // Enable high-quality smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Multi-step downscale for huge images (reduces blur)
      let sourceWidth = tempImg.width;
      let sourceHeight = tempImg.height;
      let tempCanvas = null;
      let tempCtx = null;
      
      // If image is more than 4x larger, do multi-step resize
      while (sourceWidth > canvasSize * 4 || sourceHeight > canvasSize * 4) {
        tempCanvas = document.createElement('canvas');
        tempCtx = tempCanvas.getContext('2d');
        
        // Halve the size
        tempCanvas.width = Math.floor(sourceWidth / 2);
        tempCanvas.height = Math.floor(sourceHeight / 2);
        
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.imageSmoothingQuality = 'high';
        
        // Draw at half size
        if (tempImg.width === sourceWidth) {
          // First iteration - draw from original image
          tempCtx.drawImage(tempImg, 0, 0, tempCanvas.width, tempCanvas.height);
        } else {
          // Subsequent iterations - draw from previous canvas
          tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
        }
        
        sourceWidth = tempCanvas.width;
        sourceHeight = tempCanvas.height;
        
        // Use this as source for next iteration
        canvas.width = tempCanvas.width;
        canvas.height = tempCanvas.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempCanvas, 0, 0);
      }
      
      // Final resize to exact thumbnail size
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Calculate crop coordinates for center crop
      const sourceAspect = sourceWidth / sourceHeight;
      let drawWidth, drawHeight, drawX, drawY;
      
      if (sourceAspect > 1) {
        // Landscape - fit height, crop width
        drawHeight = canvasSize;
        drawWidth = canvasSize * sourceAspect;
        drawX = -(drawWidth - canvasSize) / 2;
        drawY = 0;
      } else {
        // Portrait - fit width, crop height  
        drawWidth = canvasSize;
        drawHeight = canvasSize / sourceAspect;
        drawX = 0;
        drawY = -(drawHeight - canvasSize) / 2;
      }
      
      // Draw final thumbnail
      if (tempCanvas) {
        ctx.drawImage(canvas, drawX, drawY, drawWidth, drawHeight);
      } else {
        ctx.drawImage(tempImg, drawX, drawY, drawWidth, drawHeight);
      }
      
      // Add to container
      container.appendChild(canvas);
      
      // Click to enlarge
      container.addEventListener('click', () => {
        enlargeImage(file, canvas.toDataURL('image/png', 1.0));
      });
      
      log(`Created pixel-perfect thumbnail: ${file.name} (DPR: ${dpr}, Canvas: ${canvasSize}x${canvasSize}, CSS: ${cssSize}x${cssSize})`);
    };
    
    tempImg.src = e.target.result;
  };
  
  reader.onerror = function() {
    logError('Failed to create thumbnail for:', file.name);
    // Fallback to simple img element
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
    container.appendChild(img);
  };
  
  reader.readAsDataURL(file);
}

function downloadFile(file) {
  // Create download link for HEIF/HEIC files since browsers can't preview them
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the URL after a short delay
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
  
  log(`Downloaded HEIF/HEIC file: ${file.name}`);
}

// Method 1: Native Size (No Scale) - Show image at actual pixels
function renderMethodNative1(file, container) {
  const img = document.createElement('img');
  img.src = URL.createObjectURL(file);
  img.onload = () => {
    log(`Image natural size: ${img.naturalWidth}x${img.naturalHeight}`);
    // Show at actual size, cropped to container
    img.style.cssText = `
      width: ${img.naturalWidth}px;
      height: ${img.naturalHeight}px;
      max-width: none;
      max-height: none;
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      image-rendering: pixelated;
    `;
  };
  container.appendChild(img);
}

// Method 2: CSS Reset + Device Pixel Ratio
function renderMethodNative2(file, container) {
  const img = document.createElement('img');
  img.src = URL.createObjectURL(file);
  const dpr = window.devicePixelRatio || 1;
  const size = Math.floor(120 * dpr);
  img.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    transform: scale(${1/dpr});
    transform-origin: top left;
    object-fit: cover;
    image-rendering: pixelated;
  `;
  container.appendChild(img);
}

// Method 3: Canvas High-Quality
function renderMethod3(file, container) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const tempImg = new Image();
    tempImg.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 120;
      canvas.height = 120;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      const aspectRatio = tempImg.width / tempImg.height;
      let drawWidth, drawHeight, drawX, drawY;
      if (aspectRatio > 1) {
        drawHeight = 120;
        drawWidth = 120 * aspectRatio;
        drawX = -(drawWidth - 120) / 2;
        drawY = 0;
      } else {
        drawWidth = 120;
        drawHeight = 120 / aspectRatio;
        drawX = 0;
        drawY = -(drawHeight - 120) / 2;
      }
      
      ctx.drawImage(tempImg, drawX, drawY, drawWidth, drawHeight);
      canvas.style.cssText = 'width: 100%; height: 100%;';
      container.appendChild(canvas);
    };
    tempImg.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Method 4: Canvas Nearest-Neighbor
function renderMethod4(file, container) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const tempImg = new Image();
    tempImg.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 120;
      canvas.height = 120;
      ctx.imageSmoothingEnabled = false;
      
      const aspectRatio = tempImg.width / tempImg.height;
      let drawWidth, drawHeight, drawX, drawY;
      if (aspectRatio > 1) {
        drawHeight = 120;
        drawWidth = 120 * aspectRatio;
        drawX = -(drawWidth - 120) / 2;
        drawY = 0;
      } else {
        drawWidth = 120;
        drawHeight = 120 / aspectRatio;
        drawX = 0;
        drawY = -(drawHeight - 120) / 2;
      }
      
      ctx.drawImage(tempImg, drawX, drawY, drawWidth, drawHeight);
      canvas.style.cssText = 'width: 100%; height: 100%;';
      container.appendChild(canvas);
    };
    tempImg.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Method 5: Direct File + Auto
function renderMethod5(file, container) {
  const img = document.createElement('img');
  img.src = URL.createObjectURL(file);
  img.style.cssText = `
    width: 100%; height: 100%; object-fit: cover;
    image-rendering: auto;
  `;
  container.appendChild(img);
}

// Method 6: Base64 + Optimize-Contrast
function renderMethod6(file, container) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = document.createElement('img');
    img.src = e.target.result;
    img.style.cssText = `
      width: 100%; height: 100%; object-fit: cover;
      image-rendering: -webkit-optimize-contrast;
    `;
    container.appendChild(img);
  };
  reader.readAsDataURL(file);
}

// Method 7: Canvas Sharp (No Smoothing)
function renderMethod7(file, container) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const tempImg = new Image();
    tempImg.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 240; // Higher resolution
      canvas.height = 240;
      ctx.imageSmoothingEnabled = false;
      
      const aspectRatio = tempImg.width / tempImg.height;
      let drawWidth, drawHeight, drawX, drawY;
      if (aspectRatio > 1) {
        drawHeight = 240;
        drawWidth = 240 * aspectRatio;
        drawX = -(drawWidth - 240) / 2;
        drawY = 0;
      } else {
        drawWidth = 240;
        drawHeight = 240 / aspectRatio;
        drawX = 0;
        drawY = -(drawHeight - 240) / 2;
      }
      
      ctx.drawImage(tempImg, drawX, drawY, drawWidth, drawHeight);
      canvas.style.cssText = 'width: 120px; height: 120px;';
      container.appendChild(canvas);
    };
    tempImg.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Method 8: No Smoothing + Transform
function renderMethod8(file, container) {
  const img = document.createElement('img');
  img.src = URL.createObjectURL(file);
  img.style.cssText = `
    width: 100%; height: 100%; object-fit: cover;
    image-rendering: crisp-edges;
    transform: translateZ(0);
    backface-visibility: hidden;
    filter: none;
  `;
  container.appendChild(img);
}

// Method 9: SVG Wrapper
function renderMethod9(file, container) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '120');
    svg.setAttribute('height', '120');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.style.cssText = 'width: 100%; height: 100%;';
    
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('href', e.target.result);
    image.setAttribute('x', '0');
    image.setAttribute('y', '0');
    image.setAttribute('width', '120');
    image.setAttribute('height', '120');
    image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    image.style.cssText = 'image-rendering: crisp-edges;';
    
    svg.appendChild(image);
    container.appendChild(svg);
  };
  reader.readAsDataURL(file);
}

// Method 10: ImageBitmap (Modern browsers)
function renderMethod10(file, container) {
  if ('createImageBitmap' in window) {
    createImageBitmap(file).then(bitmap => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 120;
      canvas.height = 120;
      
      const aspectRatio = bitmap.width / bitmap.height;
      let drawWidth, drawHeight, drawX, drawY;
      if (aspectRatio > 1) {
        drawHeight = 120;
        drawWidth = 120 * aspectRatio;
        drawX = -(drawWidth - 120) / 2;
        drawY = 0;
      } else {
        drawWidth = 120;
        drawHeight = 120 / aspectRatio;
        drawX = 0;
        drawY = -(drawHeight - 120) / 2;
      }
      
      ctx.drawImage(bitmap, drawX, drawY, drawWidth, drawHeight);
      canvas.style.cssText = 'width: 100%; height: 100%;';
      container.appendChild(canvas);
    }).catch(() => {
      // Fallback to method 1
      renderMethod1(file, container);
    });
  } else {
    // Fallback to method 1
    renderMethod1(file, container);
  }
}

// Method 3: Background Image (No IMG tag scaling)
function renderMethodNative3(file, container) {
  const url = URL.createObjectURL(file);
  container.style.cssText += `
    background-image: url('${url}');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    image-rendering: pixelated;
  `;
}

// Method 4: Viewport Units
function renderMethodNative4(file, container) {
  const img = document.createElement('img');
  img.src = URL.createObjectURL(file);
  img.style.cssText = `
    width: 120px;
    height: 120px;
    object-fit: cover;
    image-rendering: crisp-edges;
    min-width: 120px;
    min-height: 120px;
  `;
  container.appendChild(img);
}

// Method 5: CSS Zoom (IE/Edge approach)
function renderMethodNative5(file, container) {
  const img = document.createElement('img');
  img.src = URL.createObjectURL(file);
  img.style.cssText = `
    zoom: 1;
    width: 120px;
    height: 120px;
    object-fit: cover;
    -ms-interpolation-mode: nearest-neighbor;
  `;
  container.appendChild(img);
}

function clearPicsDisplay() {
  const picsList = document.getElementById('picsList');
  if (picsList) {
    picsList.innerHTML = '';
  }
  
  // Clean up object URLs and reset tracking array
  currentJobPics.forEach(pic => {
    URL.revokeObjectURL(pic.url);
  });
  currentJobPics = [];
}

function clearPlansDisplay() {
  const plansList = document.getElementById('plansList');
  if (plansList) {
    plansList.innerHTML = '';
  }
}

function displayServerPhotos(photos, type) {
  log(`displayServerPhotos called with ${photos.length} ${type} photos`);
  
  if (type === 'pics') {
    displayServerPics(photos, type);
  } else if (type === 'plans') {
    displayServerPlans(photos, type);
  }
}

function displayServerPics(photos, type) {
  const picsList = document.getElementById('picsList');
  if (!picsList) {
    logError('picsList element not found');
    return;
  }
  
  // Clear existing content
  picsList.innerHTML = '';
  currentJobPics = [];
  
  photos.forEach(photo => {
    const fileElement = document.createElement('div');
    fileElement.className = 'pic-item';
    fileElement.dataset.photoId = photo.id;
    fileElement.style.cssText = `
      width: 120px; height: 120px;
      background: #F9FAFB; border: 1px solid #E5E7EB;
      border-radius: 8px; overflow: hidden;
      position: relative; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    `;
    
    // Add image
    const img = document.createElement('img');
    img.src = `/api/photos/${photo.id}`;
    img.style.cssText = `
      width: 100%; height: 100%;
      object-fit: cover;
    `;
    
    img.onerror = function() {
      // If image fails to load, show file info instead
      this.style.display = 'none';
      const fileInfo = document.createElement('div');
      fileInfo.style.cssText = 'text-align: center; color: #6B7280; font-size: 11px;';
      fileInfo.innerHTML = `
        <div style="font-size: 32px; margin-bottom: 8px;">🖼️</div>
        <div>${photo.original_name.split('.').pop().toUpperCase()}</div>
        <div>${(photo.file_size / 1024 / 1024).toFixed(1)} MB</div>
      `;
      fileElement.appendChild(fileInfo);
    };
    
    // Add delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '×';
    deleteBtn.style.cssText = `
      position: absolute; top: 5px; right: 5px;
      width: 20px; height: 20px; border-radius: 50%;
      background: rgba(239, 68, 68, 0.9); color: white;
      border: none; cursor: pointer; font-size: 14px;
      display: flex; align-items: center; justify-content: center;
    `;
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteServerPhoto(photo.id, type);
    };
    
    fileElement.appendChild(img);
    fileElement.appendChild(deleteBtn);
    
    // Click to enlarge
    fileElement.onclick = () => {
      enlargeServerImage(photo);
    };
    
    picsList.appendChild(fileElement);
    
    // Track for management
    currentJobPics.push({
      id: photo.id,
      serverPhoto: photo
    });
  });
}

function displayServerPlans(photos, type) {
  const plansList = document.getElementById('plansList');
  if (!plansList) {
    logError('plansList element not found');
    return;
  }
  
  // Clear existing content
  plansList.innerHTML = '';
  
  photos.forEach(photo => {
    const fileElement = document.createElement('div');
    fileElement.className = 'plan-item';
    fileElement.dataset.photoId = photo.id;
    fileElement.style.cssText = `
      width: 120px; height: 120px;
      background: #F9FAFB; border: 1px solid #E5E7EB;
      border-radius: 8px; overflow: hidden;
      position: relative; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    `;
    
    // Show file icon and info for plans (usually PDFs or documents)
    const fileInfo = document.createElement('div');
    fileInfo.style.cssText = 'text-align: center; color: #6B7280; font-size: 11px; padding: 10px;';
    const ext = photo.original_name.split('.').pop().toUpperCase();
    const icon = ext === 'PDF' ? '📄' : ext.match(/^(JPG|JPEG|PNG|GIF|BMP|WEBP)$/i) ? '🖼️' : '📋';
    
    fileInfo.innerHTML = `
      <div style="font-size: 32px; margin-bottom: 8px;">${icon}</div>
      <div style="font-weight: bold; margin-bottom: 4px;">${ext}</div>
      <div style="font-size: 9px; opacity: 0.8;">${(photo.file_size / 1024 / 1024).toFixed(1)} MB</div>
      <div style="font-size: 8px; opacity: 0.6; margin-top: 4px; word-break: break-all;">${photo.original_name}</div>
    `;
    
    // Add delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '×';
    deleteBtn.style.cssText = `
      position: absolute; top: 5px; right: 5px;
      width: 20px; height: 20px; border-radius: 50%;
      background: rgba(239, 68, 68, 0.9); color: white;
      border: none; cursor: pointer; font-size: 14px;
      display: flex; align-items: center; justify-content: center;
    `;
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteServerPhoto(photo.id, type);
    };
    
    fileElement.appendChild(fileInfo);
    fileElement.appendChild(deleteBtn);
    
    // Click to open/download
    fileElement.onclick = () => {
      window.open(`/api/photos/${photo.id}`, '_blank');
    };
    
    plansList.appendChild(fileElement);
  });
}

async function deleteServerPhoto(photoId, type) {
  try {
    const response = await fetch(`/api/photos/${photoId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      log('Photo deleted successfully');
      // Reload the photos for current job
      if (currentJob && currentJob.id) {
        await loadJobFiles(currentJob.id);
      }
    } else {
      const error = await response.json();
      alert(`Failed to delete photo: ${error.error}`);
    }
  } catch (error) {
    logError('Error deleting photo:', error);
    alert('Error deleting photo');
  }
}

function enlargeServerImage(photo) {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.9); z-index: 10000;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
  `;
  
  const img = document.createElement('img');
  img.src = `/api/photos/${photo.id}`;
  img.style.cssText = `
    max-width: 90vw; max-height: 90vh;
    object-fit: contain;
  `;
  
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  
  // Detect mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    // Bottom right for mobile
    closeBtn.style.cssText = `
      position: fixed !important; 
      bottom: 30px !important; 
      right: 30px !important;
      transform: none !important;
      background: rgba(239, 68, 68, 0.9) !important; 
      color: white !important;
      border: none !important; 
      font-size: 50px !important; 
      cursor: pointer !important;
      width: 70px !important; 
      height: 70px !important; 
      border-radius: 35px !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
      transition: all 0.2s ease !important;
      z-index: 10001 !important;
    `;
  } else {
    // Vertically centered for desktop
    closeBtn.style.cssText = `
      position: fixed !important; 
      top: 50% !important; 
      right: 15px !important;
      transform: translateY(-50%) !important;
      background: rgba(239, 68, 68, 0.9) !important; 
      color: white !important;
      border: none !important; 
      font-size: 60px !important; 
      cursor: pointer !important;
      width: 80px !important; 
      height: 80px !important; 
      border-radius: 40px !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
      transition: all 0.2s ease !important;
      z-index: 10001 !important;
    `;
  }
  
  // Add hover effect
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.setProperty('background', 'rgba(220, 38, 38, 1)', 'important');
    if (isMobile) {
      closeBtn.style.setProperty('transform', 'scale(1.1)', 'important');
    } else {
      closeBtn.style.setProperty('transform', 'translateY(-50%) scale(1.1)', 'important');
    }
  });
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.setProperty('background', 'rgba(239, 68, 68, 0.9)', 'important');
    if (isMobile) {
      closeBtn.style.setProperty('transform', 'scale(1)', 'important');
    } else {
      closeBtn.style.setProperty('transform', 'translateY(-50%) scale(1)', 'important');
    }
  });
  
  modal.appendChild(img);
  modal.appendChild(closeBtn);
  
  // Close on click
  modal.onclick = () => document.body.removeChild(modal);
  closeBtn.onclick = () => document.body.removeChild(modal);
  
  document.body.appendChild(modal);
}

// Extra Work Notes Management
async function loadExtraCosts(jobId) {
  try {
    const response = await fetch(`/api/jobs/${jobId}/extra-costs`);
    const notes = await response.json();
    
    if (response.ok) {
      currentJobExtraCosts = notes;
      renderExtraNotes();
    } else {
      logError('Failed to load extra notes:', notes.error);
    }
  } catch (error) {
    logError('Error loading extra notes:', error);
  }
}

function renderExtraNotes() {
  const notesContainer = document.getElementById('extraCostsList');
  
  if (!currentJobExtraCosts || currentJobExtraCosts.length === 0) {
    notesContainer.innerHTML = `
      <div class="extra-notes-input-container">
        <textarea id="newExtraNote" placeholder="Enter extra work notes and press Enter to add..." class="extra-note-input" rows="3"></textarea>
        <div class="extra-notes-actions">
          <button onclick="addExtraNote()" class="add-note-btn">Add Note</button>
          <button onclick="clearAllExtraNotes()" class="clear-all-btn">Clear All</button>
        </div>
      </div>
      <p style="color: #6B7280; text-align: center; padding: 20px;">No extra work notes yet. Add notes above to track additional work not in the original proposal.</p>
    `;
  } else {
    notesContainer.innerHTML = `
      <div class="extra-notes-input-container">
        <textarea id="newExtraNote" placeholder="Enter extra work notes and press Enter to add..." class="extra-note-input" rows="3"></textarea>
        <div class="extra-notes-actions">
          <button onclick="addExtraNote()" class="add-note-btn">Add Note</button>
          <button onclick="clearAllExtraNotes()" class="clear-all-btn">Clear All</button>
        </div>
      </div>
      <div class="extra-notes-container">
        ${currentJobExtraCosts.map((note, index) => `
          <div class="extra-note-item">
            <div class="note-number">${index + 1}.</div>
            <div class="note-content">${escapeHtml(note.description).replace(/\n/g, '<br>')}</div>
            <button class="note-delete-btn" onclick="deleteExtraNote('${note.id}')" title="Delete note">×</button>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  setupExtraNotesInput();
}

function setupExtraNotesInput() {
  const noteInput = document.getElementById('newExtraNote');
  
  if (noteInput) {
    noteInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addExtraNote();
      }
    });
    // Auto-focus on the textarea
    noteInput.focus();
  }
}

async function addExtraNote() {
  const noteInput = document.getElementById('newExtraNote');
  if (!noteInput) return;
  
  const noteText = noteInput.value.trim();
  if (!noteText || !currentJob) return;
  
  try {
    const response = await fetch(`/api/jobs/${currentJob.id}/extra-costs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ description: noteText, amount: 0 }),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      await loadExtraCosts(currentJob.id); // Reload notes
      // Clear input and focus back
      noteInput.value = '';
      noteInput.focus();
    } else {
      logError('Failed to add extra note:', result.error);
    }
  } catch (error) {
    logError('Error adding extra note:', error);
  }
}

async function deleteExtraNote(noteId) {
  try {
    const response = await fetch(`/api/extra-costs/${noteId}`, {
      method: 'DELETE',
    });
    
    if (response.ok) {
      await loadExtraCosts(currentJob.id); // Reload notes
    } else {
      logError('Failed to delete extra note');
    }
  } catch (error) {
    logError('Error deleting extra note:', error);
  }
}

async function clearAllExtraNotes() {
  if (!currentJob || currentJobExtraCosts.length === 0) return;
  
  if (confirm('Clear all extra work notes? This cannot be undone.')) {
    try {
      // Delete all notes for this job
      const deletePromises = currentJobExtraCosts.map(note => 
        fetch(`/api/extra-costs/${note.id}`, { method: 'DELETE' })
      );
      
      await Promise.all(deletePromises);
      await loadExtraCosts(currentJob.id); // Reload (should be empty)
    } catch (error) {
      logError('Error clearing all extra notes:', error);
    }
  }
}


// Communication functions
function sendText(phoneNumber) {
  if (!phoneNumber || phoneNumber === 'Not provided') {
    log('No phone number available for this customer.');
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
      log(`Phone number ${phoneNumber} copied to clipboard!`);
    }).catch(() => {
      log(`Phone number: ${phoneNumber}`);
    });
  }
}

// Calendar Functions
function initializeCalendar() {
  log('Initializing calendar...');
  setupCalendarEventListeners();
  setupScheduleViewToggle();
  renderCalendar();
  loadCalendarEvents();
}

// Schedule View Toggle
function setupScheduleViewToggle() {
  const calendarBtn = document.getElementById('calendarViewBtn');
  const ganttBtn = document.getElementById('ganttViewBtn');
  const calendarView = document.getElementById('calendarView');
  const ganttView = document.getElementById('ganttView');
  
  if (!calendarBtn || !ganttBtn) return;
  
  // Calendar view button
  calendarBtn.addEventListener('click', () => {
    calendarBtn.classList.add('active');
    ganttBtn.classList.remove('active');
    if (calendarView) calendarView.style.display = 'block';
    if (ganttView) ganttView.style.display = 'none';
    
    // Show add event button for calendar
    const addEventBtn = document.getElementById('addEventBtn');
    if (addEventBtn) addEventBtn.style.display = 'inline-block';
  });
  
  // Gantt view button  
  ganttBtn.addEventListener('click', () => {
    ganttBtn.classList.add('active');
    calendarBtn.classList.remove('active');
    if (calendarView) calendarView.style.display = 'none';
    if (ganttView) ganttView.style.display = 'block';
    
    // Hide add event button for Gantt (uses job creation instead)
    const addEventBtn = document.getElementById('addEventBtn');
    if (addEventBtn) addEventBtn.style.display = 'none';
    
    // Initialize Gantt chart if not already done
    initializeGanttChart();
  });
}

let ganttChart = null;

function initializeGanttChart() {
  if (!ganttChart) {
    const container = document.getElementById('ganttChartContainer');
    if (container) {
      ganttChart = new GanttChart(container);
      ganttChart.loadData();
    }
  } else {
    // Refresh data if already initialized
    ganttChart.loadData();
  }
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
      log('Event created successfully!');
    } else {
      const error = await response.json();
      logError(error.message || 'Failed to create event');
    }
  } catch (error) {
    logError('Error creating event:', error);
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
      logError('Failed to load calendar events');
    }
  } catch (error) {
    logError('Error loading calendar events:', error);
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
      eventElement.draggable = true;
      eventElement.dataset.eventId = event.id;
      eventElement.dataset.eventDate = event.event_date;
      eventElement.title = `${event.title}\n${event.description || ''}`;
      
      // Create event content with title and delete button
      eventElement.innerHTML = `
        <span class="event-title">${escapeHtml(event.title)}</span>
        <button class="event-delete-btn" onclick="deleteCalendarEvent('${event.id}'); event.stopPropagation();" title="Delete event">×</button>
      `;
      
      // Add drag event listeners
      eventElement.addEventListener('dragstart', handleEventDragStart);
      eventElement.addEventListener('dragend', handleEventDragEnd);
      
      // Click handler (prevent when dragging)
      eventElement.addEventListener('click', (e) => {
        if (!eventElement.classList.contains('dragging') && !e.target.classList.contains('event-delete-btn')) {
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
  log(`Event: ${event.title} - Date: ${event.event_date} - Type: ${event.event_type}`);
  // TODO: Show event details in a modal instead of alert
}

// Drag and Drop Functions
let draggedEvent = null;
let draggedEventElement = null;

function handleEventDragStart(e) {
  draggedEventElement = e.target;
  draggedEvent = {
    id: e.target.dataset.eventId,
    originalDate: e.target.dataset.eventDate,
    title: e.target.querySelector('.event-title')?.textContent || e.target.textContent
  };
  
  e.target.classList.add('dragging');
  
  // Set drag data
  e.dataTransfer.setData('text/plain', draggedEvent.id);
  e.dataTransfer.effectAllowed = 'move';
  
  // Add visual feedback to all calendar days
  document.querySelectorAll('.calendar-day').forEach(day => {
    day.classList.add('drop-zone');
  });
  
  log('Started dragging event:', draggedEvent.title);
}

function handleEventDragEnd(e) {
  e.target.classList.remove('dragging');
  
  // Clean up visual feedback
  document.querySelectorAll('.calendar-day').forEach(day => {
    day.classList.remove('drop-zone', 'drag-over', 'drop-valid', 'drop-invalid');
  });
  
  draggedEvent = null;
  draggedEventElement = null;
  
  log('Ended dragging event');
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
    logError('No target date found');
    return;
  }
  
  // Don't allow dropping on the same date
  if (targetDate === draggedEvent.originalDate) {
    log('Cannot drop event on the same date');
    return;
  }
  
  log(`Moving event ${draggedEvent.title} from ${draggedEvent.originalDate} to ${targetDate}`);
  
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
      log('Event moved successfully');
      // Reload calendar events to reflect the change
      await loadCalendarEvents();
      
      // Show success feedback
      showMoveSuccessFeedback(targetDate);
    } else {
      logError('Failed to move event');
    }
  } catch (error) {
    logError('Error moving event:', error);
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

// Delete calendar event
async function deleteCalendarEvent(eventId) {
  try {
    const response = await fetch(`/api/calendar/events/${eventId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      log('Event deleted successfully');
      // Reload calendar events to reflect the change
      await loadCalendarEvents();
    } else {
      logError('Failed to delete event');
    }
  } catch (error) {
    logError('Error deleting event:', error);
  }
}

// Backup functionality
async function createBackup() {
  const statusElement = document.getElementById('backupStatus');
  
  try {
    statusElement.textContent = 'Creating backup...';
    statusElement.style.color = '#059669';
    
    const response = await fetch('/api/backup/create', {
      method: 'POST'
    });
    
    const result = await response.json();
    
    if (result.success) {
      statusElement.textContent = 'Backup created successfully!';
      statusElement.style.color = '#059669';
      log('Backup created:', result.backup.filename);
      
      // Refresh backup history if on settings page
      const settingsPage = document.getElementById('settings');
      if (settingsPage && settingsPage.classList.contains('active')) {
        loadBackupHistory();
      }
      
      // Reset status after 3 seconds
      setTimeout(() => {
        statusElement.textContent = 'Create backup of your data';
        statusElement.style.color = '';
      }, 3000);
    } else {
      throw new Error(result.error || 'Backup failed');
    }
  } catch (error) {
    logError('Backup failed:', error);
    statusElement.textContent = 'Backup failed - try again';
    statusElement.style.color = '#DC2626';
    
    // Reset status after 5 seconds
    setTimeout(() => {
      statusElement.textContent = 'Create backup of your data';
      statusElement.style.color = '';
    }, 5000);
  }
}

async function loadBackupInfo() {
  try {
    const response = await fetch('/api/backup/list');
    const result = await response.json();
    
    if (result.success && result.backups.length > 0) {
      const latestBackup = result.backups[0];
      const backupDate = new Date(latestBackup.created);
      const statusElement = document.getElementById('backupStatus');
      
      if (statusElement) {
        const timeAgo = getTimeAgo(backupDate);
        statusElement.textContent = `Last backup: ${timeAgo}`;
      }
    }
  } catch (error) {
    logError('Failed to load backup info:', error);
  }
}

function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else {
    return 'Less than an hour ago';
  }
}

// Settings page functionality
function setupSettingsTabs() {
  const tabs = document.querySelectorAll('.settings-tab');
  const contents = document.querySelectorAll('.settings-tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;

      // Remove active class from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));

      // Add active class to selected tab and content
      tab.classList.add('active');
      document.getElementById(tabName + 'Tab').classList.add('active');

      // Load tab-specific data
      if (tabName === 'backup') {
        loadBackupHistory();
      } else if (tabName === 'textsend') {
        loadTextSendContacts();
      }
    });
  });
}

function showContactModal(contact = null) {
  const modal = document.getElementById('contactModal');
  const form = document.getElementById('contactForm');
  const title = modal.querySelector('.modal-header h3');
  
  if (contact) {
    // Edit mode
    title.textContent = 'Edit Contact';
    document.getElementById('contactName').value = contact.name;
    document.getElementById('contactPhone').value = formatPhoneNumber(contact.phone || '');
    document.getElementById('contactAddress').value = contact.address || '';
    document.getElementById('contactNotes').value = contact.notes || '';
    
    const typeRadio = document.querySelector(`input[name="contactType"][value="${contact.type}"]`);
    if (typeRadio) {
      typeRadio.checked = true;
    }
    
    form.dataset.contactId = contact.id;
  } else {
    // Add mode
    title.textContent = 'Add Contact';
    form.reset();
    delete form.dataset.contactId;
  }
  
  modal.classList.add('active');
  
  // Setup phone formatting
  const phoneInput = document.getElementById('contactPhone');
  phoneInput.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 0) {
      if (value.length <= 3) {
        value = `(${value}`;
      } else if (value.length <= 6) {
        value = `(${value.slice(0,3)}) ${value.slice(3)}`;
      } else {
        value = `(${value.slice(0,3)}) ${value.slice(3,6)}-${value.slice(6,10)}`;
      }
    }
    e.target.value = value;
  });
}

function validatePhoneNumber(phone) {
  const cleanPhone = phone.replace(/\D/g, '');
  // Check for either a 7-digit (local) or 10-digit number
  if (cleanPhone.length !== 7 && cleanPhone.length !== 10) {
    return { valid: false, message: 'Phone number must be 7 or 10 digits' };
  }
  return { valid: true, cleanPhone };
}

async function handleContactSubmit(e) {
  e.preventDefault();
  console.log('Contact form submitted');
  
  const form = e.target;
  const formData = new FormData(form);
  
  // Get and clean phone number (remove formatting)
  const phoneValue = document.getElementById('contactPhone').value.trim();
  const phoneValidation = validatePhoneNumber(phoneValue);
  if (!phoneValidation.valid) {
    alert(phoneValidation.message);
    return;
  }
  const cleanPhone = phoneValidation.cleanPhone;
  
  // Update the form data with cleaned phone
  formData.set('contactPhone', cleanPhone);
  
  console.log('Form data:', Object.fromEntries(formData));
  await saveContact(formData);
}


function editContact(contactId) {
  // Find contact in our loaded contacts
  const contact = textSendContacts.find(c => c.id === contactId);
  if (contact) {
    showContactModal(contact);
  } else {
    // Fallback: fetch from server
    fetch(`/api/contacts/${contactId}`)
      .then(r => r.json())
      .then(contact => {
        showContactModal(contact);
      })
      .catch(err => {
        logError('Failed to load contact', err);
        alert('Failed to load contact');
      });
  }
}


function setupSettingsTabListeners() {
  // Remove existing listeners first
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.removeEventListener('click', handleSettingsTabClick);
  });
  
  // Add new listeners
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', handleSettingsTabClick);
  });
}

function handleSettingsTabClick(e) {
  const targetTab = e.target.dataset.tab;
  showSettingsTab(targetTab);
}

function showSettingsTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  
  // Update tab content
  document.querySelectorAll('.settings-tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  document.getElementById(`${tabName}Tab`).classList.add('active');
}

async function loadBackupHistory() {
  const historyContainer = document.getElementById('backupHistory');
  
  try {
    const response = await fetch('/api/backup/list');
    const result = await response.json();
    
    if (result.success && result.backups.length > 0) {
      const backupsHtml = result.backups.map(backup => {
        const date = new Date(backup.created);
        const formattedDate = date.toLocaleString();
        const size = formatFileSize(backup.size);
        const timeAgo = getTimeAgo(date);
        
        // Extract reason from filename
        const reasonMatch = backup.filename.match(/crm-backup-(\w+)-/);
        const reason = reasonMatch ? reasonMatch[1] : 'unknown';
        const reasonText = reason.charAt(0).toUpperCase() + reason.slice(1);
        
        return `
          <div class="backup-item">
            <div class="backup-item-info">
              <h5>${reasonText} Backup</h5>
              <p>${formattedDate} (${timeAgo})</p>
            </div>
            <div class="backup-size">${size}</div>
          </div>
        `;
      }).join('');
      
      historyContainer.innerHTML = backupsHtml;
      
      // Also populate the restore dropdown
      populateRestoreDropdown(result.backups);
    } else {
      historyContainer.innerHTML = '<div class="backup-loading">No backups found</div>';
    }
  } catch (error) {
    logError('Failed to load backup history:', error);
    historyContainer.innerHTML = '<div class="backup-loading">Failed to load backup history</div>';
  }
}

// Populate restore dropdown with available backups
function populateRestoreDropdown(backups) {
  const selectElement = document.getElementById('backupSelect');
  if (!selectElement) return;
  
  // Clear existing options except the first one
  const firstOption = selectElement.querySelector('option[value=""]');
  selectElement.innerHTML = '';
  selectElement.appendChild(firstOption);
  
  // Add backup options
  backups.forEach(backup => {
    const date = new Date(backup.created);
    const formattedDate = date.toLocaleString();
    const timeAgo = getTimeAgo(date);
    
    // Extract reason from filename
    const reasonMatch = backup.filename.match(/crm-backup-(\w+)-/);
    const reason = reasonMatch ? reasonMatch[1] : 'unknown';
    const reasonText = reason.charAt(0).toUpperCase() + reason.slice(1);
    
    const option = document.createElement('option');
    option.value = backup.filename;
    option.textContent = `${reasonText} - ${formattedDate} (${timeAgo})`;
    option.dataset.created = backup.created;
    selectElement.appendChild(option);
  });
  
  // Enable/disable restore button based on selection
  selectElement.addEventListener('change', function() {
    const restoreBtn = document.querySelector('.restore-btn');
    if (this.value) {
      restoreBtn.disabled = false;
    } else {
      restoreBtn.disabled = true;
    }
  });
}

// Show restore confirmation modal
function showRestoreConfirmation() {
  const selectElement = document.getElementById('backupSelect');
  const selectedOption = selectElement.options[selectElement.selectedIndex];
  
  if (!selectedOption.value) {
    return;
  }
  
  const modal = document.getElementById('restoreModal');
  const backupName = selectedOption.value;
  const backupDate = new Date(selectedOption.dataset.created).toLocaleString();
  
  // Update modal content
  document.getElementById('selectedBackupName').textContent = backupName;
  document.getElementById('selectedBackupDate').textContent = backupDate;
  
  // Store selected backup filename for restore
  modal.dataset.selectedBackup = backupName;
  
  modal.classList.add('active');
}

// Execute the restore operation
async function executeRestore() {
  const modal = document.getElementById('restoreModal');
  const backupFilename = modal.dataset.selectedBackup;
  
  if (!backupFilename) {
    logError('No backup selected for restore');
    return;
  }
  
  const confirmBtn = document.querySelector('.restore-confirm-btn');
  const originalText = confirmBtn.textContent;
  
  try {
    confirmBtn.textContent = 'Restoring...';
    confirmBtn.disabled = true;
    
    const response = await fetch('/api/backup/restore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filename: backupFilename
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Show success message
      confirmBtn.textContent = 'Restore Successful!';
      confirmBtn.style.background = '#059669';
      
      // Show restoration status
      const statusDiv = document.createElement('div');
      statusDiv.className = 'restore-status-success';
      
      if (result.requiresRefresh) {
        // Cloud environment - manual refresh needed
        statusDiv.innerHTML = `
          <h4>✅ Database Restored Successfully!</h4>
          <p>• Pre-restore backup created: ${result.preRestoreBackup}</p>
          <p>• Database restored from: ${backupFilename}</p>
          <p><strong>Click the button below to see your restored data</strong></p>
          <button onclick="window.location.reload()" class="backup-btn" style="margin-top: 15px; padding: 12px 24px;">Refresh Page Now</button>
        `;
      } else {
        // Local development - server restart
        statusDiv.innerHTML = `
          <h4>✅ Database Restored Successfully!</h4>
          <p>• Pre-restore backup created: ${result.preRestoreBackup}</p>
          <p>• Database restored from: ${backupFilename}</p>
          <p>• Server is restarting automatically...</p>
          <p><strong>Page will reload in 5 seconds...</strong></p>
        `;
        
        setTimeout(() => {
          window.location.reload();
        }, 5000);
      }
      
      const modalContent = modal.querySelector('.restore-message');
      modalContent.innerHTML = '';
      modalContent.appendChild(statusDiv);
      
    } else {
      throw new Error(result.error || 'Restore failed');
    }
  } catch (error) {
    logError('Restore failed:', error);
    
    confirmBtn.textContent = 'Restore Failed';
    confirmBtn.style.background = '#DC2626';
    
    // Show error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'restore-status-error';
    errorDiv.innerHTML = `
      <h4>❌ Restore Failed</h4>
      <p>Error: ${error.message}</p>
      <p>Please try again or contact support.</p>
    `;
    
    const modalContent = modal.querySelector('.restore-message');
    modalContent.appendChild(errorDiv);
    
    setTimeout(() => {
      confirmBtn.textContent = originalText;
      confirmBtn.disabled = false;
      confirmBtn.style.background = '';
    }, 3000);
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Data Export/Import Functions for UI
async function exportUserData() {
  try {
    const response = await fetch('/api/data/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert(`✅ Data exported successfully!\n\nExported ${result.export.recordCount} records to data-export.json\n\nYou can now download the export file or it will be automatically imported after deployment.`);
    } else {
      alert('❌ Export failed: ' + result.error);
    }
  } catch (error) {
    console.error('Export error:', error);
    alert('❌ Export failed: ' + error.message);
  }
}

async function downloadDataExport() {
  try {
    const response = await fetch('/api/data/export/download');
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'khs-crm-data-export.json';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      alert('✅ Export file downloaded successfully!');
    } else {
      const errorResult = await response.json();
      alert('❌ Download failed: ' + errorResult.error);
    }
  } catch (error) {
    console.error('Download error:', error);
    alert('❌ Download failed: ' + error.message);
  }
}

async function importUserData() {
  if (!confirm('⚠️ Are you sure you want to import data?\n\nThis will import user data from the data-export.json file.\nThis should only be done after a fresh deployment.')) {
    return;
  }
  
  try {
    const response = await fetch('/api/data/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      if (result.import.imported) {
        alert(`✅ Data imported successfully!\n\nImported ${result.import.recordCount} records from data-export.json\n\nPlease refresh the page to see the imported data.`);
        // Auto-refresh after a short delay
        setTimeout(() => {
          location.reload();
        }, 2000);
      } else {
        alert('📋 No import file found.\n\nMake sure you have a data-export.json file to import.');
      }
    } else {
      alert('❌ Import failed: ' + result.error);
    }
  } catch (error) {
    console.error('Import error:', error);
    alert('❌ Import failed: ' + error.message);
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
// Clear all tasks for current job
async function clearJobTasks() {
  if (!currentJob) return;
  
  if (!confirm(`Are you sure you want to clear all tasks for this job?\n\nThis will delete ${currentJobTasks.length} task(s) and cannot be undone.`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/jobs/${currentJob.id}/tasks/clear`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (response.ok) {
      log(`Cleared ${result.count} tasks`);
      await loadJobTasks(currentJob.id);
    } else {
      logError('Failed to clear tasks:', result.error);
    }
  } catch (error) {
    logError('Error clearing tasks:', error);
  }
}

// Clear all tools for current job
async function clearJobTools() {
  if (!currentJob) return;
  
  if (!confirm(`Are you sure you want to clear all tools for this job?\n\nThis will delete ${currentJobTools.length} tool(s) and cannot be undone.`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/jobs/${currentJob.id}/tools/clear`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (response.ok) {
      log(`Cleared ${result.count} tools`);
      await loadJobTools(currentJob.id);
    } else {
      logError('Failed to clear tools:', result.error);
    }
  } catch (error) {
    logError('Error clearing tools:', error);
  }
}

// Clear all materials for current job
async function clearJobMaterials() {
  if (!currentJob) return;
  
  if (!confirm(`Are you sure you want to clear all materials for this job?\n\nThis will delete ${currentJobMaterials.length} material(s) and cannot be undone.`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/jobs/${currentJob.id}/materials/clear`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (response.ok) {
      log(`Cleared ${result.count} materials`);
      await loadJobMaterials(currentJob.id);
    } else {
      logError('Failed to clear materials:', result.error);
    }
  } catch (error) {
    logError('Error clearing materials:', error);
  }
}

window.addTask = addTask;
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;
window.assignWorkerToTask = assignWorkerToTask;
window.clearJobTasks = clearJobTasks;
window.addTool = addTool;
window.toggleTool = toggleTool;
window.deleteTool = deleteTool;
window.clearJobTools = clearJobTools;
window.addMaterial = addMaterial;
window.toggleMaterial = toggleMaterial;
window.deleteMaterial = deleteMaterial;
window.updateMaterialSupplier = updateMaterialSupplier;
window.clearJobMaterials = clearJobMaterials;
window.addExtraNote = addExtraNote;
window.deleteExtraNote = deleteExtraNote;
window.clearAllExtraNotes = clearAllExtraNotes;
window.showCustomerModal = showCustomerModal;
window.showJobModal = showJobModal;
window.testNavigation = testNavigation;
window.selectDate = selectDate;
window.viewEvent = viewEvent;
window.deleteCalendarEvent = deleteCalendarEvent;
window.createBackup = createBackup;
window.exportUserData = exportUserData;
window.downloadDataExport = downloadDataExport;
window.importUserData = importUserData;

// Workers Management
let workers = [];
let currentWeekStart = null;
let workHours = [];

// Workers tab management
function setupWorkersTabs() {
  document.querySelectorAll('.workers-tab').forEach(tab => {
    tab.removeEventListener('click', handleWorkersTabClick);
    tab.addEventListener('click', handleWorkersTabClick);
  });
}

function handleWorkersTabClick(e) {
  const targetTab = e.target.dataset.tab;
  showWorkersTab(targetTab);
}

function showWorkersTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.workers-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  
  // Update tab content
  document.querySelectorAll('.workers-tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  document.getElementById(`${tabName}Tab`).classList.add('active');
  
  // Load tab-specific data
  if (tabName === 'hours') {
    initializeWeekNavigation();
    loadWorkHours();
    setupHoursEventListeners();
  } else if (tabName === 'timesheet') {
    initializeTimesheet();
  }
}

// Load workers from API
async function loadWorkers() {
  try {
    const response = await fetch('/api/workers?status=ACTIVE');
    const data = await response.json();
    
    if (response.ok) {
      workers = data;
      renderWorkers();
    } else {
      logError('Failed to load workers:', data.error);
    }
  } catch (error) {
    logError('Error loading workers:', error);
  }
}

// Render workers list
function renderWorkers() {
  const workersList = document.getElementById('workersList');
  
  // Check if element exists (we might be on a different page)
  if (!workersList) {
    log('workersList element not found, skipping render');
    return;
  }
  
  if (workers.length === 0) {
    workersList.innerHTML = '<div class="workers-loading">No workers found. Click "+ Add Worker" to get started.</div>';
    return;
  }
  
  const workersHtml = workers.map(worker => {
    const totalHours = worker.total_hours_worked || 0;
    const phone = worker.phone || 'Not provided';
    const email = worker.email || 'Not provided';
    
    return `
      <div class="worker-card">
        <div class="worker-card-header">
          <div class="worker-info">
            <h4>${escapeHtml(worker.name)}</h4>
            <span class="worker-role">${escapeHtml(worker.role)}</span>
          </div>
          <div class="worker-actions">
            <button class="edit-worker-btn" onclick="editWorker('${worker.id}')">Edit</button>
            <button class="delete-worker-btn" onclick="deleteWorker('${worker.id}')">Delete</button>
          </div>
        </div>
        <div class="worker-details">
          <div class="worker-contact">
            <div><strong>Phone:</strong> ${escapeHtml(phone)}</div>
            <div><strong>Email:</strong> ${escapeHtml(email)}</div>
          </div>
          <div class="worker-stats">
            <div><strong>Total Hours:</strong> ${totalHours.toFixed(1)}</div>
            <div><strong>Time Entries:</strong> ${worker.total_entries || 0}</div>
            <div><strong>Status:</strong> ${worker.status}</div>
          </div>
        </div>
        ${worker.notes ? `<div style="margin-top: 12px; font-size: 14px; color: #6B7280;"><strong>Notes:</strong> ${escapeHtml(worker.notes)}</div>` : ''}
      </div>
    `;
  }).join('');
  
  workersList.innerHTML = workersHtml;
}

// Show worker modal
function showWorkerModal(worker = null) {
  const modal = document.getElementById('workerModal');
  const form = document.getElementById('workerForm');
  const title = modal.querySelector('.modal-header h3');
  
  if (worker) {
    // Edit mode
    log('Setting up edit mode for worker:', worker);
    title.textContent = 'Edit Worker';
    document.getElementById('workerInitials').value = worker.initials || '';
    document.getElementById('workerName').value = worker.name;
    
    // Set the radio button for role
    const roleRadio = document.querySelector(`input[name="workerRole"][value="${worker.role}"]`);
    if (roleRadio) {
      roleRadio.checked = true;
    } else {
      log('No matching role radio found for:', worker.role);
    }
    
    const phoneValue = worker.phone || '';
    document.getElementById('workerPhone').value = formatPhoneNumber(phoneValue);
    document.getElementById('workerEmail').value = worker.email || '';
    document.getElementById('workerNotes').value = worker.notes || '';
    
    // Ensure worker ID is properly set
    form.dataset.workerId = worker.id;
    log('Set form workerId to:', worker.id);
  } else {
    // Add mode
    title.textContent = 'Add Worker';
    form.reset();
    delete form.dataset.workerId;
  }
  
  modal.classList.add('active');
  
  // Setup phone formatting for this modal instance
  setupPhoneFormatting();
}

function editWorker(workerId) {
  const worker = workers.find(w => w.id === workerId);
  if (worker) {
    showWorkerModal(worker);
  }
}

async function deleteWorker(workerId) {
  try {
    const response = await fetch(`/api/workers/${workerId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      loadWorkers(); // Reload the old list
      loadActiveWorkers(); // Reload the team members grid
    } else {
      logError('Failed to delete worker');
    }
  } catch (error) {
    logError('Error deleting worker:', error);
  }
}

// Handle worker form submission
async function handleWorkerSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const workerId = form.dataset.workerId;
  const isEdit = !!workerId;
  
  log('Worker submit:', { workerId, isEdit, formData: form.dataset });
  
  // Get selected role from radio buttons
  const selectedRole = document.querySelector('input[name="workerRole"]:checked');
  
  if (!selectedRole) {
    logError('No role selected');
    alert('Please select a role');
    return;
  }
  
  // Validate required fields
  const initials = document.getElementById('workerInitials').value.trim();
  const name = document.getElementById('workerName').value.trim();
  
  if (!initials) {
    logError('Initials are required');
    alert('Please enter worker initials');
    return;
  }
  
  if (!name) {
    logError('Name is required');
    alert('Please enter worker name');
    return;
  }
  
  // Get and clean phone number (remove formatting)
  const phoneValue = document.getElementById('workerPhone').value.trim();
  const cleanPhone = phoneValue.replace(/\D/g, ''); // Remove all non-digits
  
  const workerData = {
    name: name,
    role: selectedRole.value,
    hourly_rate: 0, // Default value since we removed the field
    phone: cleanPhone, // Store clean digits only
    email: document.getElementById('workerEmail').value.trim(),
    address: '', // Default empty since we don't have this field
    hire_date: '', // Default empty since we removed this field
    status: 'ACTIVE', // Default status
    notes: document.getElementById('workerNotes').value.trim(),
    initials: initials.toUpperCase()
  };
  
  log('Worker data to save:', workerData);
  
  // Safety check for edit operations
  if (isEdit && !workerId) {
    logError('Edit mode but no workerId found!');
    alert('Error: Cannot edit worker - missing worker ID');
    return;
  }
  
  try {
    const url = isEdit ? `/api/workers/${workerId}` : '/api/workers';
    const method = isEdit ? 'PUT' : 'POST';
    
    log('Making request:', { url, method, isEdit, workerId });
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workerData),
    });
    
    const data = await response.json();
    log('Server response:', { status: response.status, data });
    
    if (response.ok) {
      log('Worker save successful, reloading data...');
      hideModals();
      
      try {
        // Primary reload: team members grid (this is what's visible)
        await loadActiveWorkers();
        
        // Secondary reloads: only if elements exist
        const workersList = document.getElementById('workersList');
        if (workersList) {
          await loadWorkers();
        }
        
        // Reload work hours dropdowns if hours modal exists
        const hoursWorker = document.getElementById('hoursWorker');
        if (hoursWorker) {
          loadWorkersForDropdowns();
        }
        
        log('Data reload complete successfully');
      } catch (reloadError) {
        logError('Error during data reload:', reloadError);
        alert('Worker saved successfully, but there was an issue refreshing the display. Please refresh the page.');
      }
    } else {
      logError('Server error:', data.error || 'Failed to save worker');
      alert(`Failed to save worker: ${data.error || 'Unknown error'}`);
    }
  } catch (error) {
    logError('Error saving worker:', error);
    alert(`Error saving worker: ${error.message}`);
  }
}

// Week navigation for hours tracking
function initializeWeekNavigation() {
  if (!currentWeekStart) {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday
    currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - dayOfWeek); // Go back to Sunday
  }
  updateWeekDisplay();
}

function navigateWeek(direction) {
  currentWeekStart.setDate(currentWeekStart.getDate() + (direction * 7));
  updateWeekDisplay();
  loadWorkHours();
}

function goToThisWeek() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - dayOfWeek);
  updateWeekDisplay();
  loadWorkHours();
}

function updateWeekDisplay() {
  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(currentWeekStart.getDate() + 6);
  
  const weekText = `Week of ${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  
  document.getElementById('currentWeek').textContent = weekText;
}

// Setup hours event listeners
function setupHoursEventListeners() {
  // Week navigation
  document.getElementById('prevWeek').onclick = () => navigateWeek(-1);
  document.getElementById('nextWeek').onclick = () => navigateWeek(1);
  document.getElementById('thisWeek').onclick = goToThisWeek;
  
  // Log hours button
  document.getElementById('logHoursBtn').onclick = () => showHoursModal();
}

// Load work hours for current week
async function loadWorkHours() {
  if (!currentWeekStart) return;
  
  try {
    const weekStartStr = currentWeekStart.toISOString().split('T')[0];
    const response = await fetch(`/api/work-hours?week_start=${weekStartStr}`);
    const data = await response.json();
    
    if (response.ok) {
      workHours = data;
      renderHoursSummary();
      renderHoursDetails();
    } else {
      logError('Failed to load work hours:', data.error);
    }
  } catch (error) {
    logError('Error loading work hours:', error);
  }
}

// Render hours summary
function renderHoursSummary() {
  const summaryContainer = document.getElementById('hoursSummary');
  
  // Calculate summary statistics
  let totalHours = 0;
  let totalOvertimeHours = 0;
  let totalEntries = workHours.length;
  const uniqueWorkers = new Set();
  
  workHours.forEach(entry => {
    totalHours += entry.hours_worked || 0;
    totalOvertimeHours += entry.overtime_hours || 0;
    uniqueWorkers.add(entry.worker_id);
  });
  
  const summaryHtml = `
    <div class="summary-card">
      <h4>Total Hours</h4>
      <div class="hours">${totalHours.toFixed(1)}</div>
      <div class="label">This Week</div>
    </div>
    <div class="summary-card">
      <h4>Overtime Hours</h4>
      <div class="hours">${totalOvertimeHours.toFixed(1)}</div>
      <div class="label">Over 8/day</div>
    </div>
    <div class="summary-card">
      <h4>Active Workers</h4>
      <div class="hours">${uniqueWorkers.size}</div>
      <div class="label">Workers</div>
    </div>
    <div class="summary-card">
      <h4>Time Entries</h4>
      <div class="hours">${totalEntries}</div>
      <div class="label">Entries</div>
    </div>
  `;
  
  summaryContainer.innerHTML = summaryHtml;
}

// Render detailed hours
function renderHoursDetails() {
  const detailsContainer = document.getElementById('hoursDetailsList');
  
  if (workHours.length === 0) {
    detailsContainer.innerHTML = '<div class="hours-loading">No hours logged for this week.</div>';
    return;
  }
  
  const headerHtml = `
    <div class="hours-table-header">
      <div>Worker</div>
      <div>Job</div>
      <div>Date</div>
      <div>Time</div>
      <div>Hours</div>
      <div>Work Type</div>
      <div>Description</div>
      <div>Actions</div>
    </div>
  `;
  
  const entriesHtml = workHours.map(entry => {
    const workDate = parseLocalDate(entry.work_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const jobInfo = entry.job_title ? `${entry.customer_name} - ${entry.job_title}` : 'No job assigned';
    const timeRange = `${formatTime12Hour(entry.start_time)} - ${formatTime12Hour(entry.end_time)}`;
    const description = entry.description || 'No description';
    
    return `
      <div class="hours-entry">
        <div class="worker-name">${escapeHtml(entry.worker_name)}</div>
        <div class="job-info">${escapeHtml(jobInfo)}</div>
        <div class="work-date">${workDate}</div>
        <div class="time-range">${timeRange}</div>
        <div class="hours-worked">${entry.hours_worked.toFixed(1)}h</div>
        <div class="work-type">${escapeHtml(entry.work_type)}</div>
        <div>${escapeHtml(description)}</div>
        <div class="hours-actions">
          <button class="edit-hours-btn" onclick="editHours('${entry.id}')">Edit</button>
          <button class="delete-hours-btn" onclick="deleteHours('${entry.id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
  
  detailsContainer.innerHTML = headerHtml + entriesHtml;
}

// Hours modal functions
function showHoursModal(hours = null) {
  const modal = document.getElementById('hoursModal');
  const form = document.getElementById('hoursForm');
  const title = modal.querySelector('.modal-header h3');
  
  // Close the Worker Details modal if it's open (so edit modal is visible)
  const workerModal = document.getElementById('workerDetailModal');
  if (workerModal && workerModal.classList.contains('active')) {
    workerModal.classList.remove('active');
  }
  
  // Load workers and jobs in dropdowns
  loadWorkersForDropdowns();
  loadJobsForDropdowns();
  
  // Setup 5-minute rounding for time inputs in the modal
  setupHoursModalTimeRounding();
  
  if (hours) {
    // Edit mode
    title.textContent = 'Edit Work Hours';
    document.getElementById('hoursWorker').value = hours.worker_id;
    document.getElementById('hoursJob').value = hours.job_id || '';
    document.getElementById('hoursDate').value = hours.work_date;
    document.getElementById('hoursStartTime').value = hours.start_time;
    document.getElementById('hoursEndTime').value = hours.end_time;
    document.getElementById('hoursBreakMinutes').value = hours.break_minutes || 0;
    document.getElementById('hoursWorkType').value = hours.work_type;
    document.getElementById('hoursDescription').value = hours.description || '';
    form.dataset.hoursId = hours.id;
  } else {
    // Add mode
    title.textContent = 'Log Work Hours';
    form.reset();
    // Set default date to today
    document.getElementById('hoursDate').value = new Date().toISOString().split('T')[0];
    delete form.dataset.hoursId;
  }
  
  // Setup custom close handler to reopen worker modal if needed
  const closeBtn = modal.querySelector('.close-btn');
  if (closeBtn) {
    // Remove any existing event listeners
    closeBtn.onclick = null;
    closeBtn.onclick = () => {
      modal.classList.remove('active');
      // If we have a current worker, reopen their detail modal
      if (window.currentWorker) {
        const workerModal = document.getElementById('workerDetailModal');
        if (workerModal) {
          workerModal.classList.add('active');
          // Switch back to hours tab to show the updated data
          showWorkerTab('hours');
        }
      }
    };
  }
  
  modal.classList.add('active');
}

// Setup 5-minute rounding for hours modal time inputs
function setupHoursModalTimeRounding() {
  const startTimeInput = document.getElementById('hoursStartTime');
  const endTimeInput = document.getElementById('hoursEndTime');
  const breakMinutesInput = document.getElementById('hoursBreakMinutes');
  
  if (startTimeInput && !startTimeInput.hasAttribute('data-rounded-setup')) {
    startTimeInput.addEventListener('change', () => {
      startTimeInput.value = roundTimeToFiveMinutes(startTimeInput.value);
    });
    startTimeInput.addEventListener('blur', () => {
      startTimeInput.value = roundTimeToFiveMinutes(startTimeInput.value);
    });
    startTimeInput.setAttribute('data-rounded-setup', 'true');
  }
  
  if (endTimeInput && !endTimeInput.hasAttribute('data-rounded-setup')) {
    endTimeInput.addEventListener('change', () => {
      endTimeInput.value = roundTimeToFiveMinutes(endTimeInput.value);
    });
    endTimeInput.addEventListener('blur', () => {
      endTimeInput.value = roundTimeToFiveMinutes(endTimeInput.value);
    });
    endTimeInput.setAttribute('data-rounded-setup', 'true');
  }
  
  if (breakMinutesInput && !breakMinutesInput.hasAttribute('data-rounded-setup')) {
    breakMinutesInput.addEventListener('change', () => {
      const breakMinutes = parseInt(breakMinutesInput.value) || 0;
      const roundedBreak = Math.round(breakMinutes / 5) * 5;
      breakMinutesInput.value = roundedBreak;
    });
    breakMinutesInput.addEventListener('blur', () => {
      const breakMinutes = parseInt(breakMinutesInput.value) || 0;
      const roundedBreak = Math.round(breakMinutes / 5) * 5;
      breakMinutesInput.value = roundedBreak;
    });
    breakMinutesInput.setAttribute('data-rounded-setup', 'true');
  }
}

async function editHours(hoursId) {
  try {
    console.log('✏️ Editing hours with ID:', hoursId);
    
    // Fetch the specific hours entry from the server
    const response = await fetch(`/api/work-hours/${hoursId}`);
    if (response.ok) {
      const hours = await response.json();
      console.log('✏️ Hours data loaded for editing:', hours);
      showHoursModal(hours);
    } else {
      console.error('❌ Failed to load hours for editing');
      alert('Failed to load hours data for editing');
    }
  } catch (error) {
    console.error('❌ Error loading hours for editing:', error);
    alert('Error loading hours data for editing');
  }
}

async function deleteHours(hoursId) {
  console.log('🗑️ Attempting to delete hours with ID:', hoursId);
  
  if (!confirm('Are you sure you want to delete this time entry?')) {
    return;
  }
  
  try {
    console.log('🗑️ Sending DELETE request to:', `/api/work-hours/${hoursId}`);
    const response = await fetch(`/api/work-hours/${hoursId}`, {
      method: 'DELETE'
    });
    
    console.log('🗑️ Delete response status:', response.status);
    
    if (response.ok) {
      console.log('✅ Hours deleted successfully');
      loadWorkHours(); // Reload the hours
      // Also reload worker hours if we're in worker detail view
      if (window.currentWorker) {
        console.log('🔄 Refreshing data after delete for worker:', window.currentWorker.id);
        loadWorkerHours(window.currentWorker.id);
        // Refresh the existing dates for the date picker
        await refreshExistingDates(window.currentWorker.id);
        console.log('🔄 Date refresh completed after delete');
      }
    } else {
      const errorData = await response.text();
      console.error('❌ Delete failed. Status:', response.status, 'Response:', errorData);
      logError('Failed to delete hours');
    }
  } catch (error) {
    logError('Error deleting hours:', error);
  }
}

// Load workers for dropdown
async function loadWorkersForDropdowns() {
  const workerSelect = document.getElementById('hoursWorker');
  if (!workerSelect) return;
  
  // Clear existing options except the first one
  const firstOption = workerSelect.querySelector('option[value=""]');
  workerSelect.innerHTML = '';
  workerSelect.appendChild(firstOption);
  
  workers.forEach(worker => {
    const option = document.createElement('option');
    option.value = worker.id;
    option.textContent = `${worker.name} - ${worker.role}`;
    workerSelect.appendChild(option);
  });
}

// Load jobs for dropdown
async function loadJobsForDropdowns() {
  const jobSelect = document.getElementById('hoursJob');
  if (!jobSelect) return;
  
  try {
    const response = await fetch('/api/jobs');
    const jobs = await response.json();
    
    // Clear existing options except the first one
    const firstOption = jobSelect.querySelector('option[value=""]');
    jobSelect.innerHTML = '';
    jobSelect.appendChild(firstOption);
    
    if (response.ok) {
      jobs.forEach(job => {
        const option = document.createElement('option');
        option.value = job.id;
        option.textContent = `${job.customer_name} - ${job.title}`;
        jobSelect.appendChild(option);
      });
    }
  } catch (error) {
    logError('Error loading jobs:', error);
  }
}

// Load job locations for wizard dropdown (Customer : Job)
async function loadJobLocationsForWizard() {
  const jobLocationSelect = document.getElementById('jobLocation');
  if (!jobLocationSelect) return;

  try {
    const response = await fetch('/api/jobs');
    const jobs = await response.json();

    // Preserve the placeholder
    const placeholder = jobLocationSelect.querySelector('option[value=""]') || (() => { const opt = document.createElement('option'); opt.value = ''; opt.textContent = 'Select location...'; return opt; })();
    jobLocationSelect.innerHTML = '';
    jobLocationSelect.appendChild(placeholder);

    if (response.ok) {
      jobs.forEach(job => {
        const option = document.createElement('option');
        option.value = `${job.customer_name} : ${job.title}`;
        option.textContent = `${job.customer_name} : ${job.title}`;
        jobLocationSelect.appendChild(option);
      });
    }
  } catch (error) {
    logError('Error loading job locations:', error);
  }
}

// Handle hours form submission
async function handleHoursSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const hoursId = form.dataset.hoursId;
  const isEdit = !!hoursId;
  
  const hoursData = {
    worker_id: document.getElementById('hoursWorker').value,
    job_id: document.getElementById('hoursJob').value || null,
    work_date: document.getElementById('hoursDate').value,
    start_time: document.getElementById('hoursStartTime').value,
    end_time: document.getElementById('hoursEndTime').value,
    break_minutes: parseInt(document.getElementById('hoursBreakMinutes').value) || 0,
    work_type: document.getElementById('hoursWorkType').value,
    description: document.getElementById('hoursDescription').value
  };
  
  if (!hoursData.worker_id || !hoursData.work_date || !hoursData.start_time || !hoursData.end_time || !hoursData.work_type) {
    logError('Please fill in all required fields');
    return;
  }
  
  try {
    const url = isEdit ? `/api/work-hours/${hoursId}` : '/api/work-hours';
    const method = isEdit ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(hoursData),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Close the hours modal
      document.getElementById('hoursModal').classList.remove('active');
      
      // Reload the general hours view
      loadWorkHours(); 
      
      // If we have a current worker, reopen their detail modal and refresh their hours
      if (window.currentWorker) {
        const workerModal = document.getElementById('workerDetailModal');
        if (workerModal) {
          workerModal.classList.add('active');
          // Switch back to hours tab and reload the worker's hours
          showWorkerTab('hours');
          loadWorkerHours(window.currentWorker.id);
        }
      }
    } else {
      logError(data.error || 'Failed to save hours');
    }
  } catch (error) {
    logError('Error saving hours:', error);
  }
}

// 🚀 BEAST MODE PHONE FORMATTER - Handles EVERYTHING!
if (!window.formatPhoneNumber) { window.formatPhoneNumber = function(value = '') {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}; }

// 💪 ULTIMATE PHONE SETUP - Works for ANY input field
const setupPhoneFormatting = (selector = 'input[type="tel"], #workerPhone, #customerPhone') => {
  document.querySelectorAll(selector).forEach(input => {
    if (input.dataset.phoneSetup) return; // Already set up
    input.dataset.phoneSetup = 'true';
    
    // Format existing value
    input.value = formatPhoneNumber(input.value);
    
    const handleInput = (e) => {
      e.stopPropagation(); // Prevent event bubbling
      const cursor = e.target.selectionStart;
      const oldLen = e.target.value.length;
      e.target.value = formatPhoneNumber(e.target.value);
      const diff = e.target.value.length - oldLen;
      requestAnimationFrame(() => e.target.setSelectionRange(cursor + diff, cursor + diff));
    };
    
    const handlePaste = (e) => {
      e.stopPropagation(); // Prevent event bubbling
      setTimeout(() => input.value = formatPhoneNumber(input.value), 10);
    };
    
    input.addEventListener('input', handleInput);
    input.addEventListener('paste', handlePaste);
    input.addEventListener('focus', (e) => e.stopPropagation());
    input.addEventListener('blur', (e) => e.stopPropagation());
  });
};

// Parse address string into components
function parseAddress(addressString) {
  if (!addressString) return { street: '', city: '', state: 'HI', zip: '' };
  
  log('Parsing address:', addressString);
  
  // Try to parse various address formats
  const patterns = [
    // "123 Main St, Honolulu, Hawaii 96815" (full state name)
    /^(.+?),\s*([^,]+),\s*(Hawaii)\s*(\d{5}(-\d{4})?)\s*$/i,
    // "123 Main St, Honolulu, HI 96815"
    /^(.+?),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5}(-\d{4})?)\s*$/,
    // "123 Main St, Honolulu HI 96815"
    /^(.+?),\s*([^,]+)\s+([A-Z]{2})\s*(\d{5}(-\d{4})?)\s*$/,
    // "123 Main St Honolulu, HI 96815"
    /^(.+?)\s+([^,]+),\s*([A-Z]{2})\s*(\d{5}(-\d{4})?)\s*$/,
    // "123 Main St Honolulu HI 96815"
    /^(.+?)\s+([A-Za-z\s]+)\s+([A-Z]{2})\s*(\d{5}(-\d{4})?)\s*$/
  ];
  
  for (const pattern of patterns) {
    const match = addressString.match(pattern);
    if (match) {
      // Always use HI for Hawaii-based CRM, regardless of what's in the address
      const result = {
        street: match[1].trim(),
        city: match[2].trim(),
        state: 'HI', // Always Hawaii for this CRM
        zip: match[4].trim()
      };
      
      log('Parsed address result:', result);
      return result;
    }
  }
  
  // Fallback: treat entire string as street address
  const result = {
    street: addressString.trim(),
    city: '',
    state: 'HI',
    zip: ''
  };
  
  log('Fallback address result:', result);
  return result;
}

// Simple Google Maps address helper
function setupGoogleMapsAddressHelper() {
  const streetInput = document.getElementById('customerStreet');
  
  if (!streetInput) {
    log('Street input not found for Google Maps helper');
    return;
  }
  
  log('Setting up Google Maps address helper');
  
  // Add a small Maps icon next to the street input
  const mapsButton = document.createElement('button');
  mapsButton.type = 'button';
  mapsButton.innerHTML = '🗺️';
  mapsButton.title = 'Search address in Google Maps';
  mapsButton.style.cssText = `
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    z-index: 10;
    padding: 4px;
  `;
  
  // Make the street input container relative so we can position the button
  streetInput.parentElement.style.position = 'relative';
  streetInput.style.paddingRight = '35px'; // Make room for the button
  streetInput.parentElement.appendChild(mapsButton);
  
  // Add click handler to open Google Maps
  mapsButton.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const address = streetInput.value.trim();
    
    if (address) {
      // Open Google Maps with the address
      const encodedAddress = encodeURIComponent(address);
      const mapsUrl = `https://www.google.com/maps/search/${encodedAddress}`;
      window.open(mapsUrl, '_blank');
      
      // Show helpful tip
      setTimeout(() => {
        alert('🗺️ Google Maps opened in a new tab!\n\nFind your address, then copy the city and ZIP code back to the form.');
      }, 500);
    } else {
      alert('Please enter a street address first, then click the map icon.');
    }
  });
  
  // Also allow clicking the input field itself to trigger maps
  streetInput.addEventListener('dblclick', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const address = streetInput.value.trim();
    if (address) {
      const encodedAddress = encodeURIComponent(address);
      const mapsUrl = `https://www.google.com/maps/search/${encodedAddress}`;
      window.open(mapsUrl, '_blank');
    }
  });
}

// 🚀 BEAST MODE: Use the universal setupPhoneFormatting instead!

// Setup worker event listeners in main setup
function setupWorkerEventListeners() {
  // Add worker button
  const addWorkerBtn = document.getElementById('addWorkerBtn');
  if (addWorkerBtn) {
    addWorkerBtn.addEventListener('click', () => showWorkerModal());
  }
  
  // Worker form
  const workerForm = document.getElementById('workerForm');
  if (workerForm) {
    workerForm.addEventListener('submit', handleWorkerSubmit);
  }
  
  // Hours form
  const hoursForm = document.getElementById('hoursForm');
  if (hoursForm) {
    hoursForm.addEventListener('submit', handleHoursSubmit);
  }
  
  // Setup phone formatting
  setupPhoneFormatting();
}

// Team Members / Worker Management Functions
async function initializeTeamMembers() {
  log('Initializing team members...');
  await loadActiveWorkers();
  setupWorkerEventListeners();
}

async function loadActiveWorkers() {
  try {
    log('Loading active workers...');
    const response = await fetch('/api/workers?status=ACTIVE');
    const workersData = await response.json();
    
    if (response.ok) {
      log('Loaded workers:', workersData.length, 'workers');
      workers = workersData;
      renderWorkerTiles();
    } else {
      logError('Failed to load workers:', workersData);
      showLoadingMessage('Failed to load team members');
    }
  } catch (error) {
    logError('Error loading workers:', error);
    showLoadingMessage('Error loading team members');
    throw error; // Re-throw so caller knows about the error
  }
}

function renderWorkerTiles() {
  log('renderWorkerTiles called with', workers.length, 'workers:', workers);
  
  const container = document.getElementById('teamMembersGrid');
  if (!container) {
    logError('Team members grid container not found');
    return;
  }
  
  const loadingElement = document.querySelector('.team-members-loading');
  if (loadingElement) {
    loadingElement.style.display = 'none';
  }
  
  if (workers.length === 0) {
    log('No workers to display, showing empty state');
    container.innerHTML = `
      <div class="empty-state">
        <p>No team members found</p>
        <p style="font-size: 14px; color: #6B7280; margin-top: 8px;">Click the "+ Add Worker" button above to get started.</p>
      </div>
    `;
    return;
  }
  
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
  ];
  
  const tilesHtml = workers.map((worker, index) => {
    const color = colors[index % colors.length];
    const initials = worker.initials || worker.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    
    return `
      <div class="team-member-tile" data-worker-id="${worker.id}" style="background-color: ${color};">
        <button class="tile-delete-btn" onclick="deleteWorkerFromTile('${worker.id}'); event.stopPropagation();" title="Delete ${escapeHtml(worker.name)}">
          ×
        </button>
        <div class="tile-content" onclick="openWorkerDetailModal('${worker.id}')">
          <div class="member-avatar">${initials}</div>
          <div class="member-info">
            <div class="member-name">${escapeHtml(worker.name)}</div>
            <div class="member-role">${escapeHtml(worker.role)}</div>
            <div class="member-hours">${worker.total_hours_worked || 0}h logged</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = tilesHtml;
}

function showLoadingMessage(message) {
  const loadingElement = document.querySelector('.team-members-loading');
  if (loadingElement) {
    loadingElement.textContent = message;
    loadingElement.style.display = 'block';
  }
}

// Check if worker information is complete
function isWorkerInfoComplete(worker) {
  if (!worker) return false;
  
  // Required fields for complete worker info
  const hasName = worker.name && worker.name.trim() !== '';
  const hasRole = worker.role && worker.role.trim() !== '';
  const hasEmail = worker.email && worker.email.trim() !== '';
  const hasPhone = worker.phone && worker.phone.trim() !== '';
  
  return hasName && hasRole && hasEmail && hasPhone;
}

// Update Hours tab visual state based on worker info completion
function updateHoursTabAccessibility(isComplete) {
  const hoursTab = document.querySelector('.worker-detail-tab[data-tab="hours"]');
  if (hoursTab) {
    if (isComplete) {
      hoursTab.classList.remove('disabled');
      hoursTab.title = 'View and manage work hours';
    } else {
      hoursTab.classList.add('disabled');
      hoursTab.title = 'Complete worker information first to access hours';
    }
  }
}

function openWorkerDetailModal(workerId) {
  const worker = workers.find(w => w.id === workerId);
  if (!worker) {
    logError('Worker not found:', workerId);
    return;
  }
  
  // Set current worker
  window.currentWorker = worker;
  
  // Update avatar with correct initials
  const avatarEl = document.getElementById('workerAvatar');
  if (avatarEl) {
    const initials = worker.initials || worker.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    avatarEl.textContent = initials;
  }
  
  // Populate worker info
  document.getElementById('workerDisplayName').textContent = worker.name;
  document.getElementById('workerDisplayRole').textContent = worker.role;
  document.getElementById('workerDisplayEmail').textContent = worker.email || 'Not provided';
  document.getElementById('workerDisplayPhone').textContent = worker.phone || 'Not provided';
  document.getElementById('workerTotalHours').textContent = `${worker.total_hours_worked || 0}`;
  
  // Show modal and determine default tab based on completion status
  const modal = document.getElementById('workerDetailModal');
  modal.classList.add('active');
  
  // Check if worker info is complete
  const isComplete = isWorkerInfoComplete(worker);
  
  // Determine default tab:
  // - If worker info incomplete: always show Info tab
  // - If worker info complete: show Hours tab
  const defaultTab = isComplete ? 'hours' : 'info';
  
  // Set default tab
  showWorkerTab(defaultTab);
  
  // Update Hours tab accessibility based on completion status
  updateHoursTabAccessibility(isComplete);
  
  // Setup tab click handlers with validation
  document.querySelectorAll('.worker-detail-tab').forEach(tab => {
    tab.onclick = () => {
      const tabName = tab.dataset.tab;
      
      // Check if trying to access Hours tab with incomplete info
      if (tabName === 'hours' && !isWorkerInfoComplete(window.currentWorker)) {
        alert('⚠️ Complete Worker Information Required\n\nPlease fill out all worker details (Name, Role, Email, Phone) before accessing the Hours tab.');
        return;
      }
      
      showWorkerTab(tabName);
    };
  });
  
  // Setup close button
  const closeBtn = modal.querySelector('.close-btn');
  if (closeBtn) {
    closeBtn.onclick = () => modal.classList.remove('active');
  }
  
  // Setup Add Hours button event listener
  setTimeout(() => {
    const addHoursBtn = document.getElementById('addHoursBtn');
    if (addHoursBtn) {
      // Remove any existing event listeners
      addHoursBtn.onclick = null;
      
      // Add click event listener
      addHoursBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        openHoursWizard();
      });
      
      // Also set onclick as backup
      addHoursBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        openHoursWizard();
      };
    }
  }, 100); // Small delay to ensure DOM is ready
}

function showWorkerTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.worker-detail-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  
  // Update content - hide all tabs first
  document.querySelectorAll('.worker-detail-tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  // Show the selected tab content
  const tabMap = {
    'info': 'workerInfoTab',
    'hours': 'workerHoursTab',
    'tasks': 'workerTasksTab',
    'notes': 'workerNotesTab'
  };
  
  const targetTabId = tabMap[tabName];
  if (targetTabId) {
    const targetTab = document.getElementById(targetTabId);
    if (targetTab) {
      targetTab.classList.add('active');
    }
  }
  
  // Load specific content if needed
  if (tabName === 'hours' && window.currentWorker) {
    loadWorkerTimesheet(window.currentWorker.id);
    loadWorkerHours(window.currentWorker.id); // Load individual hours entries
  } else if (tabName === 'tasks' && window.currentWorker) {
    loadWorkerTasks(window.currentWorker.id);
  } else if (tabName === 'notes' && window.currentWorker) {
    loadWorkerNotes(window.currentWorker.id);
  }
}

async function loadWorkerTimesheet(workerId) {
  log('Loading timesheet for worker:', workerId);
  
  // Initialize timesheet with current week
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  
  window.currentWeekStart = startOfWeek;
  updateTimesheetWeekDisplay();
  
  // Setup week navigation
  setupTimesheetNavigation();
  
  // Setup timesheet calculation event listeners
  setupTimesheetCalculationListeners();
  
  // Load timesheet data
  await loadTimesheetData();
}

function updateTimesheetWeekDisplay() {
  const weekDisplayEl = document.getElementById('workerCurrentWeek');
  if (!weekDisplayEl) return;
  
  const endOfWeek = new Date(window.currentWeekStart);
  endOfWeek.setDate(window.currentWeekStart.getDate() + 6);
  
  const startStr = formatDate(window.currentWeekStart);
  const endStr = formatDate(endOfWeek);
  
  weekDisplayEl.textContent = `Week of ${startStr} - ${endStr}`;
}

function setupTimesheetNavigation() {
  const prevBtn = document.getElementById('workerPrevWeek');
  const nextBtn = document.getElementById('workerNextWeek');
  const thisWeekBtn = document.getElementById('workerThisWeek');
  
  if (prevBtn) {
    prevBtn.onclick = () => {
      window.currentWeekStart.setDate(window.currentWeekStart.getDate() - 7);
      updateTimesheetWeekDisplay();
      loadTimesheetData();
    };
  }
  
  if (nextBtn) {
    nextBtn.onclick = () => {
      window.currentWeekStart.setDate(window.currentWeekStart.getDate() + 7);
      updateTimesheetWeekDisplay();
      loadTimesheetData();
    };
  }
  
  if (thisWeekBtn) {
    thisWeekBtn.onclick = () => {
      const today = new Date();
      window.currentWeekStart = new Date(today);
      window.currentWeekStart.setDate(today.getDate() - today.getDay());
      updateTimesheetWeekDisplay();
      loadTimesheetData();
    };
  }
  
  // Save hours button
  const saveBtn = document.getElementById('saveWorkerHoursBtn');
  if (saveBtn) {
    saveBtn.onclick = saveWorkerTimesheet;
  }
  
  // Load hours button
  const loadBtn = document.getElementById('loadWorkerHoursBtn');
  if (loadBtn) {
    loadBtn.onclick = loadTimesheetData;
  }
}

async function loadTimesheetData() {
  if (!window.currentWorker || !window.currentWeekStart) return;
  
  const loadingEl = document.getElementById('workerHoursLoading');
  const messageEl = document.getElementById('workerHoursMessage');
  
  if (loadingEl) loadingEl.style.display = 'block';
  if (messageEl) messageEl.style.display = 'none';
  
  try {
    const weekStartStr = window.currentWeekStart.toISOString().split('T')[0];
    const response = await fetch(`/api/work-hours?worker_id=${window.currentWorker.id}&week_start=${weekStartStr}`);
    const hoursData = await response.json();
    
    if (response.ok) {
      populateTimesheetGrid(hoursData);
      showMessage('Timesheet loaded', 'success');
    } else {
      logError('Failed to load timesheet:', hoursData);
      showMessage('Failed to load timesheet', 'error');
    }
  } catch (error) {
    logError('Error loading timesheet:', error);
    showMessage('Error loading timesheet', 'error');
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

function populateTimesheetGrid(hoursData) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  // Clear all inputs first
  days.forEach(day => {
    const row = document.querySelector(`tr[data-day="${day}"]`);
    if (row) {
      row.querySelector('.start-time').value = '';
      row.querySelector('.end-time').value = '';
      row.querySelector('.hours-input').value = '';
      row.querySelector('.lunch-input').value = '';
      row.querySelector('.location-input').value = '';
      row.querySelector('.work-type-select').value = '';
      row.querySelector('.notes-input').value = '';
    }
  });
  
  // Populate with data
  hoursData.forEach(entry => {
    const workDate = parseLocalDate(entry.work_date);
    const dayIndex = workDate.getDay();
    const dayName = days[dayIndex];
    
    const row = document.querySelector(`tr[data-day="${dayName}"]`);
    if (row) {
      row.querySelector('.start-time').value = entry.start_time || '';
      row.querySelector('.end-time').value = entry.end_time || '';
      row.querySelector('.hours-input').value = entry.hours_worked || '';
      row.querySelector('.lunch-input').value = entry.break_minutes || '';
      row.querySelector('.location-input').value = entry.job_location || '';
      row.querySelector('.work-type-select').value = entry.work_type || '';
      row.querySelector('.notes-input').value = entry.description || '';
    }
  });
  
  // Trigger calculations for all days with data to ensure consistency
  days.forEach(day => {
    const row = document.querySelector(`tr[data-day="${day}"]`);
    if (row && row.querySelector('.start-time').value && row.querySelector('.end-time').value) {
      calculateDayHours(day);
    }
  });
  
  // Recalculate totals
  calculateWeeklyTotals();
}

function calculateWeeklyTotals() {
  let totalHours = 0;
  let totalLunch = 0;
  
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  days.forEach(day => {
    const row = document.querySelector(`tr[data-day="${day}"]`);
    if (row) {
      const hoursInput = row.querySelector('.hours-input');
      const lunchInput = row.querySelector('.lunch-input');
      
      const hours = parseFloat(hoursInput?.value) || 0;
      const lunch = parseInt(lunchInput?.value) || 0;
      
      totalHours += hours;
      totalLunch += lunch;
    }
  });
  
  const totalHoursEl = document.getElementById('workerTotalHoursWeek');
  const totalLunchEl = document.getElementById('workerTotalLunchWeek');
  
  if (totalHoursEl) totalHoursEl.textContent = totalHours.toFixed(2);
  if (totalLunchEl) totalLunchEl.textContent = totalLunch.toString();
}

async function saveWorkerTimesheet() {
  if (!window.currentWorker || !window.currentWeekStart) {
    showMessage('No worker or week selected', 'error');
    return;
  }
  
  const timesheetEntries = [];
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  days.forEach((day, index) => {
    const row = document.querySelector(`tr[data-day="${day}"]`);
    if (row) {
      const startTime = row.querySelector('.start-time').value;
      const endTime = row.querySelector('.end-time').value;
      const lunch = row.querySelector('.lunch-input').value;
      const location = row.querySelector('.location-input').value;
      const workType = row.querySelector('.work-type-select').value;
      const notes = row.querySelector('.notes-input').value;
      
      if (startTime && endTime && workType) {
        const workDate = new Date(window.currentWeekStart);
        workDate.setDate(window.currentWeekStart.getDate() + index);
        
        timesheetEntries.push({
          worker_id: window.currentWorker.id,
          work_date: workDate.toISOString().split('T')[0],
          start_time: startTime,
          end_time: endTime,
          break_minutes: parseInt(lunch) || 0,
          work_type: workType,
          description: `${location ? 'Location: ' + location + '. ' : ''}${notes || ''}`
        });
      }
    }
  });
  
  if (timesheetEntries.length === 0) {
    showMessage('Please fill in at least one complete day', 'warning');
    return;
  }
  
  let savedCount = 0;
  let hasError = false;
  
  try {
    // Save each entry using the existing work-hours API
    for (const entry of timesheetEntries) {
      try {
        const response = await fetch('/api/work-hours', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(entry)
        });
        
        if (response.ok) {
          savedCount++;
        } else {
          hasError = true;
          logError('Failed to save entry:', entry);
        }
      } catch (entryError) {
        hasError = true;
        logError('Error saving entry:', entryError, entry);
      }
    }
    
    if (savedCount > 0 && !hasError) {
      showMessage('Timesheet saved successfully', 'success');
    } else if (savedCount > 0) {
      showMessage(`Partially saved: ${savedCount} of ${timesheetEntries.length} entries`, 'warning');
    } else {
      showMessage('Failed to save timesheet', 'error');
    }
  } catch (error) {
    logError('Error saving timesheet:', error);
    showMessage('Error saving timesheet', 'error');
  }
}

function showMessage(message, type) {
  const messageEl = document.getElementById('workerHoursMessage');
  if (!messageEl) return;
  
  messageEl.textContent = message;
  messageEl.className = `message ${type}`;
  messageEl.style.display = 'block';
  
  // Hide after 3 seconds
  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 3000);
}

async function loadWorkerTasks(workerId) {
  log('Loading tasks for worker:', workerId);
  // TODO: Implement task loading
}

async function loadWorkerNotes(workerId) {
  log('Loading notes for worker:', workerId);
  // TODO: Implement notes loading
}

function deleteWorkerFromTile(workerId) {
  const worker = workers.find(w => w.id === workerId);
  if (!worker) {
    logError('Worker not found:', workerId);
    return;
  }
  
  deleteWorker(workerId);
}

// Function to round time to 5-minute intervals
function roundTimeToFiveMinutes(timeString) {
  if (!timeString) return timeString;
  
  const [hours, minutes] = timeString.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  const roundedMinutes = Math.round(totalMinutes / 5) * 5;
  
  const newHours = Math.floor(roundedMinutes / 60) % 24;
  const newMinutes = roundedMinutes % 60;
  
  return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
}

function setupTimesheetCalculationListeners() {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  days.forEach(day => {
    const row = document.querySelector(`tr[data-day="${day}"]`);
    if (row) {
      const startTimeInput = row.querySelector('.start-time');
      const endTimeInput = row.querySelector('.end-time');
      const lunchInput = row.querySelector('.lunch-input');
      const hoursInput = row.querySelector('.hours-input');
      
      if (startTimeInput && endTimeInput && hoursInput) {
        // Add event listeners for automatic calculation and 5-minute rounding
        startTimeInput.addEventListener('change', () => {
          startTimeInput.value = roundTimeToFiveMinutes(startTimeInput.value);
          calculateDayHours(day);
        });
        startTimeInput.addEventListener('blur', () => {
          startTimeInput.value = roundTimeToFiveMinutes(startTimeInput.value);
          calculateDayHours(day);
        });
        
        endTimeInput.addEventListener('change', () => {
          endTimeInput.value = roundTimeToFiveMinutes(endTimeInput.value);
          calculateDayHours(day);
        });
        endTimeInput.addEventListener('blur', () => {
          endTimeInput.value = roundTimeToFiveMinutes(endTimeInput.value);
          calculateDayHours(day);
        });
        
        if (lunchInput) {
          // Round lunch to 5-minute intervals (convert to minutes)
          lunchInput.addEventListener('change', () => {
            const lunchMinutes = parseInt(lunchInput.value) || 0;
            const roundedLunch = Math.round(lunchMinutes / 5) * 5;
            lunchInput.value = roundedLunch;
            calculateDayHours(day);
          });
          lunchInput.addEventListener('blur', () => {
            const lunchMinutes = parseInt(lunchInput.value) || 0;
            const roundedLunch = Math.round(lunchMinutes / 5) * 5;
            lunchInput.value = roundedLunch;
            calculateDayHours(day);
          });
        }
      }
    }
  });
}

function calculateDayHours(day) {
  const row = document.querySelector(`tr[data-day="${day}"]`);
  if (!row) return;
  
  const startTimeInput = row.querySelector('.start-time');
  const endTimeInput = row.querySelector('.end-time');
  const lunchInput = row.querySelector('.lunch-input');
  const hoursInput = row.querySelector('.hours-input');
  
  const startTime = startTimeInput.value;
  const endTime = endTimeInput.value;
  const lunchMinutes = parseInt(lunchInput.value) || 0;
  
  if (!startTime || !endTime) {
    hoursInput.value = '';
    calculateWeeklyTotals();
    return;
  }
  
  // Calculate hours
  const start = new Date(`2000-01-01T${startTime}:00`);
  const end = new Date(`2000-01-01T${endTime}:00`);
  
  // Handle edge cases
  let totalMinutes = (end - start) / (1000 * 60);
  
  // Handle end time before or equal to start time (invalid range)
  if (totalMinutes <= 0) {
    totalMinutes = 0; // Invalid time range results in 0 hours
  }
  
  // Subtract lunch break
  totalMinutes -= lunchMinutes;
  
  // Calculate hours (minimum 0)
  const hours = Math.max(0, totalMinutes / 60);
  
  // Round to 2 decimal places
  const roundedHours = Math.round(hours * 100) / 100;
  
  hoursInput.value = roundedHours.toFixed(2);
  
  // Recalculate weekly totals
  calculateWeeklyTotals();
}

// Edit worker from detail modal
function editWorkerFromDetail() {
  console.log('🔧 editWorkerFromDetail called, currentWorker:', window.currentWorker);
  alert('Edit button clicked! Current worker: ' + (window.currentWorker ? window.currentWorker.name : 'None'));
  
  if (window.currentWorker) {
    // Close the detail modal first
    document.getElementById('workerDetailModal').classList.remove('active');
    
    // Open the edit modal
    showWorkerModal(window.currentWorker);
  } else {
    console.error('No current worker selected for editing');
    alert('No worker selected for editing');
  }
}

// Delete worker from detail modal
function deleteWorkerFromDetail() {
  console.log('🗑️ deleteWorkerFromDetail called, currentWorker:', window.currentWorker);
  alert('Delete button clicked! Current worker: ' + (window.currentWorker ? window.currentWorker.name : 'None'));
  
  if (!window.currentWorker) {
    alert('No worker selected for deletion');
    return;
  }
  
  const workerName = window.currentWorker.name;
  const confirmDelete = confirm(`⚠️ Delete Worker\n\nAre you sure you want to delete "${workerName}"?\n\nThis action cannot be undone and will remove all associated work hours and data.`);
  
  if (confirmDelete) {
    // Close the detail modal first
    document.getElementById('workerDetailModal').classList.remove('active');
    
    // Use the existing delete function
    deleteWorkerFromTile(window.currentWorker.id);
  }
}

// Make functions globally accessible
window.editWorker = editWorker;
window.deleteWorker = deleteWorker;
window.editHours = editHours;
window.deleteHours = deleteHours;
window.showRestoreConfirmation = showRestoreConfirmation;
window.executeRestore = executeRestore;
window.openWorkerDetailModal = openWorkerDetailModal;
window.showWorkerTab = showWorkerTab;
window.deleteWorkerFromTile = deleteWorkerFromTile;
window.editWorkerFromDetail = editWorkerFromDetail;
window.deleteWorkerFromDetail = deleteWorkerFromDetail;

// Master Lists Management
let masterTasks = {};
let masterTools = {};
let masterMaterials = {};

// Track selected jobs for each list type
let selectedJobs = {
  tasks: new Set(),
  tools: new Set(),
  materials: new Set()
};

// Load Master Lists Data
async function loadMasterLists() {
  try {
    // Load master tasks
    const tasksResponse = await fetch('/api/tasks/all');
    if (tasksResponse.ok) {
      masterTasks = await tasksResponse.json();
      renderMasterTasks();
    }
    
    // Load master tools
    const toolsResponse = await fetch('/api/tools/all');
    if (toolsResponse.ok) {
      masterTools = await toolsResponse.json();
      renderMasterTools();
    }
    
    // Load master materials
    const materialsResponse = await fetch('/api/materials/all');
    if (materialsResponse.ok) {
      masterMaterials = await materialsResponse.json();
      renderMasterMaterials();
    }
  } catch (error) {
    logError('Error loading master lists:', error);
  }
}

// Render Master Tasks
function renderMasterTasks() {
  const container = document.getElementById('masterTasksList');
  if (!container) return;
  
  const taskGroups = Object.keys(masterTasks);
  
  if (taskGroups.length === 0) {
    container.innerHTML = '<div class="loading">No tasks found across all jobs.</div>';
    return;
  }
  
  const html = taskGroups.map(jobKey => {
    const jobData = masterTasks[jobKey];
    const tasks = jobData.tasks;
    
    if (tasks.length === 0) return '';
    
    const tasksHtml = tasks.map(task => `
      <div class="master-item master-task-item">
        <input 
          type="checkbox" 
          class="master-item-checkbox" 
          ${task.completed ? 'checked' : ''}
          onchange="toggleMasterTask('${task.id}', this.checked)"
        />
        <span class="master-item-description ${task.completed ? 'completed' : ''}">
          ${escapeHtml(task.description)}
        </span>
      </div>
    `).join('');
    
    const jobId = jobData.job_id; // Get job ID from jobData
    return `
      <div class="master-job-group" data-job-id="${jobId}">
        <div class="master-job-header">
          <input type="checkbox" 
                 class="job-select-checkbox" 
                 data-job-id="${jobId}"
                 data-list-type="tasks"
                 onchange="toggleJobSelection('tasks', '${jobId}', this.checked)">
          <h4 class="master-job-title">${escapeHtml(jobKey)}</h4>
        </div>
        <div class="master-items-list">
          ${tasksHtml}
        </div>
      </div>
    `;
  }).filter(html => html).join('');
  
  container.innerHTML = html || '<div class="loading">No tasks found.</div>';
}

// Render Master Tools
function renderMasterTools() {
  const container = document.getElementById('masterToolsList');
  if (!container) return;
  
  const toolGroups = Object.keys(masterTools);
  
  if (toolGroups.length === 0) {
    container.innerHTML = '<div class="loading">No tools found across all jobs.</div>';
    return;
  }
  
  const html = toolGroups.map(jobKey => {
    const jobData = masterTools[jobKey];
    const tools = jobData.tools;
    
    if (tools.length === 0) return '';
    
    const toolsHtml = tools.map(tool => `
      <div class="master-item master-tool-item">
        <input 
          type="checkbox" 
          class="master-item-checkbox" 
          ${tool.completed ? 'checked' : ''}
          onchange="toggleMasterTool('${tool.id}', this.checked)"
        />
        <span class="master-item-description ${tool.completed ? 'completed' : ''}">
          ${escapeHtml(tool.description)}
        </span>
      </div>
    `).join('');
    
    const jobId = jobData.job_id; // Get job ID from jobData
    return `
      <div class="master-job-group" data-job-id="${jobId}">
        <div class="master-job-header">
          <input type="checkbox" 
                 class="job-select-checkbox" 
                 data-job-id="${jobId}"
                 data-list-type="tools"
                 onchange="toggleJobSelection('tools', '${jobId}', this.checked)">
          <h4 class="master-job-title">${escapeHtml(jobKey)}</h4>
        </div>
        <div class="master-items-list">
          ${toolsHtml}
        </div>
      </div>
    `;
  }).filter(html => html).join('');
  
  container.innerHTML = html || '<div class="loading">No tools found.</div>';
}

// Toggle Master Task Completion
async function toggleMasterTask(taskId, completed) {
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ completed })
    });
    
    if (response.ok) {
      // Update the local data
      Object.keys(masterTasks).forEach(jobKey => {
        const task = masterTasks[jobKey].tasks.find(t => t.id === taskId);
        if (task) {
          task.completed = completed;
        }
      });
      
      // Re-render to update visual state
      renderMasterTasks();
    } else {
      logError('Failed to update task');
      // Reload to get correct state
      loadMasterLists();
    }
  } catch (error) {
    logError('Error updating task:', error);
    loadMasterLists();
  }
}

// Toggle Master Tool Completion
async function toggleMasterTool(toolId, completed) {
  try {
    const response = await fetch(`/api/tools/${toolId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ completed })
    });
    
    if (response.ok) {
      // Update the local data
      Object.keys(masterTools).forEach(jobKey => {
        const tool = masterTools[jobKey].tools.find(t => t.id === toolId);
        if (tool) {
          tool.completed = completed;
        }
      });
      
      // Re-render to update visual state
      renderMasterTools();
    } else {
      logError('Failed to update tool');
      // Reload to get correct state
      loadMasterLists();
    }
  } catch (error) {
    logError('Error updating tool:', error);
    loadMasterLists();
  }
}

// Render Master Materials
function renderMasterMaterials() {
  const container = document.getElementById('masterMaterialsList');
  if (!container) return;
  
  const materialGroups = Object.keys(masterMaterials);
  
  if (materialGroups.length === 0) {
    container.innerHTML = '<div class="loading">No materials found across all jobs.</div>';
    return;
  }
  
  const html = materialGroups.map(jobKey => {
    const jobData = masterMaterials[jobKey];
    const materials = jobData.materials;
    
    if (materials.length === 0) return '';
    
    const materialsHtml = materials.map(material => `
      <div class="master-item master-material-item">
        <input 
          type="checkbox" 
          class="master-item-checkbox" 
          ${material.completed ? 'checked' : ''}
          onchange="toggleMasterMaterial('${material.id}', this.checked)"
        />
        <span class="master-item-description ${material.completed ? 'completed' : ''}">
          ${escapeHtml(material.description)}
        </span>
      </div>
    `).join('');
    
    const jobId = jobData.job_id; // Get job ID from jobData
    return `
      <div class="master-job-group" data-job-id="${jobId}">
        <div class="master-job-header">
          <input type="checkbox" 
                 class="job-select-checkbox" 
                 data-job-id="${jobId}"
                 data-list-type="materials"
                 onchange="toggleJobSelection('materials', '${jobId}', this.checked)">
          <h4 class="master-job-title">${escapeHtml(jobKey)}</h4>
        </div>
        <div class="master-items-list">
          ${materialsHtml}
        </div>
      </div>
    `;
  }).filter(html => html).join('');
  
  container.innerHTML = html || '<div class="loading">No materials found.</div>';
}

// Toggle Master Material Completion
async function toggleMasterMaterial(materialId, completed) {
  try {
    const response = await fetch(`/api/materials/${materialId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ completed })
    });
    
    if (response.ok) {
      // Update the local data
      Object.keys(masterMaterials).forEach(jobKey => {
        const material = masterMaterials[jobKey].materials.find(m => m.id === materialId);
        if (material) {
          material.completed = completed;
        }
      });
      
      // Re-render to update visual state
      renderMasterMaterials();
    } else {
      logError('Failed to update material');
      // Reload to get correct state
      loadMasterLists();
    }
  } catch (error) {
    logError('Error updating material:', error);
    loadMasterLists();
  }
}

// Toggle visibility of master list sections
function toggleMasterList(listType, show) {
  const sectionId = `master${listType.charAt(0).toUpperCase() + listType.slice(1)}Section`;
  const section = document.getElementById(sectionId);
  
  if (section) {
    section.style.display = show ? 'block' : 'none';
    
    // Save preference to localStorage
    localStorage.setItem(`showMaster${listType.charAt(0).toUpperCase() + listType.slice(1)}`, show);
  }
}

// Load saved preferences for master list visibility
function loadMasterListPreferences() {
  // Load saved preferences or default to all shown
  const showTasks = localStorage.getItem('showMasterTasks') !== 'false';
  const showTools = localStorage.getItem('showMasterTools') !== 'false';
  const showMaterials = localStorage.getItem('showMasterMaterials') !== 'false';
  
  // Set checkbox states
  const tasksCheckbox = document.getElementById('toggleTasks');
  const toolsCheckbox = document.getElementById('toggleTools');
  const materialsCheckbox = document.getElementById('toggleMaterials');
  
  if (tasksCheckbox) tasksCheckbox.checked = showTasks;
  if (toolsCheckbox) toolsCheckbox.checked = showTools;
  if (materialsCheckbox) materialsCheckbox.checked = showMaterials;
  
  // Apply visibility
  toggleMasterList('tasks', showTasks);
  toggleMasterList('tools', showTools);
  toggleMasterList('materials', showMaterials);
}

// Toggle job selection
function toggleJobSelection(listType, jobId, selected) {
  if (selected) {
    selectedJobs[listType].add(jobId);
  } else {
    selectedJobs[listType].delete(jobId);
  }
  
  // Update visual feedback
  const jobGroup = document.querySelector(`#master${listType.charAt(0).toUpperCase() + listType.slice(1)}Section [data-job-id="${jobId}"]`);
  if (jobGroup) {
    if (selected) {
      jobGroup.classList.add('selected');
    } else {
      jobGroup.classList.remove('selected');
    }
  }
}

// Select all or none jobs for a list type
function selectAllJobs(listType, select) {
  const section = document.getElementById(`master${listType.charAt(0).toUpperCase() + listType.slice(1)}Section`);
  if (!section) return;
  
  const checkboxes = section.querySelectorAll('.job-select-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = select;
    const jobId = checkbox.dataset.jobId;
    if (jobId) {
      toggleJobSelection(listType, jobId, select);
    }
  });
}

// Clear selected tasks
async function clearSelectedTasks() {
  const selectedJobIds = Array.from(selectedJobs.tasks);
  
  if (selectedJobIds.length === 0) {
    alert('Please select at least one job to clear tasks from.');
    return;
  }
  
  // Count total tasks in selected jobs
  let totalTasks = 0;
  selectedJobIds.forEach(jobId => {
    const jobData = Object.values(masterTasks).find(job => job.job_id === jobId);
    if (jobData) {
      totalTasks += jobData.tasks.length;
    }
  });
  
  if (!confirm(`Are you sure you want to clear ${totalTasks} task(s) from ${selectedJobIds.length} selected job(s)?\n\nThis cannot be undone.`)) {
    return;
  }
  
  try {
    // Clear tasks for each selected job
    for (const jobId of selectedJobIds) {
      const response = await fetch(`/api/jobs/${jobId}/tasks/clear`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        logError(`Failed to clear tasks for job ${jobId}`);
      }
    }
    
    // Reload and reset selection
    selectedJobs.tasks.clear();
    await loadMasterLists();
  } catch (error) {
    logError('Error clearing selected tasks:', error);
  }
}

// Clear selected tools
async function clearSelectedTools() {
  const selectedJobIds = Array.from(selectedJobs.tools);
  
  if (selectedJobIds.length === 0) {
    alert('Please select at least one job to clear tools from.');
    return;
  }
  
  // Count total tools in selected jobs
  let totalTools = 0;
  selectedJobIds.forEach(jobId => {
    const jobData = Object.values(masterTools).find(job => job.job_id === jobId);
    if (jobData) {
      totalTools += jobData.tools.length;
    }
  });
  
  if (!confirm(`Are you sure you want to clear ${totalTools} tool(s) from ${selectedJobIds.length} selected job(s)?\n\nThis cannot be undone.`)) {
    return;
  }
  
  try {
    // Clear tools for each selected job
    for (const jobId of selectedJobIds) {
      const response = await fetch(`/api/jobs/${jobId}/tools/clear`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        logError(`Failed to clear tools for job ${jobId}`);
      }
    }
    
    // Reload and reset selection
    selectedJobs.tools.clear();
    await loadMasterLists();
  } catch (error) {
    logError('Error clearing selected tools:', error);
  }
}

// Clear selected materials
async function clearSelectedMaterials() {
  const selectedJobIds = Array.from(selectedJobs.materials);
  
  if (selectedJobIds.length === 0) {
    alert('Please select at least one job to clear materials from.');
    return;
  }
  
  // Count total materials in selected jobs
  let totalMaterials = 0;
  selectedJobIds.forEach(jobId => {
    const jobData = Object.values(masterMaterials).find(job => job.job_id === jobId);
    if (jobData) {
      totalMaterials += jobData.materials.length;
    }
  });
  
  if (!confirm(`Are you sure you want to clear ${totalMaterials} material(s) from ${selectedJobIds.length} selected job(s)?\n\nThis cannot be undone.`)) {
    return;
  }
  
  try {
    // Clear materials for each selected job
    for (const jobId of selectedJobIds) {
      const response = await fetch(`/api/jobs/${jobId}/materials/clear`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        logError(`Failed to clear materials for job ${jobId}`);
      }
    }
    
    // Reload and reset selection
    selectedJobs.materials.clear();
    await loadMasterLists();
  } catch (error) {
    logError('Error clearing selected materials:', error);
  }
}

// Clear all master tasks across all jobs
async function clearAllMasterTasks() {
  const taskCount = Object.values(masterTasks).reduce((total, job) => total + job.tasks.length, 0);
  
  if (!confirm(`Are you sure you want to clear ALL tasks across ALL jobs?\n\nThis will delete ${taskCount} task(s) from the entire system and cannot be undone.`)) {
    return;
  }
  
  try {
    const response = await fetch('/api/tasks/clear-all', {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (response.ok) {
      log(`Cleared ${result.count} tasks from all jobs`);
      await loadMasterLists();
    } else {
      logError('Failed to clear all tasks:', result.error);
    }
  } catch (error) {
    logError('Error clearing all tasks:', error);
  }
}

// Clear all master tools across all jobs
async function clearAllMasterTools() {
  const toolCount = Object.values(masterTools).reduce((total, job) => total + job.tools.length, 0);
  
  if (!confirm(`Are you sure you want to clear ALL tools across ALL jobs?\n\nThis will delete ${toolCount} tool(s) from the entire system and cannot be undone.`)) {
    return;
  }
  
  try {
    const response = await fetch('/api/tools/clear-all', {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (response.ok) {
      log(`Cleared ${result.count} tools from all jobs`);
      await loadMasterLists();
    } else {
      logError('Failed to clear all tools:', result.error);
    }
  } catch (error) {
    logError('Error clearing all tools:', error);
  }
}

// Clear all master materials across all jobs
async function clearAllMasterMaterials() {
  const materialCount = Object.values(masterMaterials).reduce((total, job) => total + job.materials.length, 0);
  
  if (!confirm(`Are you sure you want to clear ALL materials across ALL jobs?\n\nThis will delete ${materialCount} material(s) from the entire system and cannot be undone.`)) {
    return;
  }
  
  try {
    const response = await fetch('/api/materials/clear-all', {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (response.ok) {
      log(`Cleared ${result.count} materials from all jobs`);
      await loadMasterLists();
    } else {
      logError('Failed to clear all materials:', result.error);
    }
  } catch (error) {
    logError('Error clearing all materials:', error);
  }
}

// Text Send functionality
let textSendContacts = [];
let currentContactFilter = 'all';

// Define shareCustomerInfo function early so it's available
async function shareCustomerInfo(customerId) {
  console.log('=== SHARE INFO CLICKED ===');
  console.log('shareCustomerInfo called with customerId:', customerId);
  console.log('textSendContacts length:', textSendContacts.length);
  console.log('textSendContacts:', textSendContacts);
  
  if (textSendContacts.length === 0) {
    showMessage('No contacts available. Please add contacts in Settings > Text Send first.', 'error');
    return;
  }

  const contactOptions = textSendContacts.map(contact => {
    const safeId = escapeHtml(contact.id || '');
    const safeName = escapeHtml(contact.name || '');
    const safePhone = escapeHtml(contact.phone || '');
    const safeType = escapeHtml(contact.contact_type || '');
    const phoneAndType = safePhone
      ? `${safePhone}${safeType ? ' &bull; ' + safeType : ''}`
      : (safeType || 'Not provided');
    return `
            <label style="display: flex; align-items: center; padding: 8px; border: 1px solid #E5E7EB; border-radius: 4px; margin-bottom: 8px; cursor: pointer;">
              <input type="checkbox" value="${safeId}" style="margin-right: 10px;">
              <div>
                <div style="font-weight: 500;">${safeName}</div>
                <div style="font-size: 12px; color: #6B7280;">${phoneAndType}</div>
              </div>
            </label>`;
  }).join('');

  const customNoteOptions = customNotes.map(note => {
    const safeNote = escapeHtml(note);
    return `<option value="${safeNote}">${safeNote}</option>`;
  }).join('');

  // Show contact selection modal
  console.log('Creating modal...');
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'block';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header">
        <h3>Share Customer Info</h3>
        <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
      </div>
      <div style="padding: 20px;">
        <p>Select contacts to send customer information to:</p>
        <div id="contactCheckboxes" style="max-height: 200px; overflow-y: auto; margin: 15px 0;">
          ${contactOptions}
        </div>
        
        <div style="margin: 20px 0;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500;">Custom Note (Optional):</label>
          <select id="customNote" style="width: 100%; padding: 8px; border: 1px solid #D1D5DB; border-radius: 4px; font-size: 14px;">
            <option value="">Select a note...</option>
            ${customNoteOptions}
          </select>
        </div>
        
        <div style="display: flex; gap: 10px; justify-content: space-between; margin-top: 20px;">
          <button onclick="this.closest('.modal').remove()" style="padding: 8px 16px; border: 1px solid #D1D5DB; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button onclick="smartSend('${customerId}')" style="padding: 8px 16px; background: #8B5CF6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Send Info</button>
        </div>
      </div>
    </div>
  `;
  
  console.log('Appending modal to body...');
  document.body.appendChild(modal);
  console.log('Modal appended. Modal element:', modal);
  console.log('Modal display style:', modal.style.display);
  console.log('Modal visible:', modal.offsetParent !== null);
}

// Smart Send - Mobile-only feature that does all 4 actions in sequence
async function smartSend(customerId) {
  console.log('=== SMART SEND ===');
  
  // Check if we're on mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (!isMobile) {
    alert('Send Info is only available on mobile devices.');
    return;
  }
  
  const customer = customers.find(c => c.id === customerId);
  if (!customer) {
    console.error('Customer not found:', customerId);
    return;
  }
  
  const customNote = document.getElementById('customNote')?.value || '';
  const message = `${customer.name}
${customer.phone || 'Not provided'}
${customer.address || 'Not provided'}${customNote ? '\n\n' + customNote : ''}`;
  
  try {
    // Action 1: Copy selected contact's phone number to clipboard
    // Get the selected contact from checkboxes
    const selectedCheckbox = document.querySelector('#contactCheckboxes input[type="checkbox"]:checked');
    if (!selectedCheckbox) {
      alert('Please select a contact first by checking the checkbox next to their name.');
      return;
    }
    
    const selectedContactId = selectedCheckbox.value;
    const selectedContact = textSendContacts.find(c => c.id === selectedContactId);
    if (!selectedContact) {
      alert('Selected contact not found. Please try again.');
      return;
    }
    
    console.log('Action 1: Copying selected contact name to clipboard...');
    await navigator.clipboard.writeText(selectedContact.name);
    console.log('✅ Selected contact name copied to clipboard:', selectedContact.name);
    
    // Action 1: Open Messages app (with pre-filled message)
    console.log('Action 1: Opening Messages app...');
    const smsLink = `sms:&body=${encodeURIComponent(message)}`;
    window.location.href = smsLink;
    
    
  } catch (err) {
    console.error('Send Info failed:', err);
    alert('Send Info failed. Please try again.');
  }
}

// Custom Notes Management
let customNotes = [
  'Kitchen countertop measure',
  'LVP flooring installation', 
  'Bathroom renovation',
  'Electrical work',
  'Plumbing repair',
  'Painting job',
  'General maintenance'
];

function addCustomNote() {
  const input = document.getElementById('newCustomNote');
  const note = input.value.trim();
  
  if (note && !customNotes.includes(note)) {
    customNotes.push(note);
    input.value = '';
    updateCustomNotesList();
    updateCustomNotesDropdown();
  }
}

function removeCustomNote(note) {
  customNotes = customNotes.filter(n => n !== note);
  updateCustomNotesList();
  updateCustomNotesDropdown();
}

function updateCustomNotesList() {
  const container = document.getElementById('customNotesList');
  if (!container) {
    return;
  }

  container.textContent = '';

  customNotes.forEach(note => {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '5px';
    wrapper.style.padding = '4px 8px';
    wrapper.style.background = 'white';
    wrapper.style.border = '1px solid #D1D5DB';
    wrapper.style.borderRadius = '4px';
    wrapper.style.fontSize = '12px';

    const label = document.createElement('span');
    label.textContent = note;

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '×';
    button.style.background = 'none';
    button.style.border = 'none';
    button.style.color = '#EF4444';
    button.style.cursor = 'pointer';
    button.style.fontSize = '14px';
    button.addEventListener('click', () => removeCustomNote(note));

    wrapper.appendChild(label);
    wrapper.appendChild(button);
    container.appendChild(wrapper);
  });
}

function updateCustomNotesDropdown() {
  // Update the dropdown in the Share Info modal
  const dropdown = document.getElementById('customNote');
  if (dropdown) {
    const currentValue = dropdown.value;
    const optionsHtml = customNotes.map(note => {
      const safeNote = escapeHtml(note);
      return `<option value="${safeNote}">${safeNote}</option>`;
    }).join('');
    dropdown.innerHTML = '<option value="">Select a note...</option>' + optionsHtml;
    dropdown.value = currentValue;
  }
}

// Make it globally accessible immediately
window.shareCustomerInfo = shareCustomerInfo;
window.sendCustomerInfo = sendCustomerInfo;
window.addCustomNote = addCustomNote;
window.removeCustomNote = removeCustomNote;
// window.openMessagesApp = openMessagesApp; // Function not defined, commented out
window.smartSend = smartSend;

// Test function accessibility
console.log('shareCustomerInfo function available:', typeof window.shareCustomerInfo);
console.log('Testing shareCustomerInfo with test ID...');


async function loadTextSendContacts() {
  try {
    const response = await fetch('/api/contacts');
    if (response.ok) {
      textSendContacts = await response.json();
      renderContactsTable();
      populateTestCustomerSelect();
    } else {
      console.error('Failed to load contacts');
    }
  } catch (error) {
    console.error('Error loading contacts:', error);
  }
}

function renderContactsTable() {
  const tbody = document.getElementById('contactsTableBody');
  if (!tbody) return;

  const filteredContacts = currentContactFilter === 'all' 
    ? textSendContacts 
    : textSendContacts.filter(contact => contact.contact_type === currentContactFilter);

  if (filteredContacts.length === 0) {
    tbody.innerHTML = '<tr class="loading-row"><td colspan="5">No contacts found</td></tr>';
    return;
  }

  tbody.innerHTML = filteredContacts.map(contact => {
    const safeId = escapeHtml(contact.id || '');
    const safeName = escapeHtml(contact.name || '');
    const safePhone = escapeHtml(contact.phone || '');
    const safeAddress = escapeHtml(contact.address || 'Not provided');
    const safeTypeText = escapeHtml(contact.contact_type || '');
    const typeClass = ['SUB', 'WORKER', 'OTHER'].includes(contact.contact_type) ? contact.contact_type : 'OTHER';
    return `
    <tr>
      <td>${safeName}</td>
      <td>${safePhone}</td>
      <td>${safeAddress}</td>
      <td><span class="contact-type-badge ${typeClass}">${safeTypeText}</span></td>
      <td>
        <div class="contact-actions">
          <button class="edit-contact-btn" onclick="editContact('${safeId}')">Edit</button>
          <button class="delete-contact-btn" onclick="deleteContact('${safeId}')">Delete</button>
        </div>
      </td>
    </tr>
  `;
  }).join('');
}

function filterContacts(type) {
  currentContactFilter = type;
  
  // Update active tab
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelector(`[data-type="${type}"]`).classList.add('active');
  
  renderContactsTable();
}

async function showContactModal(contact = null) {
  const modal = document.getElementById('contactModal');
  const title = document.getElementById('contactModalTitle');
  const form = document.getElementById('contactForm');
  
  if (contact) {
    title.textContent = 'Edit Contact';
    document.getElementById('contactName').value = contact.name;
    document.getElementById('contactPhone').value = contact.phone;
    document.getElementById('contactAddress').value = contact.address || '';
    document.querySelector(`input[name="contactType"][value="${contact.contact_type}"]`).checked = true;
    document.getElementById('contactNotes').value = contact.notes || '';
    form.dataset.contactId = contact.id;
  } else {
    title.textContent = 'Add Contact';
    form.reset();
    delete form.dataset.contactId;
  }
  
  modal.style.display = 'block';
}

async function saveContact(formData) {
  console.log('saveContact called with formData:', Object.fromEntries(formData));
  
  const contactData = {
    name: formData.get('contactName'),
    phone: formData.get('contactPhone'),
    address: formData.get('contactAddress'),
    contact_type: formData.get('contactType'),
    notes: formData.get('contactNotes')
  };

  console.log('Contact data to save:', contactData);

  const contactId = formData.get('contactId');
  const url = contactId ? `/api/contacts/${contactId}` : '/api/contacts';
  const method = contactId ? 'PUT' : 'POST';

  console.log('Making request to:', url, 'with method:', method);

  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactData)
    });

    console.log('Response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('Save successful:', result);
      await loadTextSendContacts();
      closeModal('contactModal');
      showMessage('Contact saved successfully', 'success');
    } else {
      const error = await response.json();
      console.error('Save failed:', error);
      showMessage(error.error || 'Failed to save contact', 'error');
    }
  } catch (error) {
    console.error('Error saving contact:', error);
    showMessage('Error saving contact', 'error');
  }
}

async function deleteContact(contactId) {
  if (!confirm('Are you sure you want to delete this contact?')) return;

  try {
    const response = await fetch(`/api/contacts/${contactId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      await loadTextSendContacts();
      showMessage('Contact deleted successfully', 'success');
    } else {
      const error = await response.json();
      showMessage(error.error || 'Failed to delete contact', 'error');
    }
  } catch (error) {
    console.error('Error deleting contact:', error);
    showMessage('Error deleting contact', 'error');
  }
}

async function testTextSend() {
  const customerSelect = document.getElementById('testCustomerSelect');
  const customerId = customerSelect.value;
  
  if (!customerId) {
    showMessage('Please select a customer to test with', 'error');
    return;
  }

  if (textSendContacts.length === 0) {
    showMessage('No contacts available. Please add some contacts first.', 'error');
    return;
  }

  try {
    const response = await fetch('/api/text-send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer_id: customerId,
        contact_ids: textSendContacts.map(c => c.id)
      })
    });

    const result = await response.json();
    const resultDiv = document.getElementById('testMessageResult');
    
    if (response.ok) {
      resultDiv.innerHTML = `
        <div style="background: #ECFDF5; color: #065F46; padding: 10px; border-radius: 4px; border: 1px solid #A7F3D0;">
          <strong>✅ Test Message Sent Successfully!</strong><br>
          Customer: ${result.customer}<br>
          Recipients: ${result.recipients} contacts<br>
          <details style="margin-top: 10px;">
            <summary>Message Preview</summary>
            <pre style="background: white; padding: 8px; border-radius: 4px; margin-top: 5px; font-size: 12px;">${result.message_preview}</pre>
          </details>
        </div>
      `;
    } else {
      resultDiv.innerHTML = `
        <div style="background: #FEE2E2; color: #991B1B; padding: 10px; border-radius: 4px; border: 1px solid #FECACA;">
          <strong>❌ Error:</strong> ${result.error}
        </div>
      `;
    }
    
    resultDiv.style.display = 'block';
  } catch (error) {
    console.error('Error sending test message:', error);
    showMessage('Error sending test message', 'error');
  }
}

function populateTestCustomerSelect() {
  const select = document.getElementById('testCustomerSelect');
  if (!select) return;

  // Clear existing options except the first one
  select.innerHTML = '<option value="">Select a customer...</option>';
  
  // Add customer options
  customers.forEach(customer => {
    const option = document.createElement('option');
    option.value = customer.id;
    option.textContent = customer.name;
    select.appendChild(option);
  });
}

// Add Share Info button to customer cards
function addShareInfoButton(customer) {
  return `
    <div class="customer-actions" style="display: flex; gap: 8px; margin-top: 10px;">
      <button class="share-info-btn" onclick="shareCustomerInfo('${customer.id}')" 
              style="padding: 6px 12px; background: #10B981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
        📤 Share Info
      </button>
    </div>
  `;
}

async function sendCustomerInfo(customerId) {
  console.log('=== SEND CUSTOMER INFO CLICKED ===');
  console.log('Customer ID:', customerId);
  
  const checkboxes = document.querySelectorAll('#contactCheckboxes input[type="checkbox"]:checked');
  const contactIds = Array.from(checkboxes).map(cb => cb.value);
  
  console.log('Selected contact IDs:', contactIds);
  
  if (contactIds.length === 0) {
    showMessage('Please select at least one contact', 'error');
    return;
  }

  try {
    const response = await fetch('/api/text-send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer_id: customerId,
        contact_ids: contactIds
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Text send successful!', result);
      alert(`✅ Customer info sent to ${result.recipients} contact(s) successfully!`);
      showMessage(`Customer info sent to ${result.recipients} contact(s) successfully!`, 'success');
      document.querySelector('.modal').remove();
    } else {
      console.error('❌ Text send failed:', result);
      alert(`❌ Error: ${result.error || 'Failed to send customer info'}`);
      showMessage(result.error || 'Failed to send customer info', 'error');
    }
  } catch (error) {
    console.error('Error sending customer info:', error);
    showMessage('Error sending customer info', 'error');
  }
}

// Make functions globally accessible
window.loadTextSendContacts = loadTextSendContacts;
window.filterContacts = filterContacts;
window.showContactModal = showContactModal;
window.saveContact = saveContact;
window.deleteContact = deleteContact;
window.testTextSend = testTextSend;
window.shareCustomerInfo = shareCustomerInfo;
window.sendCustomerInfo = sendCustomerInfo;

// Test function accessibility
console.log('shareCustomerInfo function available:', typeof window.shareCustomerInfo);

// Make Master Lists functions globally accessible
window.loadMasterLists = loadMasterLists;
window.toggleMasterTask = toggleMasterTask;
window.toggleMasterTool = toggleMasterTool;
window.toggleMasterMaterial = toggleMasterMaterial;
window.toggleMasterList = toggleMasterList;
window.loadMasterListPreferences = loadMasterListPreferences;

// Profile module functions
function setupProfileTabs() {
  const tabs = document.querySelectorAll('.profile-tab');
  const contents = document.querySelectorAll('.profile-tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      showProfileTab(targetTab);
    });
  });
}

function showProfileTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  
  // Update tab content
  document.querySelectorAll('.profile-tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`${tabName}Tab`).classList.add('active');
  
  // Load specific tab data
  if (tabName === 'activity') {
    loadActivityData();
  }
}

async function loadProfileData() {
  try {
    log('📡 Fetching profile data...');
    const response = await fetch('/api/profile');
    const data = await response.json();
    
    if (data.success) {
      currentProfileData = data.user;
      updateProfileUI(data.user);
      log('✅ Profile data loaded');
    } else {
      throw new Error(data.error || 'Failed to load profile');
    }
  } catch (error) {
    console.error('Error loading profile:', error);
    showMessage('Failed to load profile data', 'error');
  }
}

function updateProfileUI(user) {
  // Update account tab
  document.getElementById('profileDisplayName').textContent = user.name;
  document.getElementById('profileDisplayRole').textContent = user.role;
  document.getElementById('profileName').textContent = user.name;
  document.getElementById('profileEmail').textContent = user.email;
  document.getElementById('profileRole').textContent = user.role;
  
  // Update avatar
  const avatar = document.getElementById('profileAvatar');
  avatar.textContent = user.name.charAt(0).toUpperCase();
  
  // Update member since
  const memberSince = new Date(user.created_at).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long' 
  });
  document.getElementById('profileMemberSince').textContent = memberSince;
  
  // Update preferences
  if (user.preferences) {
    const prefs = user.preferences;
    
    // Dashboard preferences
    document.getElementById('showRecentJobs').checked = prefs.dashboard?.show_recent_jobs || false;
    document.getElementById('showUpcomingEvents').checked = prefs.dashboard?.show_upcoming_events || false;
    document.getElementById('defaultCustomerView').value = prefs.dashboard?.default_customer_view || 'all';
    
    // Display preferences
    document.getElementById('themeSelect').value = prefs.theme || 'light';
    document.getElementById('dateFormat').value = prefs.date_format || 'MM/DD/YYYY';
    
    // Notification preferences
    document.getElementById('emailUpdates').checked = prefs.notifications?.email_updates || false;
    document.getElementById('jobReminders').checked = prefs.notifications?.job_reminders || false;
    document.getElementById('backupNotifications').checked = prefs.notifications?.backup_notifications || false;
    document.getElementById('systemAlerts').checked = prefs.notifications?.system_alerts || false;
    document.getElementById('securityAlerts').checked = prefs.notifications?.security_alerts || false;
  }
  
  // Update security info
  if (user.security) {
    const lastLogin = new Date(user.security.last_login).toLocaleDateString();
    document.getElementById('lastLogin').textContent = lastLogin;
    
    const passwordChanged = new Date(user.security.password_last_changed).toLocaleDateString();
    document.getElementById('passwordLastChanged').textContent = passwordChanged;
    
  }
  
  // Load account statistics
  loadAccountStats();
}

async function loadAccountStats() {
  try {
    // Load customers count
    const customersResponse = await fetch('/api/customers');
    if (customersResponse.ok) {
      const customersData = await customersResponse.json();
      document.getElementById('totalCustomers').textContent = customersData.customers?.length || 0;
    }
    
    // Load jobs count
    const jobsResponse = await fetch('/api/jobs');
    if (jobsResponse.ok) {
      const jobsData = await jobsResponse.json();
      document.getElementById('totalJobs').textContent = jobsData.jobs?.length || 0;
    }
    
    // Load workers count
    const workersResponse = await fetch('/api/workers');
    if (workersResponse.ok) {
      const workersData = await workersResponse.json();
      document.getElementById('totalWorkers').textContent = workersData.workers?.length || 0;
    }
  } catch (error) {
    console.error('Error loading account stats:', error);
  }
}

function editProfile() {
  if (!currentProfileData) {
    showMessage('Profile data not loaded', 'error');
    return;
  }
  
  // Populate edit form
  document.getElementById('editProfileName').value = currentProfileData.name;
  document.getElementById('editProfileEmail').value = currentProfileData.email;
  
  // Show modal
  document.getElementById('editProfileModal').classList.add('active');
}

function closeEditProfileModal() {
  document.getElementById('editProfileModal').classList.remove('active');
  // Reset form
  document.getElementById('editProfileForm').reset();
}

window.editProfile = editProfile;
window.closeEditProfileModal = closeEditProfileModal;

// Profile form handlers and additional functions
async function saveProfile(event) {
  event.preventDefault();
  
  const name = document.getElementById('editProfileName').value.trim();
  const email = document.getElementById('editProfileEmail').value.trim();
  
  if (!name || !email) {
    showMessage('Name and email are required', 'error');
    return;
  }
  
  try {
    log('📡 Updating profile...');
    const response = await fetch('/api/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name,
        email: email,
        preferences: currentProfileData?.preferences
      }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      currentProfileData = data.user;
      updateProfileUI(data.user);
      closeEditProfileModal();
      showMessage('Profile updated successfully', 'success');
      log('✅ Profile updated');
    } else {
      throw new Error(data.error || 'Failed to update profile');
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    showMessage('Failed to update profile', 'error');
  }
}

function showChangePasswordModal() {
  document.getElementById('changePasswordModal').classList.add('active');
}

function closeChangePasswordModal() {
  document.getElementById('changePasswordModal').classList.remove('active');
  document.getElementById('changePasswordForm').reset();
}

async function changePassword(event) {
  event.preventDefault();
  
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  if (!currentPassword || !newPassword || !confirmPassword) {
    showMessage('All password fields are required', 'error');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showMessage('New passwords do not match', 'error');
    return;
  }
  
  if (newPassword.length < 6) {
    showMessage('New password must be at least 6 characters long', 'error');
    return;
  }
  
  try {
    log('📡 Changing password...');
    const response = await fetch('/api/profile/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: currentPassword,
        newPassword: newPassword,
        confirmPassword: confirmPassword
      }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      closeChangePasswordModal();
      showMessage('Password changed successfully', 'success');
      log('✅ Password changed');
    } else {
      throw new Error(data.error || 'Failed to change password');
    }
  } catch (error) {
    console.error('Error changing password:', error);
    showMessage(error.message || 'Failed to change password', 'error');
  }
}

async function savePreferences() {
  const preferences = {
    theme: document.getElementById('themeSelect').value,
    date_format: document.getElementById('dateFormat').value,
    dashboard: {
      show_recent_jobs: document.getElementById('showRecentJobs').checked,
      show_upcoming_events: document.getElementById('showUpcomingEvents').checked,
      default_customer_view: document.getElementById('defaultCustomerView').value
    },
    notifications: {
      email_updates: document.getElementById('emailUpdates').checked,
      job_reminders: document.getElementById('jobReminders').checked,
      backup_notifications: document.getElementById('backupNotifications').checked,
      system_alerts: document.getElementById('systemAlerts').checked,
      security_alerts: document.getElementById('securityAlerts').checked
    }
  };
  
  try {
    log('📡 Saving preferences...');
    const response = await fetch('/api/profile/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ preferences }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      if (currentProfileData) {
        currentProfileData.preferences = preferences;
      }
      showMessage('Preferences saved successfully', 'success');
      log('✅ Preferences saved');
    } else {
      throw new Error(data.error || 'Failed to save preferences');
    }
  } catch (error) {
    console.error('Error saving preferences:', error);
    showMessage('Failed to save preferences', 'error');
  }
}

function resetPreferences() {
  if (confirm('Are you sure you want to reset all preferences to defaults?')) {
    // Reset to default values
    document.getElementById('themeSelect').value = 'light';
    document.getElementById('dateFormat').value = 'MM/DD/YYYY';
    document.getElementById('showRecentJobs').checked = true;
    document.getElementById('showUpcomingEvents').checked = true;
    document.getElementById('defaultCustomerView').value = 'all';
    document.getElementById('emailUpdates').checked = true;
    document.getElementById('jobReminders').checked = true;
    document.getElementById('backupNotifications').checked = true;
    document.getElementById('systemAlerts').checked = true;
    document.getElementById('securityAlerts').checked = true;
    
    showMessage('Preferences reset to defaults', 'info');
  }
}

async function saveNotificationPreferences() {
  await savePreferences(); // Use the same save function
}

window.showChangePasswordModal = showChangePasswordModal;
window.closeChangePasswordModal = closeChangePasswordModal;
window.savePreferences = savePreferences;
window.resetPreferences = resetPreferences;
window.saveNotificationPreferences = saveNotificationPreferences;
// Activity and remaining profile functions
async function loadActivityData() {
  try {
    log('📡 Loading activity data...');
    const response = await fetch('/api/profile/activity');
    const data = await response.json();
    
    if (data.success) {
      displayActivityData(data.activities);
      log('✅ Activity data loaded');
    } else {
      throw new Error(data.error || 'Failed to load activity');
    }
  } catch (error) {
    console.error('Error loading activity:', error);
    document.getElementById('activityList').innerHTML = 
      '<div class="activity-error">Failed to load activity data</div>';
  }
}

function displayActivityData(activities) {
  const activityList = document.getElementById('activityList');
  
  if (!activities || activities.length === 0) {
    activityList.innerHTML = '<div class="activity-empty">No recent activity</div>';
    return;
  }
  
  const activityHTML = activities.map(activity => {
    const date = new Date(activity.timestamp).toLocaleDateString();
    const time = new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const activityTypeClass = `activity-${activity.type}`;
    const activityIcon = getActivityIcon(activity.type);
    
    return `
      <div class="activity-item ${activityTypeClass}">
        <div class="activity-icon">${activityIcon}</div>
        <div class="activity-content">
          <div class="activity-description">${activity.description}</div>
          <div class="activity-timestamp">${date} at ${time}</div>
          ${activity.ip_address ? `<div class="activity-details">IP: ${activity.ip_address}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  activityList.innerHTML = activityHTML;
}

function getActivityIcon(type) {
  const icons = {
    login: '🔐',
    customer_created: '👥',
    customer_updated: '✏️',
    job_created: '🏗️',
    job_updated: '📝',
    backup_created: '💾',
    profile_updated: '⚙️',
    system: '🔧',
    security: '🛡️'
  };
  return icons[type] || '📋';
}

function filterActivity() {
  const filter = document.getElementById('activityFilter').value;
  const activityItems = document.querySelectorAll('.activity-item');
  
  activityItems.forEach(item => {
    if (filter === 'all') {
      item.style.display = 'flex';
    } else {
      const hasClass = item.classList.contains(`activity-${filter}`);
      item.style.display = hasClass ? 'flex' : 'none';
    }
  });
}


// Initialize profile form event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Edit profile form
  const editProfileForm = document.getElementById('editProfileForm');
  if (editProfileForm) {
    editProfileForm.addEventListener('submit', saveProfile);
  }
  
  // Change password form
  const changePasswordForm = document.getElementById('changePasswordForm');
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', changePassword);
  }
});

window.filterActivity = filterActivity;

// Make profile functions globally accessible
window.setupProfileTabs = setupProfileTabs;
window.showProfileTab = showProfileTab;
window.clearAllMasterTasks = clearAllMasterTasks;
window.clearAllMasterTools = clearAllMasterTools;
window.clearAllMasterMaterials = clearAllMasterMaterials;
window.toggleJobSelection = toggleJobSelection;
window.selectAllJobs = selectAllJobs;
window.clearSelectedTasks = clearSelectedTasks;
window.clearSelectedTools = clearSelectedTools;
window.clearSelectedMaterials = clearSelectedMaterials;

// Worker Login Credential Management
let currentWorkerForLogin = null;

function showSetLoginModal() {
  if (!currentWorkerDetail) {
    showMessage('Please select a worker first', 'error');
    return;
  }
  
  currentWorkerForLogin = currentWorkerDetail;
  
  // Clear form
  document.getElementById('loginUsername').value = currentWorkerDetail.username || '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginEnabled').checked = currentWorkerDetail.login_enabled || false;
  
  // Show modal
  document.getElementById('setLoginModal').classList.add('active');
}

function closeSetLoginModal() {
  document.getElementById('setLoginModal').classList.remove('active');
  currentWorkerForLogin = null;
}

// Handle set login form submission
document.addEventListener('DOMContentLoaded', function() {
  const setLoginForm = document.getElementById('setLoginForm');
  if (setLoginForm) {
    setLoginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      if (!currentWorkerForLogin) {
        showMessage('No worker selected', 'error');
        return;
      }
      
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value.trim();
      const loginEnabled = document.getElementById('loginEnabled').checked;
      
      if (!username || !password) {
        showMessage('Username and password are required', 'error');
        return;
      }
      
      if (password.length < 6) {
        showMessage('Password should be at least 6 characters long', 'error');
        return;
      }
      
      try {
        log(`Setting login credentials for worker: ${currentWorkerForLogin.name}`);
        
        const response = await fetch(`/api/workers/${currentWorkerForLogin.id}/credentials`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: username,
            password: password,
            login_enabled: loginEnabled
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          showMessage('Worker login credentials set successfully!', 'success');
          
          // Update current worker detail
          currentWorkerForLogin.username = username;
          currentWorkerForLogin.login_enabled = loginEnabled;
          
          // Close modal
          closeSetLoginModal();
          
          log('✅ Worker login credentials updated');
        } else {
          showMessage(data.error || 'Failed to set credentials', 'error');
        }
      } catch (error) {
        console.error('Error setting worker credentials:', error);
        showMessage('Failed to set credentials. Please try again.', 'error');
      }
    });
  }
});

window.showSetLoginModal = showSetLoginModal;
window.closeSetLoginModal = closeSetLoginModal;
window.roundTimeToFiveMinutes = roundTimeToFiveMinutes;

// Hours Wizard Functions
var currentWizardStep = 1; // Using var for hoisting

// Custom Date Picker Variables
var pickerCurrentDate = new Date();
var pickerSelectedDate = null;
var pickerExistingDates = [];

// Parse date string as local date to avoid Hawaii timezone issues
function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-');
  return new Date(year, month - 1, day); // Local date construction
}

// Convert 24-hour time to 12-hour AM/PM format
function formatTime12Hour(time24) {
  if (!time24) return '';
  
  const [hours, minutes] = time24.split(':');
  const hour24 = parseInt(hours, 10);
  const minute = minutes || '00';
  
  if (hour24 === 0) {
    return `12:${minute} AM`;
  } else if (hour24 < 12) {
    return `${hour24}:${minute} AM`;
  } else if (hour24 === 12) {
    return `12:${minute} PM`;
  } else {
    return `${hour24 - 12}:${minute} PM`;
  }
}

// Format date as MM-DD-YYYY DayName (e.g., "09-22-2025 Sunday") - Hawaii timezone friendly
function formatDateWithDay(dateStr) {
  // Parse the date string as local date to avoid timezone issues
  const date = parseLocalDate(dateStr);
  if (!date) return '';
  
  const dayFormatted = date.getDate().toString().padStart(2, '0');
  const monthFormatted = (date.getMonth() + 1).toString().padStart(2, '0');
  const yearFormatted = date.getFullYear();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[date.getDay()];
  
  return `${monthFormatted}-${dayFormatted}-${yearFormatted} ${dayName}`;
}

// Extract ISO date (YYYY-MM-DD) from formatted display text (MM-DD-YYYY DayName) or manual input
function extractISODate(inputDate) {
  if (!inputDate) return '';
  
  // If it contains a day name, extract the date part (e.g., "09-22-2025" from "09-22-2025 Sunday")
  const datePart = inputDate.includes(' ') ? inputDate.split(' ')[0] : inputDate;
  
  if (!datePart || !datePart.includes('-')) return inputDate; // Return as-is if not formatted
  
  const parts = datePart.split('-');
  if (parts.length !== 3) return inputDate; // Invalid format
  
  // Handle both MM-DD-YYYY and DD-MM-YYYY formats by checking which makes more sense
  const [first, second, third] = parts;
  
  // If third part is 4 digits, it's the year (MM-DD-YYYY or DD-MM-YYYY)
  if (third && third.length === 4) {
    // Assume MM-DD-YYYY format (US format)
    return `${third}-${first.padStart(2, '0')}-${second.padStart(2, '0')}`;
  }
  
  // If first part is 4 digits, it's already YYYY-MM-DD
  if (first && first.length === 4) {
    return inputDate; // Already in ISO format
  }
  
  return inputDate; // Return as-is if we can't parse it
}

// Validate and format manually entered date
function validateAndFormatDate(inputValue) {
  if (!inputValue) return null;
  
  // Try to parse various date formats
  let parsedDate = null;
  
  // Try MM-DD-YYYY format
  const mmddyyyy = inputValue.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    parsedDate = new Date(year, month - 1, day);
  }
  
  // Try MM/DD/YYYY format
  const mmddyyyySlash = inputValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyySlash) {
    const [, month, day, year] = mmddyyyySlash;
    parsedDate = new Date(year, month - 1, day);
  }
  
  // Try YYYY-MM-DD format
  const yyyymmdd = inputValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    parsedDate = new Date(year, month - 1, day);
  }
  
  if (parsedDate && !isNaN(parsedDate.getTime())) {
    // Return both the ISO date and formatted display
    const isoDate = `${parsedDate.getFullYear()}-${(parsedDate.getMonth() + 1).toString().padStart(2, '0')}-${parsedDate.getDate().toString().padStart(2, '0')}`;
    const displayDate = formatDateWithDay(isoDate);
    return { isoDate, displayDate, isValid: true };
  }
  
  return { isValid: false, error: 'Invalid date format. Use MM-DD-YYYY (e.g., 09-22-2025)' };
}

// Custom Date Picker Functions
function toggleDatePicker() {
  const picker = document.getElementById('datePicker');
  if (picker.style.display === 'none') {
    picker.style.display = 'block';
    renderDatePicker();
    positionDatePicker(); // Smart positioning after showing
    setupDatePickerCloseHandlers(); // Setup click-outside-to-close
  } else {
    closeDatePicker();
  }
}

// Close the date picker
function closeDatePicker() {
  const picker = document.getElementById('datePicker');
  if (picker) {
    picker.style.display = 'none';
    removeDatePickerCloseHandlers(); // Clean up event listeners
  }
}

// Setup click-outside-to-close functionality
function setupDatePickerCloseHandlers() {
  // Add click outside listener after a small delay to avoid immediate closing
  setTimeout(() => {
    document.addEventListener('click', handleDatePickerOutsideClick);
    document.addEventListener('keydown', handleDatePickerEscapeKey);
  }, 100);
}

// Remove click-outside event listeners
function removeDatePickerCloseHandlers() {
  document.removeEventListener('click', handleDatePickerOutsideClick);
  document.removeEventListener('keydown', handleDatePickerEscapeKey);
}

// Handle clicking outside the date picker
function handleDatePickerOutsideClick(event) {
  const picker = document.getElementById('datePicker');
  const pickerContainer = document.querySelector('.custom-date-picker');
  
  // Check if click is outside both the picker and the input/button
  if (picker && pickerContainer && 
      !picker.contains(event.target) && 
      !pickerContainer.contains(event.target)) {
    closeDatePicker();
  }
}

// Handle ESC key to close date picker
function handleDatePickerEscapeKey(event) {
  if (event.key === 'Escape') {
    closeDatePicker();
  }
}

// Smart positioning to keep calendar within viewport (mobile-friendly)
function positionDatePicker() {
  const picker = document.getElementById('datePicker');
  const input = document.getElementById('workDate');
  
  if (!picker || !input) return;
  
  // Reset any previous positioning
  picker.style.top = '';
  picker.style.left = '';
  picker.style.transform = '';
  
  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const isMobile = viewportWidth <= 768;
  
  // Get input position and dimensions
  const inputRect = input.getBoundingClientRect();
  const pickerRect = picker.getBoundingClientRect();
  
  // Mobile-specific positioning
  if (isMobile) {
    // On mobile, center the picker horizontally and position below input
    let top = inputRect.bottom + 8;
    
    // Check if there's enough space below, otherwise show above
    if (top + pickerRect.height > viewportHeight - 20) {
      top = inputRect.top - pickerRect.height - 8;
    }
    
    // Apply mobile positioning (CSS handles width and centering via transform)
    picker.style.position = 'fixed';
    picker.style.top = `${top}px`;
    picker.style.left = '50%';
    picker.style.transform = 'translateX(-50%)';
    
    return;
  }
  
  // Desktop positioning (existing logic)
  let top = inputRect.bottom + 4;
  let left = inputRect.left + (inputRect.width / 2) - (280 / 2); // 280px is picker width
  
  // Adjust horizontal position if it goes off-screen
  if (left < 10) {
    left = 10; // 10px margin from left edge
  } else if (left + 280 > viewportWidth - 10) {
    left = viewportWidth - 280 - 10; // 10px margin from right edge
  }
  
  // Adjust vertical position if it goes off-screen
  if (top + pickerRect.height > viewportHeight - 10) {
    // Show above input instead of below
    top = inputRect.top - pickerRect.height - 4;
  }
  
  // Apply the calculated position
  picker.style.position = 'fixed';
  picker.style.top = `${top}px`;
  picker.style.left = `${left}px`;
  picker.style.transform = 'none';
}

// Reposition calendar on window resize
window.addEventListener('resize', () => {
  const picker = document.getElementById('datePicker');
  if (picker && picker.style.display !== 'none') {
    positionDatePicker();
  }
});

function previousMonth() {
  pickerCurrentDate.setMonth(pickerCurrentDate.getMonth() - 1);
  renderDatePicker();
}

function nextMonth() {
  pickerCurrentDate.setMonth(pickerCurrentDate.getMonth() + 1);
  renderDatePicker();
}

function selectDate(dateStr) {
  // Check if date is unavailable
  if (pickerExistingDates.includes(dateStr)) {
    alert(`⚠️ Hours Already Logged\n\nYou already have hours logged for ${dateStr}.\n\nPlease choose a different date or edit the existing entry.`);
    return;
  }
  
  // Check if date is in the future
  const selected = new Date(dateStr);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  if (selected > today) {
    alert('Work date cannot be in the future');
    return;
  }
  
  pickerSelectedDate = dateStr;
  document.getElementById('workDate').value = formatDateWithDay(dateStr);
  closeDatePicker(); // Use the proper close function
  renderDatePicker(); // Re-render to show selection
}

function renderDatePicker() {
  const calendar = document.getElementById('datePickerCalendar');
  const title = document.getElementById('datePickerTitle');
  
  const year = pickerCurrentDate.getFullYear();
  const month = pickerCurrentDate.getMonth();
  
  // Update title
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  title.textContent = `${monthNames[month]} ${year}`;
  
  // Clear calendar
  calendar.innerHTML = '';
  
  // Add day headers
  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  dayHeaders.forEach(day => {
    const header = document.createElement('div');
    header.textContent = day;
    header.style.fontWeight = '600';
    header.style.fontSize = '12px';
    header.style.color = '#6B7280';
    header.style.textAlign = 'center';
    header.style.padding = '8px 4px';
    calendar.appendChild(header);
  });
  
  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());
  
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  
  // Generate calendar days
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    
    const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    const dayButton = document.createElement('button');
    dayButton.type = 'button';
    dayButton.className = 'date-picker-day';
    dayButton.textContent = date.getDate();
    
    // Add classes based on date status
    if (date.getMonth() !== month) {
      dayButton.classList.add('other-month');
    } else {
      if (dateStr === todayStr) {
        dayButton.classList.add('today');
      }
      
      if (dateStr === pickerSelectedDate) {
        dayButton.classList.add('selected');
      }
      
      if (pickerExistingDates.includes(dateStr)) {
        dayButton.classList.add('unavailable');
        dayButton.title = 'Hours already logged for this date';
      } else if (date > today) {
        dayButton.classList.add('future');
        dayButton.title = 'Future dates not allowed';
      } else {
        dayButton.onclick = () => selectDate(dateStr);
      }
    }
    
    calendar.appendChild(dayButton);
  }
}

// Load existing work dates for a worker to disable them in date picker
async function loadExistingWorkDates(workerId, dateInput) {
  try {
    console.log('📅 Loading existing work dates for worker:', workerId);
    const response = await fetch(`/api/workers/${workerId}/hours`);
    
    if (response.ok) {
      const hours = await response.json();
      pickerExistingDates = hours.map(entry => entry.work_date);
      
      console.log('📅 Existing work dates loaded:', pickerExistingDates);
      console.log('📅 Raw hours data:', hours);
      
      // Keep the existing selected date (don't override if already set)
      // The openHoursWizard function now handles setting the default date
      
      // Always render the date picker after loading dates
      renderDatePicker();
      
    } else {
      console.warn('Could not load existing work dates');
    }
  } catch (error) {
    console.error('Error loading existing work dates:', error);
  }
}

// Refresh existing dates after hours are added/deleted
async function refreshExistingDates(workerId) {
  try {
    console.log('🔄 Refreshing existing work dates for worker:', workerId);
    const response = await fetch(`/api/workers/${workerId}/hours`);
    
    if (response.ok) {
      const hours = await response.json();
      pickerExistingDates = hours.map(entry => entry.work_date);
      console.log('🔄 Updated existing work dates:', pickerExistingDates);
      
      // Re-render the date picker if it's currently visible
      const datePicker = document.getElementById('datePicker');
      if (datePicker && datePicker.style.display !== 'none') {
        renderDatePicker();
        console.log('🔄 Re-rendered date picker with updated dates');
      }
    } else {
      console.warn('Could not refresh existing work dates');
    }
  } catch (error) {
    console.error('Error refreshing existing work dates:', error);
  }
}


function openHoursWizard() {
  // Ensure currentWizardStep is initialized
  if (typeof currentWizardStep === 'undefined') {
    window.currentWizardStep = 1;
  }
  
  if (!window.currentWorker) {
    alert('Please select a worker first');
    return;
  }
  
  // Close the worker detail modal to show the wizard clearly
  const workerModal = document.getElementById('workerDetailModal');
  if (workerModal) {
    workerModal.classList.remove('active');
  }
  
  // Reset wizard to step 1
  currentWizardStep = 1;
  updateWizardStep();
  
  // Step 1: Setup custom date picker with existing dates (async)
  const workDateInput = document.getElementById('workDate');
  if (workDateInput) {
    // Always default to today's date first
    const todayDate = new Date();
    const today = `${todayDate.getFullYear()}-${(todayDate.getMonth() + 1).toString().padStart(2, '0')}-${todayDate.getDate().toString().padStart(2, '0')}`;
    workDateInput.value = formatDateWithDay(today);
    pickerSelectedDate = today;
    
    // Load existing work dates for this worker to grey out unavailable dates
    console.log('📅 Loading fresh dates when wizard opens');
    loadExistingWorkDates(window.currentWorker.id, workDateInput).catch(error => {
      console.error('Error loading existing dates:', error);
    });
  }
  
  // Step 2: Load job locations and defaults
  loadJobLocationsForWizard();
  const lastLocation = localStorage.getItem('lastJobLocation') || '';
  const lastWorkType = localStorage.getItem('lastWorkType') || '';
  
  const jobLocationEl = document.getElementById('jobLocation');
  const workTypeEl = document.getElementById('workType');
  
  // Apply after options load
  setTimeout(() => {
    if (jobLocationEl && lastLocation) jobLocationEl.value = lastLocation;
  }, 100);
  if (workTypeEl) workTypeEl.value = lastWorkType;
  
  // Step 3: Set default times
  const startTimeEl = document.getElementById('startTime');
  const endTimeEl = document.getElementById('endTime');
  const lunchMinutesEl = document.getElementById('lunchMinutes');
  
  if (startTimeEl) startTimeEl.value = '08:00';
  if (endTimeEl) endTimeEl.value = '16:30';
  if (lunchMinutesEl) lunchMinutesEl.value = '30';
  
  // Show wizard modal
  const modal = document.getElementById('hoursWizardModal');
  if (modal) {
    modal.style.display = 'block';
  }
}

function closeHoursWizard() {
  // Hide the wizard modal
  document.getElementById('hoursWizardModal').style.display = 'none';
  currentWizardStep = 1;
  updateWizardStep();
  
  // Reopen the worker detail modal if a worker is selected
  if (window.currentWorker) {
    const workerModal = document.getElementById('workerDetailModal');
    if (workerModal) {
      workerModal.classList.add('active');
    }
  }
}

function nextWizardStep() {
  if (currentWizardStep === 1) {
    // Validate step 1 - Date
    const workDateInput = document.getElementById('workDate');
    const workDateDisplay = workDateInput.value;
    const workDate = extractISODate(workDateDisplay); // Convert to YYYY-MM-DD for validation
    
    if (!workDateDisplay || !workDate) {
      alert('Please select a work date');
      return;
    }
    
    // Validate date is not in the future
    const selectedDate = new Date(workDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    if (selectedDate > today) {
      alert('Work date cannot be in the future');
      return;
    }
    
    // Check if date already has hours logged
    if (pickerExistingDates.includes(workDate)) {
      alert(`⚠️ Hours Already Logged\n\nYou already have hours logged for ${workDate}.\n\nPlease choose a different date or edit the existing entry.`);
      return;
    }
    
    currentWizardStep = 2;
  } else if (currentWizardStep === 2) {
    // Validate step 2 - Job Info
    const jobLocation = document.getElementById('jobLocation').value;
    const workType = document.getElementById('workType').value;
    
    if (!jobLocation || !workType) {
      alert('Please select both Job Location and Work Type');
      return;
    }
    
    // Save to localStorage
    localStorage.setItem('lastJobLocation', jobLocation);
    localStorage.setItem('lastWorkType', workType);
    
    currentWizardStep = 3;
  } else if (currentWizardStep === 3) {
    // Validate step 3 - Time Entry
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    
    if (!startTime || !endTime) {
      alert('Please enter start time and end time');
      return;
    }
    
    // Validate end time > start time
    if (endTime <= startTime) {
      document.getElementById('timeValidationError').style.display = 'block';
      return;
    }
    
    document.getElementById('timeValidationError').style.display = 'none';
    
    // Update summary for step 4
    updateSummary();
    currentWizardStep = 4;
  }
  
  updateWizardStep();
}

function prevWizardStep() {
  if (currentWizardStep > 1) {
    currentWizardStep--;
    updateWizardStep();
  }
}

function updateWizardStep() {
  // Update progress indicators
  document.querySelectorAll('.wizard-step').forEach((step, index) => {
    if (index + 1 <= currentWizardStep) {
      step.classList.add('active');
    } else {
      step.classList.remove('active');
    }
  });
  
  // Show/hide step content
  document.querySelectorAll('.wizard-step-content').forEach((content, index) => {
    if (index + 1 === currentWizardStep) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
}

function updateSummary() {
  const workDateDisplay = document.getElementById('workDate').value;
  const workDate = extractISODate(workDateDisplay);
  const dateStr = workDateDisplay || 'Not selected'; // Use the formatted display directly
  
  const jobLocation = document.getElementById('jobLocation').value;
  const workType = document.getElementById('workType').value;
  const startTime = document.getElementById('startTime').value;
  const endTime = document.getElementById('endTime').value;
  const lunchMinutes = parseInt(document.getElementById('lunchMinutes').value) || 0;
  
  // Calculate total hours
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  const totalMinutes = (end - start) / (1000 * 60) - lunchMinutes;
  const totalHours = (totalMinutes / 60).toFixed(2);
  
  // Update summary display
  document.getElementById('summaryDate').textContent = dateStr;
  document.getElementById('summaryLocation').textContent = jobLocation;
  document.getElementById('summaryWorkType').textContent = workType;
  document.getElementById('summaryTime').textContent = `${formatTime12Hour(startTime)} - ${formatTime12Hour(endTime)}`;
  document.getElementById('summaryLunch').textContent = lunchMinutes > 0 ? `${lunchMinutes} minutes` : 'None';
  document.getElementById('summaryTotalHours').textContent = `${totalHours} hours`;
}

async function saveHoursEntry() {
  console.log('💾 saveHoursEntry called, currentWorker:', window.currentWorker);
  
  if (!window.currentWorker) {
    alert('No worker selected');
    return;
  }
  
  const saveBtn = document.getElementById('saveHoursBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Submitting...';
  
  try {
    // Get all wizard data
    const workDateDisplay = document.getElementById('workDate').value;
    const workDate = extractISODate(workDateDisplay); // Convert to YYYY-MM-DD for API
    const jobLocation = document.getElementById('jobLocation').value;
    const workType = document.getElementById('workType').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const lunchMinutes = parseInt(document.getElementById('lunchMinutes').value) || 0;
    
    const entryData = {
      worker_id: window.currentWorker.id,
      work_date: workDate,
      start_time: startTime,
      end_time: endTime,
      break_minutes: lunchMinutes,
      work_type: workType,
      description: `Location: ${jobLocation}`
    };
    
    console.log('📤 Sending hours entry data:', entryData);
    
    const response = await fetch('/api/work-hours', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(entryData)
    });
    
    if (response.ok) {
      const result = await response.json();
      
      // Add new row to the hours table
      console.log('💾 Server response:', result);
      console.log('💾 result.entry:', result.entry);
      
      if (result.entry && result.entry.id) {
        addHoursRowToTable(result.entry);
      } else {
        console.error('❌ No valid entry in server response, using fallback');
        addHoursRowToTable({
          ...entryData,
          id: result.id || Date.now() // Use server ID or fallback
        });
      }
      
      // Hide the wizard modal
      document.getElementById('hoursWizardModal').style.display = 'none';
      currentWizardStep = 1;
      updateWizardStep();
      
      // Show success message
      showMessage('Hours entry saved successfully!', 'success');
      
      // Refresh hours display if needed and reopen worker modal on hours tab
      if (window.currentWorker) {
        loadWorkerHours(window.currentWorker.id);
        // Refresh the existing dates for the date picker
        await refreshExistingDates(window.currentWorker.id);
        
        // Reopen worker detail modal and switch to hours tab
        const workerModal = document.getElementById('workerDetailModal');
        if (workerModal) {
          workerModal.classList.add('active');
          // Switch to hours tab to show the new entry
          showWorkerTab('hours');
        }
      }
    } else {
      const errorData = await response.json();
      
      // Handle duplicate date error specially
      if (response.status === 409) {
        console.error('Duplicate entry error details:', errorData);
        
        // Show more helpful error message
        const debugInfo = errorData.debug_info || {};
        let message = errorData.message || 'Hours already logged for this date';
        
        if (debugInfo.existing_entry_id) {
          message += `\n\nExisting entry ID: ${debugInfo.existing_entry_id}`;
        }
        
        alert(`❌ Cannot Submit Hours Entry\n\n${message}`);
        throw new Error('Duplicate date entry');
      }
      
      throw new Error(errorData.error || 'Failed to save hours');
    }
  } catch (error) {
    console.error('Error saving hours:', error);
    if (error.message !== 'Duplicate date entry') {
      alert('Failed to save hours entry: ' + error.message);
    }
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Submit Hours';
  }
}

function addHoursRowToTable(entry) {
  const tableBody = document.getElementById('hoursTableBody');
  if (!tableBody) return;
  
  // Safety check for entry object
  if (!entry || !entry.id) {
    console.error('Invalid entry object passed to addHoursRowToTable:', entry);
    return;
  }
  
  // Hide empty message
  const emptyMessage = document.getElementById('noHoursMessage');
  if (emptyMessage) {
    emptyMessage.style.display = 'none';
  }
  
  // Calculate hours
  const start = new Date(`2000-01-01T${entry.start_time}`);
  const end = new Date(`2000-01-01T${entry.end_time}`);
  const totalMinutes = (end - start) / (1000 * 60) - (entry.break_minutes || 0);
  const totalHours = (totalMinutes / 60).toFixed(2);
  
  // Extract location from description
  const location = entry.description ? entry.description.replace('Location: ', '') : '-';
  
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${parseLocalDate(entry.work_date).toLocaleDateString()}</td>
    <td>${formatTime12Hour(entry.start_time)}</td>
    <td>${formatTime12Hour(entry.end_time)}</td>
    <td>${totalHours}</td>
    <td>${entry.break_minutes || 0}</td>
    <td>${location}</td>
    <td>${entry.work_type}</td>
    <td>
      <button class="edit-btn" onclick="editHours('${entry.id}')" title="Edit">✏️</button>
      <button class="delete-btn" onclick="deleteHours('${entry.id}')" title="Delete">🗑️</button>
    </td>
  `;
  
  // Insert at the beginning of the table
  tableBody.insertBefore(row, tableBody.firstChild);
}

async function loadWorkerHours(workerId) {
  const tableBody = document.getElementById('hoursTableBody');
  const emptyMessage = document.getElementById('noHoursMessage');
  const loadingDiv = document.getElementById('workerHoursLoading');
  
  if (!tableBody) return;
  
  try {
    if (loadingDiv) loadingDiv.style.display = 'block';
    
    const response = await fetch(`/api/workers/${workerId}/hours`);
    if (response.ok) {
      const hours = await response.json();
      
      tableBody.innerHTML = '';
      
      if (hours.length === 0) {
        if (emptyMessage) emptyMessage.style.display = 'block';
      } else {
        if (emptyMessage) emptyMessage.style.display = 'none';
        
        hours.forEach(entry => {
          addHoursRowToTable(entry);
        });
      }
    } else {
      throw new Error('Failed to load hours');
    }
  } catch (error) {
    console.error('Error loading worker hours:', error);
    if (emptyMessage) {
      emptyMessage.innerHTML = '<p>Error loading hours data</p>';
      emptyMessage.style.display = 'block';
    }
  } finally {
    if (loadingDiv) loadingDiv.style.display = 'none';
  }
}

// Update the hours tab loading to use new system
function updateShowWorkerTab() {
  if (typeof showWorkerTab === 'function') {
    const originalShowWorkerTab = showWorkerTab;
    
    window.showWorkerTab = function(tabName) {
      originalShowWorkerTab(tabName);
      
      // Load hours when hours tab is selected
      if (tabName === 'hours' && window.currentWorker) {
        loadWorkerHours(window.currentWorker.id);
      }
    };
  }
}

// Set up event listener for Add Hours button
document.addEventListener('DOMContentLoaded', function() {
  const addHoursBtn = document.getElementById('addHoursBtn');
  if (addHoursBtn) {
    addHoursBtn.addEventListener('click', function() {
      openHoursWizard();
    });
  }
  
  // Update the worker tab function
  updateShowWorkerTab();
});


// Make wizard functions and variables globally accessible
window.currentWizardStep = currentWizardStep;
window.openHoursWizard = openHoursWizard;
window.closeHoursWizard = closeHoursWizard;
window.nextWizardStep = nextWizardStep;
window.prevWizardStep = prevWizardStep;
window.saveHoursEntry = saveHoursEntry;
window.toggleDatePicker = toggleDatePicker;
window.previousMonth = previousMonth;
window.nextMonth = nextMonth;
window.selectDate = selectDate;
window.refreshExistingDates = refreshExistingDates;
window.formatDateWithDay = formatDateWithDay;
window.extractISODate = extractISODate;
window.positionDatePicker = positionDatePicker;
window.parseLocalDate = parseLocalDate;
window.formatTime12Hour = formatTime12Hour;
window.closeDatePicker = closeDatePicker;
