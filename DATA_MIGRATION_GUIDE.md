# Data Migration System - Export/Import Guide

Your KHS CRM now includes a robust data migration system that preserves user data across Railway deployments by exporting and importing data automatically.

## 🎯 How It Works

### **Before Deployment:**
1. **Export your data** - Creates `data-export.json` file
2. **Deploy to Railway** - File is included in deployment
3. **Automatic import** - Data is restored on first startup

### **No More Sample Data:**
- ✅ Sample data system removed entirely
- ✅ App starts completely clean
- ✅ Only your real data is preserved
- ✅ No demo customers/workers interference

## 📦 Export System

### **What Gets Exported:**
- **All Customers** - names, contacts, addresses, notes, types
- **All Jobs** - descriptions, statuses, costs, project scopes
- **All Workers** - details, roles, rates, contact info
- **All Work Hours** - time entries, dates, descriptions
- **All Tasks** - job tasks, completion status
- **All Calendar Events** - appointments, schedules
- **All Extra Costs** - additional charges, descriptions
- **All Materials** - job materials, quantities
- **All Job Photos** - file metadata (photos stored separately)
- **All Worker Tasks & Notes** - assignments, performance notes

### **What's NOT Exported:**
- Demo/sample data (filtered out automatically)
- System configuration
- Temporary files
- Actual photo files (only metadata)

## 🚀 Usage Instructions

### **Method 1: Automatic (Recommended)**
1. **Before deployment:** Go to Settings → Click "Export Data"
2. **Deploy to Railway** - The export file is included
3. **First startup:** Data automatically imports
4. **Done!** Your data is restored

### **Method 2: Manual Download**
1. **Export data:** Settings → "Export Data"
2. **Download:** Click "Download Export" 
3. **Deploy:** Upload `data-export.json` to your Railway files
4. **Import:** Settings → "Import Data" (if needed)

## 📋 Step-by-Step Deployment Process

### **Before Deploying:**
```
1. Go to Settings page in your CRM
2. Click "Export Data" button
3. Wait for "Export successful" message
4. (Optional) Click "Download Export" for backup
5. Commit and push your code changes
6. Deploy to Railway
```

### **After Deploying:**
```
1. Railway automatically starts your app
2. App detects data-export.json file
3. Imports all your user data automatically
4. Moves export file to prevent re-import
5. Your CRM is ready with all your data!
```

## 🔧 API Endpoints

- **POST** `/api/data/export` - Export all user data
- **POST** `/api/data/import` - Import data from export file  
- **GET** `/api/data/export/download` - Download export file

## 📁 File Details

### **Export File:** `data-export.json`
- **Location:** Root directory
- **Format:** JSON with timestamp and version
- **Size:** Varies based on data (typically 1-50KB)
- **Auto-cleanup:** Renamed after import to prevent re-processing

### **Example Structure:**
```json
{
  "timestamp": "2025-09-17T04:59:42.123Z",
  "version": "1.0",
  "data": {
    "customers": [...],
    "jobs": [...],
    "workers": [...],
    "work_hours": [...],
    ...
  }
}
```

## ⚠️ Important Notes

### **Data Safety:**
- **Export excludes sample data** automatically
- **Foreign key relationships** preserved
- **Import order** respects database constraints
- **Error handling** prevents partial imports

### **Deployment Tips:**
- Export before every deployment
- Keep export files as backups
- Import only runs once per file
- Check console logs for import status

### **Troubleshooting:**
- **No data after deploy:** Check if export file exists
- **Import failed:** Check console for error messages
- **Partial import:** Foreign key constraint violations
- **Re-import needed:** Manually trigger via Settings

## 🎉 Benefits

✅ **Zero data loss** during deployments
✅ **No sample data pollution** 
✅ **Automatic process** - minimal manual work
✅ **Railway optimized** - works perfectly with Railway's deployment system
✅ **Backup functionality** - export files serve as data backups
✅ **Clean starts** - fresh database every deployment

Your CRM data is now fully protected and preserved across all Railway deployments!