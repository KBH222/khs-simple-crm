// Simple server starter with error handling
const { spawn } = require('child_process');

console.log('Starting KHS CRM Server...');

const server = spawn('node', ['server.js'], {
  stdio: 'inherit',
  cwd: process.cwd()
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
});

server.on('exit', (code, signal) => {
  console.log(`Server process exited with code ${code} and signal ${signal}`);
});

console.log('Server started with PID:', server.pid);

// Keep the process alive
process.stdin.resume();
