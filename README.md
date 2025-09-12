# KHS Simple CRM

A clean, reliable CRM system for KHS Construction & Remodeling built with Node.js, Express, and SQLite.

## Features

- **Customer Management**: Track current customers and leads
- **Job Management**: Organize jobs with status tracking
- **Mobile-First**: Responsive design for field workers
- **Offline-Ready**: SQLite database with local storage
- **Simple Authentication**: Secure login system
- **Easy Deployment**: Ready for Railway hosting

## Quick Start (Local)

```bash
npm install
npm start
```

Visit `http://localhost:3001` and login with:
- **Email**: admin@khscrm.com  
- **Password**: admin123

## Deploy to Railway

### Option 1: Via GitHub (Recommended)

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/KBH222/khs-simple-crm.git
   git push -u origin main
   ```

2. **Deploy on Railway**:
   - Go to [railway.app](https://railway.app)
   - Click "Deploy from GitHub repo"
   - Select your repository
   - Railway will auto-detect and deploy!

### Option 2: Railway CLI

```bash
npm install -g @railway/cli
railway login
railway link
railway up
```

## Environment Variables (Railway)

Railway will automatically set:
- `PORT` - Railway assigns this
- `NODE_ENV` - Set to `production`

## Database

Uses SQLite with automatic table creation. No external database setup required!

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: SQLite3
- **Authentication**: bcryptjs + express-session  
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Deployment**: Railway

## Architecture

```
simple-crm/
├── server.js          # Main server file
├── public/            # Frontend files
├── crm.db             # SQLite database (auto-created)
├── railway.json       # Railway config
├── Dockerfile         # Container config
└── package.json       # Dependencies
```

## API Endpoints

- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration  
- `GET /api/customers` - List customers
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer
- `GET /api/jobs` - List jobs
- `POST /api/jobs` - Create job

## Contributing

This is a private project for KHS Construction & Remodeling.

## License

Private - All rights reserved.
