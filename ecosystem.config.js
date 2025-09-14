module.exports = {
  apps: [{
    name: 'khs-crm',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    // Restart policy
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Logging
    log_file: 'logs/combined.log',
    out_file: 'logs/out.log',
    error_file: 'logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    log_type: 'json',
    merge_logs: true,
    
    // Advanced features
    kill_timeout: 3000,
    listen_timeout: 3000,
    shutdown_with_message: true,
    
    // Health monitoring
    health_check_url: 'http://localhost:3000/api/health',
    health_check_grace_period: 3000
  }]
};
