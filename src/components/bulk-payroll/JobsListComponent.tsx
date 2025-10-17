'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createBaseAccountSDK } from '@base-org/account';
import { baseSepolia } from 'viem/chains';

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

interface SubAccount {
  address: `0x${string}`;
  factory?: `0x${string}`;
  factoryData?: `0x${string}`;
}

interface GetSubAccountsResponse {
  subAccounts: SubAccount[];
}

interface WalletAddSubAccountResponse {
  address: `0x${string}`;
  factory?: `0x${string}`;
  factoryData?: `0x${string}`;
}

const PAYMENT_RECIPIENT = '0xeEb1aa8def0E163921591427ae71F6f3759797ac';
const USDC_ADDRESS = '0x036CbD53842c5426634E7929541eC2318f3dCd01';

export const JobsList: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [paymentStates, setPaymentStates] = useState<Record<string, { loading: boolean; status: string }>>({});
  
  // SDK and provider refs - persisted across renders
  const sdkRef = useRef<ReturnType<typeof createBaseAccountSDK> | null>(null);
  const providerRef = useRef<any>(null);
  const subAccountRef = useRef<SubAccount | null>(null);
  const universalAddressRef = useRef<string>('');

  useEffect(() => {
    fetchJobs();
    initializeSDK();
  }, [page]);

  const initializeSDK = async () => {
    try {
      if (!sdkRef.current) {
        const sdkInstance = createBaseAccountSDK({
          appName: 'Bulk Payroll Base Account',
          appLogoUrl: 'https://base.org/logo.png',
          appChainIds: [baseSepolia.id],
        });
        sdkRef.current = sdkInstance;
        providerRef.current = sdkInstance.getProvider();
      }
    } catch (error) {
      console.error('SDK initialization failed:', error);
    }
  };

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

  const sendBasePayment = async (jobId: string) => {
    if (!providerRef.current) {
      setPaymentStates((prev) => ({
        ...prev,
        [jobId]: { loading: false, status: 'SDK not initialized' },
      }));
      return;
    }

    setPaymentStates((prev) => ({
      ...prev,
      [jobId]: { loading: true, status: 'Connecting wallet...' },
    }));

    try {
      const provider = providerRef.current;

      // Step 1: Connect wallet and get accounts
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
        params: [],
      })) as string[];

      const universalAddr = accounts[0];
      universalAddressRef.current = universalAddr;

      setPaymentStates((prev) => ({
        ...prev,
        [jobId]: { loading: true, status: 'Checking for existing Sub Account...' },
      }));

      // Step 2: Check for existing sub account
      const getSubAccountsResponse = (await provider.request({
        method: 'wallet_getSubAccounts',
        params: [
          {
            account: universalAddr,
            domain: window.location.origin,
          },
        ],
      })) as GetSubAccountsResponse;

      let currentSubAccount = getSubAccountsResponse.subAccounts?.[0];

      // Step 3: Create sub account if it doesn't exist
      if (!currentSubAccount) {
        setPaymentStates((prev) => ({
          ...prev,
          [jobId]: { loading: true, status: 'Creating Sub Account...' },
        }));

        const createResponse = (await provider.request({
          method: 'wallet_addSubAccount',
          params: [
            {
              account: {
                type: 'create',
              },
            },
          ],
        })) as WalletAddSubAccountResponse;

        currentSubAccount = createResponse;
      }

      subAccountRef.current = currentSubAccount;

      setPaymentStates((prev) => ({
        ...prev,
        [jobId]: { loading: true, status: 'Sending USDC payment...' },
      }));

      // Step 4: Send USDC payment via wallet_sendCalls
      const usdcAmount = '1000000'; // 1 USDC (6 decimals)
      const encodedData = `0xa9059cbb000000000000000000000000${
        PAYMENT_RECIPIENT.toLowerCase().slice(2)
      }0000000000000000000000000000000000000000000000000000000000${parseInt(
        usdcAmount
      ).toString(16)}`;

      const callsId = (await provider.request({
        method: 'wallet_sendCalls',
        params: [
          {
            version: '2.0',
            atomicRequired: true,
            chainId: `0x${baseSepolia.id.toString(16)}`,
            from: currentSubAccount.address,
            calls: [
              {
                to: USDC_ADDRESS,
                data: encodedData,
                value: '0x0',
              },
            ],
          },
        ],
      })) as string;

      setPaymentStates((prev) => ({
        ...prev,
        [jobId]: { loading: true, status: 'Updating job status...' },
      }));

      // Step 5: Update job status to COMPLETED
      const updateResponse = await fetch(`/api/bulk-payroll/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update job status');
      }

      // Update local state
      setJobs((prevJobs) =>
        prevJobs.map((job) =>
          job.id === jobId ? { ...job, status: 'COMPLETED' } : job
        )
      );

      setPaymentStates((prev) => ({
        ...prev,
        [jobId]: { 
          loading: false, 
          status: `✅ Payment successful! Calls ID: ${callsId.slice(0, 10)}...` 
        },
      }));

      // Clear status after 5 seconds
      setTimeout(() => {
        setPaymentStates((prev) => ({
          ...prev,
          [jobId]: { loading: false, status: '' },
        }));
      }, 5000);
    } catch (error) {
      console.error('Payment failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setPaymentStates((prev) => ({
        ...prev,
        [jobId]: {
          loading: false,
          status: `❌ ${errorMessage}`,
        },
      }));
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
                <div className="flex flex-col gap-2">
                  {job.status === 'COMPLETED' ? (
                    <span className="text-green-600 font-medium text-sm">✅ Completed</span>
                  ) : (
                    <button
                      onClick={() => sendBasePayment(job.id)}
                      disabled={paymentStates[job.id]?.loading || job.status === 'COMPLETED'}
                      className="text-blue-600 hover:text-blue-900 text-sm font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {paymentStates[job.id]?.loading ? 'Processing...' : 'Send Base Payment'}
                    </button>
                  )}
                  {paymentStates[job.id]?.status && (
                    <span className="text-xs text-gray-600">{paymentStates[job.id].status}</span>
                  )}
                </div>
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
