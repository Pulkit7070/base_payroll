'use client';

import React, { useState, useEffect } from 'react';

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
    const interval = setInterval(fetchJobs, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [page]);

  const fetchJobs = async () => {
    try {
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
    if (job.totalRows === 0) return 0;
    return Math.round(((job.processedRows + job.failedRows) / job.totalRows) * 100);
  };

  if (loading && jobs.length === 0) {
    return <div className="text-center py-8">Loading jobs...</div>;
  }

  if (error) {
    return <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div>;
  }

  if (jobs.length === 0) {
    return <div className="text-center py-8 text-gray-600">No jobs found. Upload a CSV to get started.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        {jobs.map((job) => (
          <div key={job.id} className="rounded-lg border border-gray-200 p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Job {job.id.substring(0, 8)}</h3>
                <p className="text-sm text-gray-500">
                  Created {new Date(job.createdAt).toLocaleDateString()} at{' '}
                  {new Date(job.createdAt).toLocaleTimeString()}
                </p>
              </div>
              <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(job.status)}`}>
                {job.status}
              </span>
            </div>

            <div className="mb-4 grid grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-bold text-gray-900">{job.totalRows}</div>
                <div className="text-sm text-gray-600">Total Rows</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{job.validRows}</div>
                <div className="text-sm text-gray-600">Valid</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{job.invalidRows}</div>
                <div className="text-sm text-gray-600">Invalid</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{job.processedRows}</div>
                <div className="text-sm text-gray-600">Processed</div>
              </div>
            </div>

            {job.status === 'PROCESSING' && (
              <div className="mb-4">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium">Progress</span>
                  <span>{getProgressPercentage(job)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-blue-600 transition-all"
                    style={{ width: `${getProgressPercentage(job)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <a
                href={`/bulk-payroll/jobs/${job.id}`}
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                View Details
              </a>
              {job.status === 'QUEUED' && (
                <button className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">Cancel</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="rounded border border-gray-300 px-4 py-2 disabled:bg-gray-100"
        >
          Previous
        </button>
        <span className="px-4 py-2">Page {page}</span>
        <button
          onClick={() => setPage(page + 1)}
          disabled={jobs.length < 20}
          className="rounded border border-gray-300 px-4 py-2 disabled:bg-gray-100"
        >
          Next
        </button>
      </div>
    </div>
  );
};
