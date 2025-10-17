import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Queue } from 'bullmq';
import { getUserFromRequest } from '@/lib/auth';
import { formatError, NotFoundError } from '@/lib/errors';

/**
 * GET /api/bulk-payroll/jobs/:id
 * Get detailed information about a specific bulk payroll job
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(request);
    const jobId = params.id;

    const job = await prisma.bulkPayrollJob.findUnique({
      where: { id: jobId },
      include: {
        rows: {
          select: {
            id: true,
            rowIndex: true,
            status: true,
            attempts: true,
            errorMessage: true,
            providerResponse: true,
            normalized: true,
          },
          orderBy: { rowIndex: 'asc' },
        },
      },
    });

    if (!job) {
      throw new NotFoundError('Job');
    }

    if (job.uploaderId !== user.userId) {
      throw new NotFoundError('Job');
    }

    return NextResponse.json(
      {
        id: job.id,
        status: job.status,
        totalRows: job.totalRows,
        validRows: job.validRows,
        invalidRows: job.invalidRows,
        processedRows: job.processedRows,
        failedRows: job.failedRows,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        rows: job.rows.map((r) => ({
          id: r.id,
          rowIndex: r.rowIndex,
          status: r.status,
          attempts: r.attempts,
          errorMessage: r.errorMessage,
          providerResponse: r.providerResponse,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    const errorResponse = formatError(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

/**
 * POST /api/bulk-payroll/jobs/:id/cancel
 * Cancel a queued or processing bulk payroll job
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(request);
    const jobId = params.id;

    const job = await prisma.bulkPayrollJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundError('Job');
    }

    if (job.uploaderId !== user.userId) {
      throw new NotFoundError('Job');
    }

    if (!['QUEUED', 'PROCESSING'].includes(job.status)) {
      return NextResponse.json(
        {
          code: 'INVALID_STATE',
          message: `Cannot cancel job with status ${job.status}`,
          statusCode: 409,
          timestamp: new Date().toISOString(),
        },
        { status: 409 }
      );
    }

    // Remove from queue if still queued
    if (job.status === 'QUEUED' && process.env.REDIS_URL) {
      const queue = new Queue('bulk-payroll', { connection: { url: process.env.REDIS_URL } });
      const jobs = await queue.getJobs(['active', 'waiting', 'delayed']);
      for (const queuedJob of jobs) {
        if (queuedJob.data.jobId === jobId) {
          await queuedJob.remove();
        }
      }
      await queue.close();
    }

    // Update job status
    const updatedJob = await prisma.bulkPayrollJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json(
      {
        id: updatedJob.id,
        status: updatedJob.status,
        message: 'Job cancelled successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    const errorResponse = formatError(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}
