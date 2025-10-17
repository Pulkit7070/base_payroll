'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Job {
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
}

export const JobsList: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchJobs();
  }, [page]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/bulk-payroll/jobs?page=${page}&limit=20`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch jobs');
      }

      setJobs(data.jobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
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

  const getProgressPercentage = (job: Job) => {
    if (job.validRows === 0) return 0;
    return Math.round((job.processedRows / job.validRows) * 100);
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading jobs...</div>;
  }

  if (error) {
    return <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div>;
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No jobs yet. Upload a CSV to get started!</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Job ID</th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Progress</th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Rows</th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Created</th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Base Payment</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {jobs.map((job) => (
            <tr key={job.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 text-sm font-mono text-gray-900">{job.id.substring(0, 8)}...</td>
              <td className="px-6 py-4">
                <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(job.status)}`}>
                  {job.status}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="w-32">
                  <div className="mb-1 flex justify-between text-xs text-gray-600">
                    <span>{getProgressPercentage(job)}%</span>
                    <span>
                      {job.processedRows}/{job.validRows}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-blue-600 transition-all"
                      style={{ width: `${getProgressPercentage(job)}%` }}
                    />
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                <div className="space-y-1">
                  <div>✓ {job.validRows}</div>
                  <div className="text-red-600">✗ {job.invalidRows}</div>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {new Date(job.createdAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4">
                <Link
                  href={`/bulk-payroll/jobs/${job.id}`}
                  className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                >
                  Send Base Payment
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-center gap-2">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="rounded border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Previous
        </button>
        <span className="px-4 py-2 text-sm text-gray-600">Page {page}</span>
        <button
          onClick={() => setPage(page + 1)}
          disabled={jobs.length < 20}
          className="rounded border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};
