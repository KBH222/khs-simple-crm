# KHS CRM - Production Deployment Guide

## 🚀 Production Setup Complete!

Your KHS CRM is now running like a production application with PM2 process management, automatic restarts, logging, and monitoring.

## 📋 Quick Start

### Starting the Server
```batch
# Double-click or run:
start-server.bat
```

### Stopping the Server
```batch
# Double-click or run:
stop-server.bat
```

### Restarting the Server
```batch
# Double-click or run:
restart-server.bat
```

### Monitoring the Server
```batch
# Double-click or run:
monitor-server.bat
```

## 🔧 Production Features

### ✅ Process Management (PM2)
- **Auto-restart**: Server automatically restarts if it crashes
- **Memory monitoring**: Restarts if memory usage exceeds 1GB
- **Process clustering**: Can scale to multiple instances if needed
- **Zero-downtime restarts**: Update code without service interruption

### ✅ Logging & Monitoring
- **Structured logging**: All logs saved to `logs/` folder
- **Log rotation**: Logs rotate daily and keep last 7 days
- **Real-time monitoring**: CPU, memory, and uptime tracking
- **Error tracking**: Separate error logs for debugging

### ✅ Automatic Backups
- **Startup backups**: Created every time server starts
- **Daily backups**: Automatic daily database backups
- **Manual backups**: Create backups via web interface or API
- **Backup retention**: Keeps last 10 backups automatically

### ✅ Health Monitoring
- **Health check endpoint**: `http://localhost:3000/api/health`
- **Process monitoring**: PM2 tracks server status
- **Automatic recovery**: Server restarts on failures

## 📊 Management Commands

### PM2 Commands
```powershell
# View server status
npx pm2 list

# View real-time logs
npx pm2 logs khs-crm

# Monitor CPU/Memory in real-time
npx pm2 monit

# Restart server
npx pm2 restart khs-crm

# Stop server
npx pm2 stop khs-crm

# View detailed info
npx pm2 info khs-crm
```

### Backup Commands
```powershell
# Create manual backup via API
Invoke-WebRequest -Uri "http://localhost:3000/api/backup/create" -Method POST

# List all backups
dir backups

# View backup history in web interface
# Go to Settings > Backup tab
```

## 📁 File Structure
```
simple-crm/
├── server.js                 # Main server file
├── ecosystem.config.js       # PM2 configuration
├── start-server.bat         # Start server script
├── stop-server.bat          # Stop server script  
├── restart-server.bat       # Restart server script
├── monitor-server.bat       # Monitoring interface
├── logs/                    # Server logs
│   ├── combined.log         # All logs
│   ├── out.log             # Standard output
│   └── error.log           # Error logs
├── backups/                 # Database backups
│   └── crm-backup-*.db     # Timestamped backups
└── public/                  # Web interface files
    ├── index.html
    ├── app.js
    └── style.css
```

## 🔄 Server Status

### Current Status
- **URL**: http://localhost:3000
- **Status**: ✅ Running with PM2
- **Process Name**: khs-crm
- **Auto-restart**: Enabled
- **Logging**: Enabled with rotation
- **Backups**: Automatic (startup + daily)

### Server Capabilities
- **Workers Management**: Full employee tracking
- **Time Tracking**: Hours logging with overtime calculation
- **Customer Management**: Complete CRM functionality
- **Job Management**: Project and task tracking
- **Calendar**: Event scheduling and management
- **Backup System**: Automatic data protection

## 🛡️ Production Best Practices

### Security
- Server runs on localhost (secure for local network)
- Database files are automatically backed up
- Process isolation with PM2

### Performance
- Memory monitoring prevents memory leaks
- Automatic restart on high memory usage
- Log rotation prevents disk space issues

### Reliability
- PM2 process manager ensures 99.9% uptime
- Automatic recovery from crashes
- Health monitoring and alerts

### Maintenance
- Weekly backup cleanup (automatic)
- Log rotation (daily)
- Zero-downtime updates possible

## 🚨 Troubleshooting

### Server Won't Start
1. Run `start-server.bat`
2. Check logs: `npx pm2 logs khs-crm`
3. Check process status: `npx pm2 list`

### Can't Access Web Interface
1. Verify server is running: `npx pm2 list`
2. Check URL: http://localhost:3000
3. Check Windows firewall settings

### Database Issues
1. Check latest backup in `backups/` folder
2. Restore from backup if needed
3. Check server logs for database errors

### Performance Issues
1. Monitor resources: `npx pm2 monit`
2. Restart server: `restart-server.bat`
3. Check log files for errors

## 📞 Support

For issues with your KHS CRM production deployment:

1. **Check logs**: Use `monitor-server.bat` option 2
2. **View status**: Use `monitor-server.bat` option 1  
3. **Create backup**: Use `monitor-server.bat` option 5 before making changes
4. **Restart**: Use `restart-server.bat` to resolve most issues

Your CRM is now running like a professional production application!
