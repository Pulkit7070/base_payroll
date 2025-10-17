'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface JobDetail {
  id: string;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  processedRows: number;
  failedRows: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  rows: Array<{
    id: string;
    rowIndex: number;
    status: string;
    attempts: number;
    errorMessage?: string;
    providerResponse?: any;
  }>;
}

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchJob();
  }, [params.id]);

  useEffect(() => {
    if (!autoRefresh || !job || ['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) {
      return;
    }

    const interval = setInterval(fetchJob, 2000);
    return () => clearInterval(interval);
  }, [autoRefresh, job]);

  const fetchJob = async () => {
    try {
      const response = await fetch(`/api/bulk-payroll/jobs/${params.id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch job');
      }

      setJob(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch job');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800';
      case 'QUEUED':
        return 'bg-yellow-100 text-yellow-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-gray-600">Loading job details...</div>
      </main>
    );
  }

  if (error || !job) {
    return (
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4">
          <Link href="/bulk-payroll" className="text-blue-600 hover:text-blue-900 mb-4 inline-block">
            ← Back to Jobs
          </Link>
          <div className="rounded-lg bg-red-50 p-4 text-red-600">{error || 'Job not found'}</div>
        </div>
      </main>
    );
  }

  const progressPercentage = job.validRows > 0 ? Math.round((job.processedRows / job.validRows) * 100) : 0;

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4">
        <Link href="/bulk-payroll" className="text-blue-600 hover:text-blue-900 mb-4 inline-block">
          ← Back to Jobs
        </Link>

        <div className="rounded-lg bg-white p-6 shadow mb-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Job {job.id.substring(0, 8)}</h1>
            <span className={`inline-block rounded-full px-4 py-2 font-medium ${getJobStatusColor(job.status)}`}>
              {job.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div>
              <div className="text-sm text-gray-600">Total Rows</div>
              <div className="text-2xl font-bold text-gray-900">{job.totalRows}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Valid Rows</div>
              <div className="text-2xl font-bold text-green-600">{job.validRows}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Invalid Rows</div>
              <div className="text-2xl font-bold text-red-600">{job.invalidRows}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Processed</div>
              <div className="text-2xl font-bold text-blue-600">
                {job.processedRows}/{job.validRows}
              </div>
            </div>
          </div>

          {job.validRows > 0 && (
            <div className="mt-6">
              <div className="mb-2 flex justify-between">
                <span className="text-sm font-medium text-gray-700">Processing Progress</span>
                <span className="text-sm font-medium text-gray-700">{progressPercentage}%</span>
              </div>
              <div className="h-3 rounded-full bg-gray-200">
                <div
                  className="h-3 rounded-full bg-blue-600 transition-all"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-4 text-sm text-gray-600 md:grid-cols-4">
            <div>
              <span className="block font-medium">Created</span>
              {new Date(job.createdAt).toLocaleString()}
            </div>
            {job.startedAt && (
              <div>
                <span className="block font-medium">Started</span>
                {new Date(job.startedAt).toLocaleString()}
              </div>
            )}
            {job.completedAt && (
              <div>
                <span className="block font-medium">Completed</span>
                {new Date(job.completedAt).toLocaleString()}
              </div>
            )}
          </div>

          {['PROCESSING', 'QUEUED'].includes(job.status) && (
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`rounded px-4 py-2 font-medium ${
                  autoRefresh
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {autoRefresh ? '⏸ Stop Auto-Refresh' : '▶ Start Auto-Refresh'}
              </button>
            </div>
          )}
        </div>

        {job.rows.length > 0 && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-bold text-gray-900">Payment Rows</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Row #</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Attempts</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Error Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {job.rows.slice(0, 50).map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{row.rowIndex}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{row.attempts}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{row.errorMessage || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {job.rows.length > 50 && (
              <p className="mt-4 text-sm text-gray-600">Showing 50 of {job.rows.length} rows</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
