# KHS CRM Backup System

## Overview
Your KHS CRM now includes an automated backup system to protect your valuable customer and job data.

## How It Works

### Automatic Backups
- **Startup Backup**: Created every time you start the server
- **Daily Backup**: Created automatically every 24 hours
- **Retention**: System keeps the last 10 backups and automatically deletes older ones

### Manual Backups
- Click the "Backup" card on your dashboard to create an immediate backup
- Backup status is displayed on the dashboard showing when your last backup was created

### Backup Files
- Located in the `backups/` folder
- Named with timestamp: `crm-backup-[reason]-[timestamp].db`
- Each backup is a complete copy of your CRM database

## Backup Types
1. **startup** - Created when server starts
2. **daily** - Created automatically every 24 hours  
3. **manual** - Created when you click the Backup button

## Recovery
To restore from a backup:
1. Stop the CRM server
2. Replace `crm.db` with your chosen backup file
3. Rename the backup file to `crm.db`
4. Start the server

## Current Status
✅ Backup system is active and running
✅ Your first backup has been created
✅ Manual backup option available on dashboard

## File Locations
- Main database: `crm.db`
- Backup folder: `backups/`
- Current backup: `crm-backup-startup-2025-09-14T01-57-51.db`

Your CRM data is now protected with automatic backups!
