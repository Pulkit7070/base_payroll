import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Queue } from 'bullmq';
import { parseCSV, detectColumnMapping, validatePayrollRows } from '@/lib/csv-parser';
import { getUserFromRequest } from '@/lib/auth';
import { formatError, ValidationError as AppValidationError } from '@/lib/errors';
import { logger } from '@/lib/logger';

// Configuration
const MAX_ROWS_PER_UPLOAD = parseInt(process.env.MAX_ROWS_PER_UPLOAD || '5000');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024;

/**
 * POST /api/bulk-payroll/upload
 * Upload and validate a CSV file for batch payroll processing
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await getUserFromRequest(request);

    const contentType = request.headers.get('content-type');

    let csvContent: string;
    let parsedRows: Record<string, string>[];

    // Handle CSV file upload (multipart/form-data)
    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file || !(file instanceof File)) {
        throw new AppValidationError('No file provided', { field: 'file' });
      }

      if (file.size > MAX_FILE_SIZE) {
        throw new AppValidationError(`File size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      }

      csvContent = await file.text();
      const parsed = parseCSV(csvContent);
      parsedRows = parsed.rows;
    }
    // Handle JSON body with pre-parsed rows
    else if (contentType?.includes('application/json')) {
      const body = await request.json();

      if (!Array.isArray(body.rows)) {
        throw new AppValidationError('Invalid request body: rows must be an array');
      }

      parsedRows = body.rows;
      csvContent = JSON.stringify(body.rows);
    } else {
      throw new AppValidationError('Unsupported content type. Use multipart/form-data or application/json');
    }

    if (parsedRows.length === 0) {
      throw new AppValidationError('CSV file is empty');
    }

    if (parsedRows.length > MAX_ROWS_PER_UPLOAD) {
      throw new AppValidationError(`Exceeded maximum rows per upload (${MAX_ROWS_PER_UPLOAD})`);
    }

    // Detect column mapping
    const headers = Object.keys(parsedRows[0]);
    const columnMapping = detectColumnMapping(headers);

    // Validate rows
    const parsed = validatePayrollRows(parsedRows, columnMapping);

    // Check for validation issues
    const errorSummary = [
      ...parsed.invalidRows.slice(0, 10).map((r) => ({
        rowIndex: r.rowIndex,
        errors: r.errors.map((e) => e.error).join('; '),
      })),
      ...parsed.duplicates.slice(0, 10).map((r) => ({
        rowIndex: r.rowIndex,
        error: `Duplicate of row ${r.duplicateOf}`,
      })),
    ];

    // Create BulkPayrollJob record
    const job = await prisma.bulkPayrollJob.create({
      data: {
        uploaderId: user.userId,
        status: 'QUEUED',
        totalRows: parsed.totalRows,
        validRows: parsed.validRows.length,
        invalidRows: parsed.invalidRows.length + parsed.duplicates.length,
        rawPayload: JSON.stringify({
          headers: parsed.headers,
          columnMapping,
          validRowsPreview: parsed.validRows.slice(0, 10),
        }),
        errorSummary: JSON.stringify(errorSummary),
      },
    });

    // Create BulkPayrollRow records for valid rows
    const rowsToCreate = parsed.validRows.map((row, idx) => ({
      jobId: job.id,
      rowIndex: idx,
      input: JSON.stringify(parsedRows[idx]),
      normalized: JSON.stringify(row),
      status: 'PENDING' as const,
    }));

    if (rowsToCreate.length > 0) {
      await prisma.bulkPayrollRow.createMany({
        data: rowsToCreate,
      });
    }

    // Enqueue job in BullMQ
    if (process.env.REDIS_URL) {
      const queue = new Queue('bulk-payroll', { connection: { url: process.env.REDIS_URL } });
      await queue.add(
        'process-payroll',
        { jobId: job.id, uploaderId: user.userId },
        {
          attempts: 1,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 3600 },
          removeOnFail: { age: 86400 },
        }
      );
      await queue.close();
    }

    logger.info(
      {
        jobId: job.id,
        uploaderId: user.userId,
        validRows: parsed.validRows.length,
        invalidRows: parsed.invalidRows.length,
        duplicates: parsed.duplicates.length,
      },
      'Bulk payroll job created'
    );

    return NextResponse.json(
      {
        jobId: job.id,
        totalRows: parsed.totalRows,
        validRows: parsed.validRows.length,
        invalidRows: parsed.invalidRows.length + parsed.duplicates.length,
        message: 'Job queued for processing',
        errorSummary: errorSummary.slice(0, 20),
      },
      { status: 202 }
    );
  } catch (error) {
    logger.error({ error }, 'Upload failed');
    const errorResponse = formatError(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}
