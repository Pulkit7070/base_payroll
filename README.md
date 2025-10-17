# Bulk Payroll Management System

A production-ready Next.js application for managing bulk payroll uploads, validation, and payment processing with background job queuing.

## Features

- **CSV Upload & Validation**: Drag-and-drop CSV upload with client and server-side validation
- **Column Auto-Detection**: Intelligently detects and maps CSV columns to payroll fields
- **Batch Processing**: Background job queue processes payments in configurable batches
- **Retry Logic**: Automatic retry with exponential backoff for failed transactions
- **Real-time Progress Tracking**: Live job status and processing progress
- **Provider Abstraction**: Pluggable payment provider interface (Stripe, Paystack, Bank APIs)
- **Comprehensive Validation**: Zod-based schema validation with detailed error messages
- **Job History**: Full audit trail and job management interface

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js 18+
- **Database**: PostgreSQL with Prisma ORM
- **Job Queue**: BullMQ with Redis
- **Validation**: Zod
- **Testing**: Jest, Supertest, Playwright
- **Logging**: Pino

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── bulk-payroll/
│   │       ├── upload/route.ts        # CSV upload endpoint
│   │       ├── health/route.ts        # Health check
│   │       └── jobs/
│   │           ├── route.ts           # List jobs
│   │           └── [id]/route.ts      # Job detail & cancel
│   ├── bulk-payroll/
│   │   ├── page.tsx                   # Main page
│   │   └── jobs/[id]/page.tsx         # Job detail page
│   └── globals.css
├── components/
│   └── bulk-payroll/
│       ├── CSVUploadForm.tsx          # Upload & validation UI
│       └── JobsListComponent.tsx      # Jobs list table
├── lib/
│   ├── validation.ts                  # Zod schemas
│   ├── csv-parser.ts                  # CSV parsing & utilities
│   ├── payments-adapter.ts            # Payment provider interface
│   ├── auth.ts                        # JWT auth middleware
│   ├── logger.ts                      # Logging utility
│   └── errors.ts                      # Error types & formatting
├── worker/
│   └── index.ts                       # Background worker process
├── db/
│   └── seed.ts                        # Database seeding
└── __tests__/
    ├── validation.test.ts             # Validation tests
    ├── api.test.ts                    # API integration tests
    ├── worker.test.ts                 # Worker logic tests
    └── e2e/
        └── bulk-payroll.spec.ts       # E2E workflow test
```

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose (for local PostgreSQL and Redis)
- npm or yarn

### 1. Setup Environment

```bash
# Copy environment template
cp .env.example .env.local

# Update .env.local with your configuration (Database, Redis URLs)
```

### 2. Start Services

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Wait for services to be ready
docker-compose ps
```

### 3. Setup Database

```bash
# Run migrations
npm run migrate:dev

# Seed test users and sample data
npm run db:seed
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run Application

In separate terminals:

```bash
# Terminal 1: Start Next.js dev server
npm run dev

# Terminal 2: Start background worker
npm run worker

# Access app at http://localhost:3000
```

### 6. Test

```bash
# Unit and integration tests
npm run test

# End-to-end tests (requires app running)
npm run e2e

# E2E with UI
npm run e2e:ui
```

## CSV Schema

### Required Fields

- **employee_id** (optional) - Employee identifier (3-64 alphanumeric characters, hyphens, underscores)
  OR
- **employee_email** (optional) - Valid email address

  ⚠️ **At least one of employee_id or employee_email must be provided per row**

- **amount** (required) - Payment amount

  - Range: > 0 and ≤ 1,000,000
  - Decimal places: max 2
  - Example: 1500.50

- **currency** (required) - ISO 4217 currency code

  - Format: 3-letter code (e.g., USD, EUR, GBP)
  - Case-insensitive (auto-normalized to uppercase)

- **pay_date** (required) - Payment date
  - Format: YYYY-MM-DD
  - Range: -30 days to +365 days from today
  - Example: 2025-11-01

### Optional Fields

- **description** (optional) - Payment description

  - Max length: 255 characters
  - Example: "November salary"

- **external_reference** (optional) - External reference ID
  - Max length: unlimited
  - Example: "REF-202511-001"

### Example CSV

```csv
employee_email,amount,currency,pay_date,description,external_reference
jane.doe@example.com,1500.00,USD,2025-11-01,November salary,REF-202511
john.smith@example.com,2000.50,EUR,2025-11-05,Bonus,REF-202511-B
EMP001,1200.00,GBP,2025-11-01,Regular salary,REF-202511-EMP001
```

## API Endpoints

### Upload CSV

**POST** `/api/bulk-payroll/upload`

Accepts either multipart CSV file or JSON body with parsed rows.

**Request (Form Data):**

```bash
curl -X POST http://localhost:3000/api/bulk-payroll/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@payroll.csv"
```

**Request (JSON):**

```json
{
  "rows": [
    {
      "employee_email": "jane@example.com",
      "amount": 1500.0,
      "currency": "USD",
      "pay_date": "2025-11-01",
      "description": "November salary"
    }
  ]
}
```

**Response (202 Accepted):**

```json
{
  "jobId": "abc123xyz",
  "totalRows": 100,
  "validRows": 95,
  "invalidRows": 5,
  "message": "Job queued for processing",
  "errorSummary": [
    {
      "rowIndex": 5,
      "errors": "Invalid email format"
    }
  ]
}
```

### List Jobs

**GET** `/api/bulk-payroll/jobs?page=1&limit=20`

**Response:**

```json
{
  "jobs": [
    {
      "id": "abc123xyz",
      "status": "PROCESSING",
      "totalRows": 100,
      "validRows": 95,
      "invalidRows": 5,
      "processedRows": 45,
      "failedRows": 2,
      "createdAt": "2025-10-17T10:00:00Z",
      "startedAt": "2025-10-17T10:00:05Z",
      "completedAt": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

### Get Job Details

**GET** `/api/bulk-payroll/jobs/:id`

**Response:**

```json
{
  "id": "abc123xyz",
  "status": "COMPLETED",
  "totalRows": 10,
  "validRows": 8,
  "invalidRows": 2,
  "processedRows": 8,
  "failedRows": 1,
  "rows": [
    {
      "id": "row-1",
      "rowIndex": 0,
      "status": "SUCCESS",
      "attempts": 1,
      "errorMessage": null,
      "providerResponse": {
        "id": "provider-txn-123",
        "status": "completed"
      }
    }
  ]
}
```

### Cancel Job

**POST** `/api/bulk-payroll/jobs/:id/cancel`

Only works for QUEUED or PROCESSING status.

**Response (200 OK):**

```json
{
  "id": "abc123xyz",
  "status": "CANCELLED",
  "message": "Job cancelled successfully"
}
```

### Health Check

**GET** `/api/health`

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-10-17T10:00:00Z",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

## Error Response Format

All errors follow a consistent structure:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "CSV file is empty",
  "statusCode": 400,
  "details": {
    "field": "file",
    "hint": "Please provide a non-empty CSV file"
  },
  "timestamp": "2025-10-17T10:00:00Z"
}
```

### Common Error Codes

| Code               | Status | Description                       |
| ------------------ | ------ | --------------------------------- |
| `VALIDATION_ERROR` | 400    | Input validation failed           |
| `UNAUTHORIZED`     | 401    | Missing or invalid authentication |
| `NOT_FOUND`        | 404    | Resource not found                |
| `CONFLICT`         | 409    | Invalid state for operation       |
| `RATE_LIMIT`       | 429    | Too many requests                 |
| `INTERNAL_ERROR`   | 500    | Server error                      |

## Configuration

Key environment variables (see `.env.example` for complete list):

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/bulk_payroll"

# Redis & Job Queue
REDIS_URL="redis://localhost:6379"

# Authentication
JWT_SECRET="your-secret-key"

# Processing
MAX_ROWS_PER_UPLOAD=5000
MAX_FILE_SIZE_MB=10
BATCH_SIZE=10
MAX_RETRIES=3

# Logging
LOG_LEVEL="info"
```

## Background Worker

The worker process consumes jobs from the queue and processes payment rows.

### Features

- **Batch Processing**: Processes rows in configurable batches (default: 10)
- **Retry Logic**: Failed payments retry up to N times with exponential backoff
- **Graceful Shutdown**: Handles SIGTERM/SIGINT for clean shutdown
- **Job Locking**: Prevents duplicate processing
- **Real-time Updates**: Updates job status and row results in database

### Running the Worker

```bash
# Development
npm run worker

# Production (after building)
node dist/worker.js
```

### Worker Configuration

```bash
BATCH_SIZE=10          # Rows to process in parallel
MAX_RETRIES=3          # Retry attempts for failed payments
REDIS_URL=redis://...  # Job queue connection
```

## Payments Adapter

The system uses a pluggable payment provider adapter pattern for flexibility.

### Interface

```typescript
interface PaymentsAdapter {
  createPayment(input: PaymentRow): Promise<PaymentResult>;
}

interface PaymentResult {
  success: boolean;
  id?: string; // Provider transaction ID
  error?: string; // Error message if failed
  rawResponse?: unknown; // Full provider response
}
```

### Fake Adapter (Testing)

The default `FakePaymentsAdapter` simulates payment processing with:

- **Deterministic Success Rate**: 80% by default (configurable)
- **Seeded RNG**: Reproducible results for tests
- **Simulated Latency**: Configurable delay (default: 100ms)
- **Random Failures**: Realistic error messages

```typescript
const adapter = new FakePaymentsAdapter({
  successRate: 0.8,
  latencyMs: 100,
  seed: 42,
});
```

### Adding a Real Provider

Example: Implementing a Stripe adapter

```typescript
import Stripe from "stripe";

export class StripePaymentsAdapter implements PaymentsAdapter {
  constructor(private stripe: Stripe) {}

  async createPayment(input: PaymentRow): Promise<PaymentResult> {
    try {
      const transfer = await this.stripe.transfers.create({
        amount: Math.round(input.amount * 100),
        currency: input.currency.toLowerCase(),
        destination: input.stripe_account_id,
        description: input.description,
      });

      return {
        success: true,
        id: transfer.id,
        rawResponse: transfer,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        rawResponse: error,
      };
    }
  }
}
```

## Database Schema

### Users

```prisma
model User {
  id    String @id @default(cuid())
  email String @unique
  name  String
  role  UserRole @default(USER)
  bulkPayrollJobs BulkPayrollJob[]
}
```

### Bulk Payroll Jobs

```prisma
model BulkPayrollJob {
  id            String @id @default(cuid())
  uploaderId    String
  status        BulkPayrollJobStatus
  totalRows     Int
  validRows     Int
  invalidRows   Int
  processedRows Int @default(0)
  failedRows    Int @default(0)
  rawPayload    Json
  errorSummary  Json?
  startedAt     DateTime?
  completedAt   DateTime?
  createdAt     DateTime @default(now())
  rows          BulkPayrollRow[]

  @@index([uploaderId])
  @@index([status])
}
```

### Bulk Payroll Rows

```prisma
model BulkPayrollRow {
  id               String @id @default(cuid())
  jobId            String
  rowIndex         Int
  input            Json       // Raw CSV row
  normalized       Json?      // Validated data
  status           BulkPayrollRowStatus
  attempts         Int @default(0)
  maxRetries       Int @default(3)
  providerResponse Json?
  errorMessage     String?

  @@unique([jobId, rowIndex])
  @@index([jobId])
  @@index([status])
}
```

## Testing

### Unit Tests

Test individual functions and schemas:

```bash
npm run test -- validation.test.ts
```

### Integration Tests

Test API endpoints with database:

```bash
npm run test -- api.test.ts
```

### Worker Tests

Test background job processing:

```bash
npm run test -- worker.test.ts
```

### E2E Tests

Full workflow tests with Playwright:

```bash
npm run e2e
npm run e2e:ui    # Interactive mode
```

## Security Considerations

### Authentication

Currently uses a JWT stub for development. For production:

- Implement proper JWT token issuing (via dedicated auth service)
- Validate tokens on all protected endpoints
- Implement token refresh mechanisms
- Store secrets in secure vaults (AWS Secrets Manager, HashiCorp Vault)

```typescript
// TODO: Implement production auth
// Consider: Auth0, Cognito, custom auth service
```

### Rate Limiting

Currently not implemented. For production, add:

```typescript
// TODO: Add rate limiting middleware
// Consider: redis-rate-limit, express-rate-limit
// Recommended: 5 uploads per user per minute
```

### Sensitive Data

- Do NOT log payment details, amounts, or personal info
- Sanitize error messages before sending to client
- Use HTTPS in production
- Implement audit logging for all payroll operations

### File Upload Security

- Maximum file size: 10 MB (configurable)
- Maximum rows per upload: 5000 (configurable)
- Validate file type and content
- Scan for malicious content if using external uploads

## Deployment

### Docker

Build and run in Docker:

```bash
docker build -t bulk-payroll .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  bulk-payroll
```

### Docker Compose (Development)

```bash
docker-compose up

# In another terminal
npm run migrate:dev
npm run db:seed
```

### Production Checklist

- [ ] Set strong `JWT_SECRET`
- [ ] Configure production PostgreSQL (managed service recommended)
- [ ] Configure production Redis (managed service recommended)
- [ ] Enable HTTPS
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation (e.g., ELK stack)
- [ ] Set up backups for database
- [ ] Implement rate limiting
- [ ] Review and update security policies
- [ ] Set environment to `production`
- [ ] Run tests before deployment

## Troubleshooting

### Connection Errors

**Database connection failed:**

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Verify DATABASE_URL in .env.local
# Format: postgresql://user:password@host:port/database
```

**Redis connection failed:**

```bash
# Check Redis is running
docker-compose ps redis

# Test connection
redis-cli -u redis://localhost:6379 ping
```

### Worker Not Processing Jobs

```bash
# Check worker is running
ps aux | grep worker

# Check Redis queue
redis-cli -u redis://localhost:6379
> KEYS bulk-payroll*
```

### Tests Failing

```bash
# Reset database for tests
npm run migrate:dev -- --skip-seed

# Run specific test
npm run test -- --testNamePattern="CSV Validation"
```

## Contributing

1. Create a feature branch
2. Make changes with tests
3. Run tests: `npm test && npm run e2e`
4. Submit pull request

## TODO / Future Improvements

- [ ] Production-grade authentication (Auth0, Cognito, etc.)
- [ ] Rate limiting middleware
- [ ] Email notifications on job completion
- [ ] Bulk job retry interface
- [ ] Advanced filtering and search for jobs
- [ ] Webhook callbacks to external systems
- [ ] Multi-tenant support
- [ ] Real payment provider integrations (Stripe, Paystack)
- [ ] Advanced monitoring dashboard
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Mobile app for job monitoring

## License

MIT

## Support

For issues and questions, please refer to the documentation or open an issue.
