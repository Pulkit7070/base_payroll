'use client';

import React, { useState, useRef } from 'react';
import { parseCSV, detectColumnMapping, validatePayrollRows, rowsToCSV } from '@/lib/csv-parser';

interface UploadFormProps {
  onSuccess: () => void;
}

export const CSVUploadForm: React.FC<UploadFormProps> = ({ onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationStep, setValidationStep] = useState<'upload' | 'preview' | 'mapping' | 'confirmation'>('upload');
  const [parsedData, setParsedData] = useState<any>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const csvFile = files[0];
      if (csvFile.type === 'text/csv' || csvFile.name.endsWith('.csv')) {
        handleFileSelect(csvFile);
      } else {
        setError('Please upload a valid CSV file');
      }
    }
  };

  const handleFileSelect = async (selectedFile: File) => {
    setError(null);
    setFile(selectedFile);

    // Parse CSV immediately for preview
    try {
      const csvContent = await selectedFile.text();
      const { headers, rows } = parseCSV(csvContent);

      // Auto-detect column mapping
      const mapping = detectColumnMapping(headers);

      // Validate rows
      const validation = validatePayrollRows(rows, mapping);

      setParsedData({
        headers,
        rows,
        validation,
        csvContent,
      });

      setColumnMapping(mapping);
      setValidationStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!file || !parsedData) {
      setError('No CSV loaded');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/bulk-payroll/upload', {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Upload failed');
      }

      // Reset form
      setFile(null);
      setParsedData(null);
      setColumnMapping({});
      setValidationStep('upload');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (field: string, header: string | null) => {
    setColumnMapping((prev) => ({
      ...prev,
      [field]: header,
    }));

    // Re-validate rows with new mapping
    if (parsedData) {
      const validation = validatePayrollRows(parsedData.rows, {
        ...columnMapping,
        [field]: header,
      });
      setParsedData((prev: any) => ({
        ...prev,
        validation,
      }));
    }
  };

  const downloadInvalidRows = () => {
    if (!parsedData?.validation?.invalidRows) return;

    const csv = rowsToCSV(parsedData.validation.invalidRows, parsedData.headers);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invalid-rows-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Upload step
  if (validationStep === 'upload') {
    return (
      <div className="space-y-6">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors"
        >
          <div className="mb-4 text-5xl">📄</div>
          <h3 className="mb-2 text-lg font-medium text-gray-900">Drop your CSV file here</h3>
          <p className="mb-4 text-gray-600">or</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mb-4 rounded-lg bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700"
          >
            Choose File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <p className="text-sm text-gray-500">Supported formats: CSV (max 10 MB)</p>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div>}

        <div className="rounded-lg bg-blue-50 p-4 text-blue-800">
          <h4 className="font-medium mb-2">CSV Schema</h4>
          <ul className="space-y-1 text-sm">
            <li>• <strong>employee_id</strong> (optional) - Employee identifier (3-64 chars)</li>
            <li>• <strong>employee_email</strong> (optional) - Employee email address</li>
            <li>• <strong>amount</strong> (required) - Payment amount (up to 1,000,000)</li>
            <li>• <strong>currency</strong> (required) - 3-letter ISO code (e.g., USD, EUR)</li>
            <li>• <strong>pay_date</strong> (required) - Payment date (YYYY-MM-DD)</li>
            <li>• <strong>description</strong> (optional) - Payment description (max 255 chars)</li>
            <li>• <strong>external_reference</strong> (optional) - Reference ID</li>
          </ul>
          <p className="mt-3 text-sm">At least one of employee_id or employee_email must be provided per row.</p>
        </div>
      </div>
    );
  }

  // Preview and mapping step
  if (validationStep === 'preview' && parsedData) {
  const { validation, headers } = parsedData;

    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Column Mapping</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {['employee_id', 'employee_email', 'amount', 'currency', 'pay_date', 'description', 'external_reference'].map(
          (field: string) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.replace(/_/g, ' ')}
                  </label>
                  <select
                    value={columnMapping[field] || ''}
                    onChange={(e) => handleMappingChange(field, e.target.value || null)}
                    className="w-full rounded border border-gray-300 px-3 py-2"
                  >
                    <option value="">Auto-detect</option>
                    {headers.map((h: string) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              )
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-green-50 p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{validation.validRows.length}</div>
            <div className="text-sm text-gray-600">Valid Rows</div>
          </div>
          <div className="rounded-lg bg-red-50 p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{validation.invalidRows.length}</div>
            <div className="text-sm text-gray-600">Invalid Rows</div>
          </div>
          <div className="rounded-lg bg-yellow-50 p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{validation.duplicates.length}</div>
            <div className="text-sm text-gray-600">Duplicates</div>
          </div>
        </div>

        {validation.invalidRows.length > 0 && (
          <div className="rounded-lg bg-red-50 p-4">
            <h4 className="font-medium text-red-900 mb-2">Sample Validation Errors</h4>
            <div className="space-y-2">
              {validation.invalidRows.slice(0, 5).map((row: any, idx: number) => (
                      <div key={idx} className="text-sm text-red-700">
                        Row {row.rowIndex}: {row.errors.map((e: any) => e.error).join('; ')}
                      </div>
                    ))}
            </div>
            <button
              onClick={downloadInvalidRows}
              className="mt-3 rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
            >
              Download Invalid Rows
            </button>
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={() => {
              setFile(null);
              setParsedData(null);
              setValidationStep('upload');
            }}
            className="rounded border border-gray-300 px-6 py-2 font-medium text-gray-700 hover:bg-gray-50"
          >
            Upload Different File
          </button>
          <button
            onClick={() => setValidationStep('confirmation')}
            disabled={validation.validRows.length === 0}
            className="rounded bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // Confirmation step
  if (validationStep === 'confirmation' && parsedData) {
    const { validation } = parsedData;

    return (
      <div className="space-y-6">
        <div className="rounded-lg bg-blue-50 p-4 text-blue-900">
          <h3 className="font-medium mb-2">Ready to Submit</h3>
          <p className="text-sm">
            {validation.validRows.length} valid rows will be processed for payment.{' '}
            {validation.invalidRows.length + validation.duplicates.length > 0 &&
              `${validation.invalidRows.length + validation.duplicates.length} rows will be skipped due to errors.`}
          </p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => setValidationStep('preview')}
            className="rounded border border-gray-300 px-6 py-2 font-medium text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="rounded bg-green-600 px-6 py-2 font-medium text-white hover:bg-green-700 disabled:bg-gray-400"
          >
            {loading ? 'Uploading...' : 'Submit for Processing'}
          </button>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div>}
      </div>
    );
  }

  return null;
};
