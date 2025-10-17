# Bulk Payroll - Complete Setup Guide

## Overview

This guide walks you through setting up and running the Bulk Payroll Management System locally for development.

## System Requirements

- **Node.js**: 18.0 or higher
- **npm**: 8.0 or higher
- **Docker & Docker Compose**: Latest versions
- **Git**: For version control
- **4GB RAM minimum**: For running all services
- **macOS, Linux, or Windows** (with WSL2 recommended for Windows)

## Step 1: Clone and Install

```bash
# Navigate to your workspace
cd ~/Desktop/project

# Install dependencies
npm install
```

## Step 2: Setup PostgreSQL and Redis

### Option A: Using Docker Compose (Recommended for Development)

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Verify services are running
docker-compose ps

# Expected output:
# NAME                    STATUS
# bulk_payroll_db         Up
# bulk_payroll_redis      Up
```

Check database connection:

```bash
docker-compose exec postgres psql -U user -d bulk_payroll_dev -c "SELECT 1"
```

Check Redis connection:

```bash
docker-compose exec redis redis-cli ping
# Should respond: PONG
```

### Option B: Manual Installation

If you prefer to install locally:

**PostgreSQL:**

- macOS: `brew install postgresql`
- Linux: `sudo apt-get install postgresql`
- Windows: Download from postgresql.org

**Redis:**

- macOS: `brew install redis`
- Linux: `sudo apt-get install redis-server`
- Windows: Use WSL2 with `apt-get install redis-server`

## Step 3: Configure Environment Variables

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your configuration
# For local development with Docker Compose, defaults should work
```

Verify these settings for local development:

```bash
# Database (with docker-compose)
DATABASE_URL="postgresql://user:password@localhost:5432/bulk_payroll_dev"

# Redis (with docker-compose)
REDIS_URL="redis://localhost:6379"

# Auth (development)
JWT_SECRET="dev-secret-change-in-production"

# Processing
MAX_ROWS_PER_UPLOAD=5000
MAX_FILE_SIZE_MB=10
BATCH_SIZE=10
MAX_RETRIES=3

# Environment
NODE_ENV="development"
LOG_LEVEL="info"
```

## Step 4: Setup Database

### Run Migrations

```bash
npm run migrate:dev
```

This will:

- Create database schema
- Generate Prisma client
- Create necessary tables and indexes

### Seed Test Data

```bash
npm run db:seed
```

This creates:

- Admin user: `admin@example.com`
- Regular user: `user@example.com`
- Sample job for testing

### Access Database (Optional)

```bash
# Open Prisma Studio
npm run db:studio

# Runs on http://localhost:5555
```

## Step 5: Run the Application

### Terminal 1: Next.js Development Server

```bash
npm run dev
```

Output should show:

```
ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

Access at: **http://localhost:3000/bulk-payroll**

### Terminal 2: Background Worker

```bash
npm run worker
```

Output should show:

```
Worker started, listening for jobs...
```

Keep this running in the background - it processes queued payroll jobs.

## Step 6: Verify Setup

### Check Health Endpoint

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{
  "status": "ok",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### Test File Upload

1. Open http://localhost:3000/bulk-payroll
2. Download sample CSV: `sample-payroll.csv`
3. Drag and drop onto upload area
4. Click "Continue" to preview validation
5. Click "Submit for Processing"

## Step 7: Running Tests

### Unit Tests

```bash
npm run test

# Watch mode (re-run on file changes)
npm run test:watch

# With coverage
npm run test -- --coverage
```

### API Integration Tests

```bash
npm run test -- api.test.ts
```

### E2E Tests

```bash
# With UI (interactive mode)
npm run e2e:ui

# Headless (CI mode)
npm run e2e
```

## Troubleshooting

### Issue: PostgreSQL Connection Failed

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**

```bash
# Verify Docker container is running
docker-compose ps postgres

# If not running, start it
docker-compose up -d postgres

# Wait 10 seconds for PostgreSQL to be ready
sleep 10

# Test connection
psql postgresql://user:password@localhost:5432/bulk_payroll_dev -c "SELECT 1"
```

### Issue: Redis Connection Failed

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**

```bash
# Verify Redis container is running
docker-compose ps redis

# If not running, start it
docker-compose up -d redis

# Test connection
redis-cli ping
# Should respond: PONG
```

### Issue: Port 3000 Already in Use

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use different port
PORT=3001 npm run dev
```

### Issue: Worker Not Processing Jobs

```bash
# Check if worker is running
ps aux | grep "npm run worker"

# Check Redis queue
redis-cli -u redis://localhost:6379
> KEYS "bull*"

# Restart worker
npm run worker
```

### Issue: Database Migrations Failed

```bash
# Reset database (WARNING: clears all data)
npm run migrate:dev -- --skip-seed

# Re-seed
npm run db:seed
```

### Issue: Next.js Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build

# Or restart dev server
npm run dev
```

## Development Workflow

### Making Code Changes

1. **Modify source files** in `src/`
2. **Server-side changes** automatically reload (Next.js)
3. **Worker changes** require restart (run `npm run worker` again)
4. **Database schema changes** require migration:
   ```bash
   # Modify prisma/schema.prisma
   npm run migrate:dev
   ```

### Creating Migrations

```bash
# After updating prisma/schema.prisma
npm run migrate:dev

# Name your migration when prompted (e.g., "add_new_field")
```

### Testing Locally

```bash
# Run all tests
npm test

# Run specific test file
npm test -- validation.test.ts

# Run with watch mode
npm test -- --watch

# Run only E2E tests
npm run e2e
```

## Stopping Services

```bash
# Stop Next.js dev server
# Press Ctrl+C in Terminal 1

# Stop worker
# Press Ctrl+C in Terminal 2

# Stop Docker containers
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

## Next Steps

1. **Read the README.md** for API documentation and feature details
2. **Upload sample CSV** to test the full workflow
3. **View job processing** in real-time
4. **Explore the codebase** - well-commented and organized
5. **Run the tests** to understand expected behavior
6. **Customize for your needs** - see TODO sections in code

## Common Development Tasks

### Add New API Endpoint

1. Create new file: `src/app/api/bulk-payroll/[feature]/route.ts`
2. Implement handler (GET, POST, etc.)
3. Add tests in `src/__tests__/`
4. Update documentation

### Add New Component

1. Create file: `src/components/bulk-payroll/YourComponent.tsx`
2. Use TypeScript with proper types
3. Add tests if complex logic
4. Import in page file

### Modify Database Schema

1. Edit `prisma/schema.prisma`
2. Run `npm run migrate:dev`
3. Test changes locally
4. Update related types if needed

### Debug Issues

```bash
# Check logs
docker-compose logs postgres
docker-compose logs redis

# Enable debug logging
LOG_LEVEL=debug npm run dev

# Use Prisma Studio
npm run db:studio
```

## Production Deployment

See **README.md** for:

- Docker deployment
- Environment configuration
- Security checklist
- Monitoring setup

## Support

For issues or questions:

1. Check the README.md for API documentation
2. Review error messages - they're detailed
3. Check logs: `npm run dev` output, Docker logs
4. Consult troubleshooting section above

## Architecture Overview

```
┌─────────────────────────────────────┐
│     Next.js App (Port 3000)         │
│  ┌─────────────────────────────────┐│
│  │  Frontend (React + Tailwind)     ││
│  │  /bulk-payroll                   ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │  API Routes                      ││
│  │  /api/bulk-payroll/*             ││
│  └─────────────────────────────────┘│
└──────────────┬──────────────────────┘
               │
         ┌─────┴──────┬──────────────┐
         │            │              │
    ┌────▼────┐  ┌────▼────┐  ┌────▼─────┐
    │PostgreSQL│  │  Redis  │  │   Worker │
    │ Database │  │  Queue  │  │ Process  │
    └──────────┘  └─────────┘  └──────────┘
```

**Data Flow:**

1. User uploads CSV on frontend
2. API validates and creates BulkPayrollJob record
3. Job enqueued to Redis via BullMQ
4. Worker consumes job, processes payments in batches
5. Results persisted to database in real-time
6. Frontend polls for status updates

Happy developing! 🚀
