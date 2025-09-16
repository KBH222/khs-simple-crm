#!/usr/bin/env node

/**
 * Code Cleanup Safety Testing Script
 * 
 * Run this before and after code cleanup to ensure nothing breaks
 */

const { execSync } = require('child_process');

console.log('🧪 Running Code Cleanup Safety Tests...\n');

const testCommands = [
  {
    name: '🎯 Critical Functions Test',
    command: 'npx playwright test critical-functions.spec.js --project=chromium'
  },
  {
    name: '👥 Customer Management Test', 
    command: 'npx playwright test customer-management.spec.js --project=chromium'
  },
  {
    name: '🧭 Basic Navigation Test',
    command: 'npx playwright test basic-navigation.spec.js --project=chromium'
  }
];

let allPassed = true;
const results = [];

for (const test of testCommands) {
  console.log(`Running: ${test.name}`);
  console.log(`Command: ${test.command}\n`);
  
  try {
    const output = execSync(test.command, { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    console.log('✅ PASSED');
    results.push({ name: test.name, status: 'PASSED', output });
    
  } catch (error) {
    console.log('❌ FAILED');
    console.log('Error output:', error.stdout || error.stderr);
    allPassed = false;
    results.push({ name: test.name, status: 'FAILED', error: error.message });
  }
  
  console.log('─'.repeat(60));
}

console.log('\n📊 SAFETY TEST RESULTS:');
console.log('═'.repeat(60));

results.forEach(result => {
  const status = result.status === 'PASSED' ? '✅' : '❌';
  console.log(`${status} ${result.name}: ${result.status}`);
});

console.log('═'.repeat(60));

if (allPassed) {
  console.log('🎉 ALL TESTS PASSED - SAFE TO PROCEED WITH CLEANUP');
  console.log('💡 Save this commit hash as your rollback point:');
  
  try {
    const commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    console.log(`📝 Rollback commit: ${commitHash}`);
  } catch (e) {
    console.log('📝 Could not get current commit hash');
  }
  
  process.exit(0);
} else {
  console.log('⚠️  TESTS FAILED - DO NOT PROCEED WITH CLEANUP');
  console.log('🔧 Fix the failing tests before cleaning up code');
  process.exit(1);
}