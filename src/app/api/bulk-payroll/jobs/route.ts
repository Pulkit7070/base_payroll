import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { formatError } from '@/lib/errors';

/**
 * GET /api/bulk-payroll/jobs
 * List bulk payroll jobs for the authenticated user with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '20'));
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      prisma.bulkPayrollJob.findMany({
        where: { uploaderId: user.userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              rows: true,
            },
          },
        },
      }),
      prisma.bulkPayrollJob.count({
        where: { uploaderId: user.userId },
      }),
    ]);

    const pages = Math.ceil(total / limit);

    return NextResponse.json(
      {
        jobs: jobs.map((j) => ({
          id: j.id,
          status: j.status,
          totalRows: j.totalRows,
          validRows: j.validRows,
          invalidRows: j.invalidRows,
          processedRows: j.processedRows,
          failedRows: j.failedRows,
          createdAt: j.createdAt,
          startedAt: j.startedAt,
          completedAt: j.completedAt,
        })),
        pagination: {
          page,
          limit,
          total,
          pages,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const errorResponse = formatError(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}
