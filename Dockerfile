FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create data directory for SQLite (persistent volume)
RUN mkdir -p /app/data && chmod 777 /app/data

# Expose port
EXPOSE 3001

# Set environment variable for production
ENV NODE_ENV=production
ENV PORT=3001

# Start the application
CMD ["npm", "start"]
