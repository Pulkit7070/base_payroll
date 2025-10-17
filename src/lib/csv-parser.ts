import { parse } from 'csv-parse/sync';
import { PaymentRow, RawPaymentRowSchema, ValidationError, ParsedPayrollCSV } from '@/lib/validation';

/**
 * Parse CSV content (string) into structured data
 */
export function parseCSV(csvContent: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = Object.keys(records[0] as Record<string, unknown>);
  return { headers, rows: records };
}

/**
 * Auto-detect and map CSV headers to payroll fields
 * Handles common variations (e.g., "email" -> "employee_email")
 */
export function detectColumnMapping(headers: string[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {
    employee_id: null,
    employee_email: null,
    amount: null,
    currency: null,
    pay_date: null,
    description: null,
    external_reference: null,
  };

  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

  for (const [field, _] of Object.entries(mapping)) {
    const normalized = field.toLowerCase();

    // Direct match
    const directIdx = normalizedHeaders.indexOf(normalized);
    if (directIdx !== -1) {
      mapping[field] = headers[directIdx];
      continue;
    }

    // Fuzzy matching for common variations
    const commonAliases: Record<string, string[]> = {
      employee_id: ['emp_id', 'empid', 'id', 'employee id', 'emp', 'employee_code'],
      employee_email: ['email', 'emp_email', 'empemail', 'employee email', 'recipient_email'],
      amount: ['salary', 'payment', 'pay_amount', 'payroll_amount', 'value'],
      currency: ['curr', 'code', 'currency_code', 'iso_code'],
      pay_date: ['date', 'paydate', 'payment_date', 'salary_date', 'pay_period'],
      description: ['notes', 'reason', 'comment'],
      external_reference: ['reference', 'ref', 'external_ref', 'ref_no', 'reference_id'],
    };

    if (commonAliases[field]) {
      for (const alias of commonAliases[field]) {
        const aliasIdx = normalizedHeaders.indexOf(alias);
        if (aliasIdx !== -1) {
          mapping[field] = headers[aliasIdx];
          break;
        }
      }
    }
  }

  return mapping;
}

/**
 * Validate and parse payroll rows with duplicate detection
 */
export function validatePayrollRows(
  rows: Record<string, string>[],
  columnMapping: Record<string, string | null>
): ParsedPayrollCSV {
  const validRows: PaymentRow[] = [];
  const invalidRows: Array<{
    rowIndex: number;
    data: Record<string, string>;
    errors: ValidationError[];
  }> = [];
  const duplicates: Array<{
    rowIndex: number;
    data: Record<string, string>;
    duplicateOf: number;
  }> = [];

  const seenPayments = new Map<string, number>(); // key -> rowIndex

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i];
    const mappedRow: Record<string, unknown> = {};

    // Map CSV columns to schema fields
    for (const [field, csvColumn] of Object.entries(columnMapping)) {
      if (csvColumn && rawRow[csvColumn] !== undefined) {
        mappedRow[field] = rawRow[csvColumn];
      }
    }

    // Validate against schema
    const result = RawPaymentRowSchema.safeParse(mappedRow);

    if (!result.success) {
      const errors: ValidationError[] = result.error.issues.map((issue) => ({
        rowIndex: i,
        field: issue.path[0] as string,
        error: issue.message,
      }));
      invalidRows.push({ rowIndex: i, data: rawRow, errors });
      continue;
    }

    // Check for duplicates (same employee + amount + pay_date)
    const paymentKey = `${result.data.employee_id || result.data.employee_email}:${result.data.amount}:${result.data.pay_date}`;
    if (seenPayments.has(paymentKey)) {
      duplicates.push({
        rowIndex: i,
        data: rawRow,
        duplicateOf: seenPayments.get(paymentKey)!,
      });
      continue;
    }

    seenPayments.set(paymentKey, i);
    validRows.push(result.data);
  }

  return {
    headers: Object.keys(rows[0] || {}),
    totalRows: rows.length,
    validRows,
    invalidRows,
    duplicates,
  };
}

/**
 * Convert parsed rows back to CSV format (for downloading invalid/duplicate rows)
 */
export function rowsToCSV(
  rows: Array<{ rowIndex: number; data: Record<string, string> }>,
  allHeaders: string[]
): string {
  const header = allHeaders.join(',');
  const lines = [header];

  for (const { data } of rows) {
    const values = allHeaders.map((h) => {
      const value = data[h] || '';
      // Escape CSV values that contain commas or quotes
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    lines.push(values.join(','));
  }

  return lines.join('\n');
}
