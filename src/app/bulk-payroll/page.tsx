'use client';

import React, { useState, useCallback } from 'react';
import { CSVUploadForm } from '@/components/bulk-payroll/CSVUploadForm';
import { JobsList } from '@/components/bulk-payroll/JobsListComponent';

type Tab = 'upload' | 'jobs';

export default function BulkPayrollPage() {
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleUploadSuccess = useCallback(() => {
    setUploadSuccess(true);
    setActiveTab('jobs');
    // Clear success message after 5 seconds
    setTimeout(() => setUploadSuccess(false), 5000);
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Bulk Payroll Management</h1>
          <p className="mt-2 text-lg text-gray-600">
            Upload, validate, and process batch payroll payments
          </p>
        </div>

        {uploadSuccess && (
          <div className="mb-6 rounded-lg bg-green-50 p-4 text-green-800">
            ✓ CSV uploaded successfully. Processing has started.
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'upload'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Upload CSV
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'jobs'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            View Jobs
          </button>
        </div>

        {/* Tab Content */}
        <div className="rounded-lg bg-white p-6 shadow">
          {activeTab === 'upload' && <CSVUploadForm onSuccess={handleUploadSuccess} />}
          {activeTab === 'jobs' && <JobsList />}
        </div>
      </div>
    </main>
  );
}



