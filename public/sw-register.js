// Service Worker Registration and Update Management

// Disable Service Worker on localhost to avoid dev caching issues
const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

if ('serviceWorker' in navigator && !isLocalhost) {
  window.addEventListener('load', () => {
    registerServiceWorker();
  });
} else if (isLocalhost && 'serviceWorker' in navigator) {
  // Ensure any existing SW is unregistered during local development
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => reg.unregister());
  });
}

async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    console.log('ServiceWorker registered:', registration);
    
    // Check for updates every 5 minutes when the app is active
    setInterval(() => {
      registration.update();
    }, 5 * 60 * 1000);
    
    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      console.log('ServiceWorker update found');
      
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker installed, show update notification
          showUpdateNotification(newWorker);
        }
      });
    });
    
    // Handle controller change (when service worker takes control)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('ServiceWorker controller changed');
      // Reload the page to get fresh content
      window.location.reload();
    });
    
  } catch (error) {
    console.error('ServiceWorker registration failed:', error);
  }
}

function showUpdateNotification(worker) {
  // Create update notification UI
  const notification = document.createElement('div');
  notification.className = 'update-notification';
  notification.innerHTML = `
    <div class="update-notification-content">
      <div class="update-notification-text">
        <strong>Update Available!</strong>
        <p>A new version of KHS CRM is ready.</p>
      </div>
      <div class="update-notification-actions">
        <button id="updateBtn" class="update-btn">Update Now</button>
        <button id="dismissBtn" class="dismiss-btn">Later</button>
      </div>
    </div>
  `;
  
  // Add styles if not already present
  if (!document.querySelector('#update-notification-styles')) {
    const styles = document.createElement('style');
    styles.id = 'update-notification-styles';
    styles.textContent = `
      .update-notification {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 16px;
        z-index: 10000;
        max-width: 400px;
        width: calc(100% - 40px);
        animation: slideUp 0.3s ease-out;
      }
      
      @keyframes slideUp {
        from {
          transform: translateX(-50%) translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      }
      
      .update-notification-content {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      
      .update-notification-text {
        flex: 1;
      }
      
      .update-notification-text strong {
        color: #111827;
        font-size: 16px;
      }
      
      .update-notification-text p {
        color: #6B7280;
        font-size: 14px;
        margin: 4px 0 0;
      }
      
      .update-notification-actions {
        display: flex;
        gap: 8px;
      }
      
      .update-btn, .dismiss-btn {
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        border: none;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .update-btn {
        background: #3B82F6;
        color: white;
      }
      
      .update-btn:hover {
        background: #2563EB;
      }
      
      .dismiss-btn {
        background: #F3F4F6;
        color: #6B7280;
      }
      
      .dismiss-btn:hover {
        background: #E5E7EB;
      }
      
      @media (max-width: 480px) {
        .update-notification-content {
          flex-direction: column;
          text-align: center;
        }
        
        .update-notification-actions {
          width: 100%;
          justify-content: center;
        }
        
        .update-btn, .dismiss-btn {
          flex: 1;
        }
      }
    `;
    document.head.appendChild(styles);
  }
  
  document.body.appendChild(notification);
  
  // Handle update button
  document.getElementById('updateBtn').addEventListener('click', () => {
    worker.postMessage({ type: 'SKIP_WAITING' });
    notification.remove();
  });
  
  // Handle dismiss button
  document.getElementById('dismissBtn').addEventListener('click', () => {
    notification.remove();
  });
  
  // Auto-hide after 30 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 30000);
}

// Utility function to clear all caches (for debugging)
window.clearServiceWorkerCache = async () => {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    registration.active.postMessage({ type: 'CLEAR_CACHE' });
    console.log('Cache clear requested');
  }
};

// Check online/offline status for PWA
window.addEventListener('online', () => {
  console.log('App is online');
  // Trigger sync if needed
  if ('serviceWorker' in navigator && 'sync' in registration) {
    navigator.serviceWorker.ready.then(registration => {
      registration.sync.register('sync-offline-data');
    });
  }
});

window.addEventListener('offline', () => {
  console.log('App is offline - using cached data');
});

console.log('Service Worker registration script loaded');