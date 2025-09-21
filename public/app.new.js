// Helper function to get the appropriate fetch function
function getReliableFetch() {
  return (window.apiUtils && window.apiUtils.reliableFetch) ? window.apiUtils.reliableFetch : fetch;
}

// Global state
let isPageVisible = true;

// Show/hide a page
async function showPage(pageName) {
  log('🚀 Showing page:', pageName);
  
  // Hide all pages first
  const allPages = document.querySelectorAll('.page');
  log('Found pages:', allPages.length);
  
  allPages.forEach(page => {
    page.classList.remove('active');
    log('Hiding page:', page.id);
  });
  
  // Let DOM update
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Show selected page
  const targetPage = document.getElementById(pageName);
  log('Target page element:', targetPage);
  
  if (targetPage) {
    targetPage.classList.add('active');
    log('✅ Successfully showing page:', pageName);
    await new Promise(resolve => setTimeout(resolve, 100)); // Let DOM update again
  } else {
    logError('❌ Page not found:', pageName);
    return false;
  }
  
  // Wait for profile page to be ready before showing admin sections
  if (pageName === 'profile') {
    const userManagementSection = document.getElementById('userManagementSection');
    if (userManagementSection) {
      userManagementSection.style.display = 'block';
      await new Promise(resolve => setTimeout(resolve, 100)); // Let visibility update
    }
  }
  
  return true;
}

// Utility functions
function log(...args) {
  console.log(...args);
}

function logError(...args) {
  console.error(...args);
}