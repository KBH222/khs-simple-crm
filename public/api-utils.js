// API utilities for reliable data operations
// Provides retry logic, offline queue, and idempotency support

// Configuration
const API_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // Base delay in ms, will be multiplied by retry count
  offlineQueueKey: 'khs_crm_offline_queue',
  idempotencyKeyPrefix: 'khs_idempotency_'
};

// Generate a unique idempotency key for write operations
function generateIdempotencyKey() {
  return `${API_CONFIG.idempotencyKeyPrefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Exponential backoff calculation
function getRetryDelay(retryCount) {
  return API_CONFIG.retryDelay * Math.pow(2, retryCount);
}

// Check if the browser is online
function isOnline() {
  return navigator.onLine;
}

// Offline queue management
class OfflineQueue {
  constructor() {
    this.queue = this.load();
    
    // Listen for online/offline events
    window.addEventListener('online', () => this.processQueue());
    window.addEventListener('offline', () => console.log('📵 App is offline - requests will be queued'));
    
    // Try to process queue on initialization if online
    if (isOnline()) {
      setTimeout(() => this.processQueue(), 1000);
    }
  }
  
  load() {
    try {
      const stored = localStorage.getItem(API_CONFIG.offlineQueueKey);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load offline queue:', e);
      return [];
    }
  }
  
  save() {
    try {
      localStorage.setItem(API_CONFIG.offlineQueueKey, JSON.stringify(this.queue));
    } catch (e) {
      console.error('Failed to save offline queue:', e);
    }
  }
  
  add(request) {
    this.queue.push({
      ...request,
      queuedAt: Date.now(),
      retries: 0
    });
    this.save();
    console.log(`📥 Request queued for offline processing (${this.queue.length} items in queue)`);
  }
  
  async processQueue() {
    if (!isOnline() || this.queue.length === 0) {
      return;
    }
    
    console.log(`🔄 Processing offline queue (${this.queue.length} items)`);
    
    const failedRequests = [];
    
    for (const request of this.queue) {
      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body
        });
        
        if (response.ok) {
          console.log(`✅ Offline request succeeded: ${request.method} ${request.url}`);
        } else {
          throw new Error(`Request failed with status ${response.status}`);
        }
      } catch (error) {
        console.error(`❌ Failed to process queued request:`, error);
        request.retries = (request.retries || 0) + 1;
        
        // Keep in queue if not exceeded max retries
        if (request.retries < API_CONFIG.maxRetries) {
          failedRequests.push(request);
        } else {
          console.error(`🗑️ Dropping request after ${request.retries} retries: ${request.method} ${request.url}`);
        }
      }
    }
    
    this.queue = failedRequests;
    this.save();
    
    if (this.queue.length > 0) {
      console.log(`⚠️ ${this.queue.length} requests still pending in offline queue`);
    } else {
      console.log('✅ Offline queue processed successfully');
    }
  }
}

// Initialize offline queue
const offlineQueue = new OfflineQueue();

// Enhanced fetch with retry logic and offline support
async function reliableFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const isWriteOperation = ['POST', 'PUT', 'DELETE'].includes(method);
  
  // Add idempotency key for write operations
  if (isWriteOperation && !options.skipIdempotency) {
    options.headers = {
      ...options.headers,
      'X-Idempotency-Key': generateIdempotencyKey()
    };
  }
  
  // Check if offline for write operations
  if (!isOnline() && isWriteOperation) {
    // Queue the request for later
    offlineQueue.add({
      url,
      method,
      headers: options.headers,
      body: options.body
    });
    
    // Return a pending response
    return {
      ok: false,
      status: 0,
      json: async () => ({ queued: true, message: 'Request queued for offline processing' }),
      text: async () => 'Request queued for offline processing'
    };
  }
  
  // Attempt the request with retries
  let lastError;
  for (let retry = 0; retry <= API_CONFIG.maxRetries; retry++) {
    try {
      const response = await fetch(url, options);
      
      // Success or client error (4xx) - don't retry
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }
      
      // Server error (5xx) - might be temporary, retry
      if (response.status >= 500) {
        lastError = new Error(`Server error: ${response.status}`);
        
        if (retry < API_CONFIG.maxRetries) {
          const delay = getRetryDelay(retry);
          console.log(`⏳ Retrying request in ${delay}ms (attempt ${retry + 1}/${API_CONFIG.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      return response;
    } catch (error) {
      lastError = error;
      
      // Network error - retry
      if (retry < API_CONFIG.maxRetries) {
        const delay = getRetryDelay(retry);
        console.log(`⏳ Network error, retrying in ${delay}ms (attempt ${retry + 1}/${API_CONFIG.maxRetries}):`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries exhausted
  console.error(`❌ Request failed after ${API_CONFIG.maxRetries} retries:`, lastError);
  
  // For write operations, queue for offline processing
  if (isWriteOperation && !isOnline()) {
    offlineQueue.add({
      url,
      method,
      headers: options.headers,
      body: options.body
    });
  }
  
  throw lastError;
}

// Export functions for use in the app
window.apiUtils = {
  reliableFetch,
  generateIdempotencyKey,
  isOnline,
  offlineQueue
};

// Display connection status
function updateConnectionStatus() {
  const statusEl = document.getElementById('connection-status');
  if (statusEl) {
    if (isOnline()) {
      statusEl.textContent = '🟢 Online';
      statusEl.className = 'connection-status online';
    } else {
      statusEl.textContent = '🔴 Offline';
      statusEl.className = 'connection-status offline';
    }
  }
}

// Update status on page load and when connection changes
window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
document.addEventListener('DOMContentLoaded', updateConnectionStatus);

console.log('✅ API utilities loaded - retry logic and offline queue ready');