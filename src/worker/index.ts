import { Worker, Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { FakePaymentsAdapter } from '@/lib/payments-adapter';
import { WorkerLogger } from '@/lib/logger';
import { PaymentRow } from '@/lib/validation';

const prisma = new PrismaClient();
const paymentsAdapter = new FakePaymentsAdapter({
  successRate: 0.8,
  latencyMs: 100,
  seed: 42,
});

// Configuration
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10');
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3');
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Background worker for processing bulk payroll jobs
 * Consumes jobs from BullMQ queue and processes payroll rows in batches
 */
async function startWorker() {
  const queue = new Queue('bulk-payroll', { connection: { url: REDIS_URL } });

  const worker = new Worker(
    'bulk-payroll',
    async (job) => {
      const { jobId, uploaderId } = job.data;
      const logger = new WorkerLogger(jobId);

      try {
        logger.info('Job started', { uploaderId });

        // Fetch job and rows from database
        const dbJob = await prisma.bulkPayrollJob.findUnique({
          where: { id: jobId },
          include: { rows: true },
        });

        if (!dbJob) {
          throw new Error(`Job ${jobId} not found`);
        }

        // Update job status to PROCESSING
        await prisma.bulkPayrollJob.update({
          where: { id: jobId },
          data: {
            status: 'PROCESSING',
            startedAt: new Date(),
          },
        });

        const rows = dbJob.rows;
        let processedCount = 0;
        let successCount = 0;
        let failedCount = 0;

        // Process rows in batches
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          logger.info(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}`, {
            batchSize: batch.length,
            total: rows.length,
          });

          // Process each row in the batch
          const results = await Promise.allSettled(
            batch.map((row) => processPaymentRow(row, logger, MAX_RETRIES))
          );

          // Update database with results
          for (let j = 0; j < results.length; j++) {
            const result = results[j];
            const row = batch[j];

            if (result.status === 'fulfilled') {
              const { success, providerResponse, errorMessage, attempts } = result.value;

              await prisma.bulkPayrollRow.update({
                where: { id: row.id },
                data: {
                  status: success ? 'SUCCESS' : 'FAILED',
                  providerResponse,
                  errorMessage,
                  attempts,
                },
              });

              if (success) {
                successCount++;
              } else {
                failedCount++;
              }
            } else {
              // Handle promise rejection
              logger.error(`Row ${row.rowIndex} processing failed`, result.reason, {
                rowIndex: row.rowIndex,
              });

              await prisma.bulkPayrollRow.update({
                where: { id: row.id },
                data: {
                  status: 'FAILED',
                  errorMessage: result.reason instanceof Error ? result.reason.message : 'Unknown error',
                  attempts: MAX_RETRIES,
                },
              });

              failedCount++;
            }

            processedCount++;
          }

          // Update job progress
          await prisma.bulkPayrollJob.update({
            where: { id: jobId },
            data: {
              processedRows: processedCount,
              failedRows: failedCount,
            },
          });

          logger.info(`Batch completed`, {
            processedCount,
            successCount,
            failedCount,
          });
        }

        // Mark job as completed
        await prisma.bulkPayrollJob.update({
          where: { id: jobId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            processedRows: processedCount,
            failedRows: failedCount,
          },
        });

        logger.info('Job completed successfully', {
          total: rows.length,
          successCount,
          failedCount,
        });

        return { processed: processedCount, succeeded: successCount, failed: failedCount };
      } catch (error) {
        logger.error('Job failed', error);

        // Mark job as failed
        await prisma.bulkPayrollJob.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
          },
        });

        throw error;
      }
    },
    {
      connection: { url: REDIS_URL },
      concurrency: 1,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    await worker.close();
    await queue.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  console.log('Worker started, listening for jobs...');
}

/**
 * Process a single payment row with retry logic
 */
async function processPaymentRow(
  row: any,
  logger: WorkerLogger,
  maxRetries: number
): Promise<{
  success: boolean;
  providerResponse?: any;
  errorMessage?: string;
  attempts: number;
}> {
  let attempts = 0;
  let lastError: Error | null = null;

  while (attempts < maxRetries) {
    try {
      attempts++;

      const normalized = row.normalized as PaymentRow;
      logger.debug(`Processing row ${row.rowIndex}`, { attempt: attempts, rowIndex: row.rowIndex });

      // Call payments adapter
      const result = await paymentsAdapter.createPayment(normalized);

      if (result.success) {
        logger.info(`Row ${row.rowIndex} processed successfully`, {
          rowIndex: row.rowIndex,
          providerId: result.id,
        });
        return {
          success: true,
          providerResponse: result.rawResponse,
          attempts,
        };
      } else {
        lastError = new Error(result.error);
        logger.warn(`Row ${row.rowIndex} payment failed, will retry`, {
          rowIndex: row.rowIndex,
          error: result.error,
          attempt: attempts,
        });
        // Continue to retry
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      logger.warn(`Row ${row.rowIndex} processing error`, {
        rowIndex: row.rowIndex,
        error: lastError.message,
        attempt: attempts,
      });
    }

    // Exponential backoff before retry
    if (attempts < maxRetries) {
      const delay = Math.pow(2, attempts - 1) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  logger.error(`Row ${row.rowIndex} failed after ${maxRetries} attempts`, lastError || new Error('Unknown error'), {
    rowIndex: row.rowIndex,
  });

  return {
    success: false,
    errorMessage: lastError?.message || 'Payment processing failed',
    attempts,
  };
}

// Start worker
startWorker().catch((error) => {
  console.error('Failed to start worker:', error);
  process.exit(1);
});
