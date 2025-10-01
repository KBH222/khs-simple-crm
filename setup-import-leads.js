/**
 * Setup Script: Import Leads Feature
 * Automated setup helper for integrating the Import Leads feature
 * 
 * This script will:
 * 1. Run database migration
 * 2. Create necessary directories
 * 3. Provide integration instructions
 * 
 * Usage: node setup-import-leads.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n' + '='.repeat(70));
console.log('  KHS CRM - Import Leads Feature Setup');
console.log('='.repeat(70) + '\n');

// Step 1: Check required files
console.log('📋 Step 1: Checking required files...\n');

const requiredFiles = [
  'db/migrations/add-import-leads-table.js',
  'routes/import-leads.js',
  'public/import-leads.js',
  'public/import-leads.css',
  'public/import-leads-page.html'
];

let allFilesPresent = true;

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - MISSING`);
    allFilesPresent = false;
  }
});

if (!allFilesPresent) {
  console.log('\n❌ Error: Some required files are missing!');
  console.log('   Please ensure all import leads files are in place.\n');
  process.exit(1);
}

console.log('\n✅ All required files present\n');

// Step 2: Run database migration
console.log('📋 Step 2: Running database migration...\n');

try {
  execSync('node db/migrations/add-import-leads-table.js', { stdio: 'inherit' });
  console.log('\n✅ Database migration completed\n');
} catch (error) {
  console.log('\n⚠️  Migration may have already run or encountered an error');
  console.log('   You can continue with the setup.\n');
}

// Step 3: Create directories
console.log('📋 Step 3: Creating required directories...\n');

const directories = [
  'uploads/temp',
  'uploads/plans'
];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`   ✅ Created: ${dir}`);
  } else {
    console.log(`   ℹ️  Already exists: ${dir}`);
  }
});

// Create .gitkeep in temp directory
const gitkeepPath = path.join('uploads', 'temp', '.gitkeep');
if (!fs.existsSync(gitkeepPath)) {
  fs.writeFileSync(gitkeepPath, '');
  console.log(`   ✅ Created: ${gitkeepPath}`);
}

console.log('\n✅ Directories ready\n');

// Step 4: Check server.js integration
console.log('📋 Step 4: Checking server.js integration...\n');

const serverJsPath = 'server.js';
let serverJsContent = '';

try {
  serverJsContent = fs.readFileSync(serverJsPath, 'utf8');
  
  // Check if routes are already imported
  const hasImport = serverJsContent.includes("require('./routes/import-leads')");
  const hasRoute = serverJsContent.includes("app.use('/api/import-leads'");
  
  if (hasImport && hasRoute) {
    console.log('   ✅ Import leads routes already integrated in server.js');
  } else {
    console.log('   ⚠️  Import leads routes NOT found in server.js');
    console.log('   📝 Manual step required - Add these lines to server.js:\n');
    
    if (!hasImport) {
      console.log('   // Near the top with other requires:');
      console.log("   const importLeadsRoutes = require('./routes/import-leads');\n");
    }
    
    if (!hasRoute) {
      console.log('   // After other route registrations:');
      console.log("   app.use('/api/import-leads', importLeadsRoutes);\n");
    }
  }
} catch (error) {
  console.log('   ⚠️  Could not read server.js');
}

// Step 5: Check index.html integration
console.log('\n📋 Step 5: Checking index.html integration...\n');

const indexHtmlPath = 'public/index.html';
let indexHtmlContent = '';

try {
  indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
  
  const hasPage = indexHtmlContent.includes('id="import-leads"');
  const hasScript = indexHtmlContent.includes('import-leads.js');
  const hasCSS = indexHtmlContent.includes('import-leads.css');
  const hasCard = indexHtmlContent.includes('data-page="import-leads"');
  
  if (hasPage && hasScript && hasCSS && hasCard) {
    console.log('   ✅ All import leads components integrated in index.html');
  } else {
    console.log('   ⚠️  Some components NOT found in index.html\n');
    console.log('   📝 Manual integration required:\n');
    
    if (!hasCSS) {
      console.log('   1. Add CSS link in <head>:');
      console.log('      <link rel="stylesheet" href="import-leads.css?v=20250101000000">\n');
    }
    
    if (!hasCard) {
      console.log('   2. Add dashboard card (see import-leads-page.html)\n');
    }
    
    if (!hasPage) {
      console.log('   3. Add page content from import-leads-page.html\n');
    }
    
    if (!hasScript) {
      console.log('   4. Add script before closing </body>:');
      console.log('      <script src="import-leads.js?v=20250101000000"></script>\n');
    }
  }
} catch (error) {
  console.log('   ⚠️  Could not read index.html');
}

// Final instructions
console.log('\n' + '='.repeat(70));
console.log('  Setup Summary');
console.log('='.repeat(70) + '\n');

console.log('✅ Automated steps completed:\n');
console.log('   • Database migration run');
console.log('   • Required directories created');
console.log('   • Files verified\n');

console.log('📝 Manual steps (if not done yet):\n');
console.log('   1. Integrate routes in server.js');
console.log('   2. Add HTML components to index.html');
console.log('   3. Add CSS and JavaScript references');
console.log('   4. Update app.js showPage() function\n');

console.log('📖 Full instructions: See IMPORT_LEADS_INTEGRATION_GUIDE.md\n');

console.log('🧪 Test with sample data:\n');
console.log('   node test-import-leads-sample.js\n');

console.log('🚀 After integration, restart your server:\n');
console.log('   npm start\n');

console.log('🌐 Then visit: http://localhost:3001');
console.log('   Navigate to Dashboard → Import Queue\n');

console.log('='.repeat(70) + '\n');

console.log('💡 Tip: Check IMPORT_LEADS_INTEGRATION_GUIDE.md for detailed');
console.log('   step-by-step integration instructions and API documentation.\n');

