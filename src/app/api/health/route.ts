import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from 'redis';
import { Queue } from 'bullmq';
import { logger } from '@/lib/logger';
import { formatError } from '@/lib/errors';

/**
 * Health check endpoint
 * Verifies database, Redis, and job queue connectivity
 */
export async function GET() {
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`;

    // Check Redis and BullMQ (if Redis is configured)
    if (process.env.REDIS_URL) {
      const redis = createClient({ url: process.env.REDIS_URL });
      await redis.connect();
      await redis.ping();
      await redis.disconnect();

      // Check job queue
      const queue = new Queue('bulk-payroll', { connection: { url: process.env.REDIS_URL } });
      await queue.close();
    }

    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected',
          redis: process.env.REDIS_URL ? 'connected' : 'not_configured',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    const errorResponse = formatError(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}
