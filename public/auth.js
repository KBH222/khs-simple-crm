// Simple authentication module
(function() {
  let isLoggedIn = false;

  // Returns the current user object if logged in
  function getCurrentUser() {
    if (!isLoggedIn) return null;
    return {
      name: 'Administrator',
      email: 'admin@khscrm.com',
      role: 'OWNER'
    };
  }

  function isAdmin() {
    return isLoggedIn; // single admin user for now
  }

  // Populate basic profile fields if present
  async function updateProfileUI() {
    const user = getCurrentUser();
    if (!user) return;

    // Update header name
    const headerNameEl = document.getElementById('userName');
    if (headerNameEl) headerNameEl.textContent = user.name;
    
    // Ensure profile page is visible
    try {
      if (typeof window.showPage === 'function') {
        await window.showPage('profile');
        await new Promise(resolve => setTimeout(resolve, 100)); // Let DOM update
      }
    } catch(e) {
      console.warn('Failed to show profile page:', e);
    }
    
    // Update profile fields if on profile page
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profileRole = document.getElementById('profileRole');
    
    if (profileName) profileName.textContent = user.name;
    if (profileEmail) profileEmail.textContent = user.email;
    if (profileRole) profileRole.textContent = user.role;

    // Show admin section if admin
    const adminSection = document.getElementById('userManagementSection');
    if (adminSection) {
      adminSection.style.display = isAdmin() ? 'block' : 'none';
    }
  }

  // Show/hide screens based on auth state
  async function showCorrectScreen() {
    const loginScreen = document.getElementById('loginScreen');
    const appScreen = document.getElementById('appScreen');
    const errorDiv = document.getElementById('loginError');
    
    if (!loginScreen || !appScreen) {
      throw new Error('Required screens not found');
    }

    if (isLoggedIn) {
      // Switch screens atomically
      loginScreen.style.opacity = '0';
      loginScreen.style.visibility = 'hidden';
      await new Promise(resolve => setTimeout(resolve, 100));
      loginScreen.style.display = 'none';
      
      // Show app screen
      appScreen.style.display = 'block';
      await new Promise(resolve => setTimeout(resolve, 100));
      appScreen.style.opacity = '1';
      appScreen.style.visibility = 'visible';
      
      // Clear any error messages
      if (errorDiv) {
        errorDiv.textContent = '';
        errorDiv.style.display = 'none';
        errorDiv.setAttribute('aria-hidden', 'true');
      }
      
      // Wait for DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
    } else {
      // Switch back to login screen
      appScreen.style.opacity = '0';
      appScreen.style.visibility = 'hidden';
      await new Promise(resolve => setTimeout(resolve, 100));
      appScreen.style.display = 'none';
      
      // Show login screen
      loginScreen.style.display = 'block';
      await new Promise(resolve => setTimeout(resolve, 100));
      loginScreen.style.opacity = '1';
      loginScreen.style.visibility = 'visible';
      
      // Wait for DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Show/hide admin sections separately
    const userManagementSection = document.getElementById('userManagementSection');
    if (userManagementSection) {
      if (isLoggedIn && isAdmin()) {
        userManagementSection.style.display = 'block';
        userManagementSection.style.visibility = 'visible';
      } else {
        userManagementSection.style.visibility = 'hidden';
        userManagementSection.style.display = 'none';
      }
    }
    
    // Final DOM settling time
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Check if logged in and initialize UI
  async function initAuth() {
    isLoggedIn = localStorage.getItem('is_logged_in') === 'true';
    
    if (isLoggedIn) {
      try {
        // Show correct screens
        await showCorrectScreen();
        await updateProfileUI();
        
        // Initialize app
        if (typeof window.initializeApp === 'function') {
          await window.initializeApp();
        }
        
        // Wait for DOM update
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Show profile page
        if (typeof window.showPage === 'function') {
          await window.showPage('profile');
        }
      } catch(e) { 
        console.warn('App init failed:', e); 
      }
    } else {
      await showCorrectScreen();
    }
  }

  // Handle form submit
  window.handleLoginSubmit = async function(e) {
    e.preventDefault();
    
      // Clear any previous error
      const errorDiv = document.getElementById('loginError');
      errorDiv.textContent = '';
      errorDiv.style.display = 'none';
      errorDiv.setAttribute('aria-hidden', 'true');

      // Get credentials
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value.trim();

      // Simple validation
      if (!email || !password) {
        errorDiv.textContent = 'Please enter both email and password';
        errorDiv.style.display = 'block';
        errorDiv.setAttribute('aria-hidden', 'false');
        return false;
      }

      // Basic auth check
      if (email === 'admin@khscrm.com' && password === 'admin123') {
        isLoggedIn = true;
        localStorage.setItem('is_logged_in', 'true');
        
        // Clear any remaining error
        errorDiv.textContent = '';
        errorDiv.style.display = 'none';
        errorDiv.setAttribute('aria-hidden', 'true');
        
        await showCorrectScreen();
        await updateProfileUI();

      // Initialize app and navigate to profile
      setTimeout(async () => {
        try { 
          if (typeof window.initializeApp === 'function') {
            await window.initializeApp(); 
          }
          if (typeof window.showPage === 'function') {
            await window.showPage('profile');
          }
        } catch(e) { 
          console.warn('App init failed:', e); 
        }
      }, 100); // Small delay to let DOM update
      return true;
    }

    // Show error message
    errorDiv.textContent = 'Invalid email or password';
    errorDiv.style.visibility = 'visible';
    errorDiv.style.display = 'block';
    errorDiv.style.opacity = '1';
    errorDiv.setAttribute('aria-hidden', 'false');
    
    // Force immediate reflow
    errorDiv.offsetHeight;
    
    // Let DOM update
    await new Promise(resolve => setTimeout(resolve, 300));
    return false;
  };

  // Handle logout
  function logout() {
    isLoggedIn = false;
    localStorage.removeItem('is_logged_in');
    window.location.reload(); // Force full reload to clean state
  }

  // Check if logged in
  function isAuthenticated() {
    return isLoggedIn;
  }

  // Public API
  window.Auth = {
    initAuth,
    logout, 
    isAuthenticated,
    getCurrentUser,
    isAdmin
  };
})();