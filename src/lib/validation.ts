import { z } from 'zod';

/**
 * ISO 4217 currency codes (common subset for validation)
 * In production, validate against the complete ISO 4217 list
 */
const ISO4217_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY',
  'SEK', 'NZD', 'MXN', 'SGD', 'HKD', 'NOK', 'KRW', 'TRY',
  'RUB', 'INR', 'BRL', 'ZAR', 'AED', 'SAR', 'QAR', 'KWD',
  'BHD', 'OMR', 'JOD', 'ILS', 'BGN', 'HRK', 'CZK', 'DKK',
  'HUF', 'PLN', 'RON', 'HKD', 'IDR', 'MYR', 'PHP', 'THB',
  'VND', 'PKR', 'BDT', 'LKR', 'MMK', 'KHR', 'LAK',
];

/**
 * Shared validation rules for payroll rows
 * Can be used both client-side (after Zod transforms) and server-side
 */

export const PaymentRowSchema = z.object({
  employee_id: z.string().regex(/^[A-Za-z0-9_-]{3,64}$|^$/).optional().nullable(),
  employee_email: z.string().email().optional().nullable(),
  amount: z
    .number()
    .positive('Amount must be greater than 0')
    .max(1000000, 'Amount cannot exceed 1,000,000')
    .refine((val) => /^\d+(\.\d{1,2})?$/.test(val.toString()), 'Amount must have at most 2 decimal places'),
  currency: z
    .string()
    .length(3, 'Currency code must be 3 characters')
    .transform((val) => val.toUpperCase())
    .refine((val) => ISO4217_CURRENCIES.includes(val), 'Invalid ISO 4217 currency code'),
  pay_date: z
    .string()
    .refine((val) => /^\d{4}-\d{2}-\d{2}$/.test(val), 'pay_date must be in YYYY-MM-DD format')
    .refine((val) => {
      const date = new Date(val);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const minDate = new Date(today);
      minDate.setDate(minDate.getDate() - 30);
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + 365);
      return date >= minDate && date <= maxDate;
    }, 'pay_date must be within ±30 days from today (past) and +365 days (future)'),
  description: z.string().max(255).optional().nullable(),
  external_reference: z.string().optional().nullable(),
}).refine(
  (data) => data.employee_id || data.employee_email,
  { message: 'At least one of employee_id or employee_email must be provided' }
);

export type PaymentRow = z.infer<typeof PaymentRowSchema>;

/**
 * Schema for the parsed CSV before validation (strings from CSV parser)
 * Used to coerce string values to proper types
 */
export const RawPaymentRowSchema = z.object({
  employee_id: z.string().optional().nullable().default(''),
  employee_email: z.string().optional().nullable().default(''),
  amount: z
    .string()
    .or(z.number())
    .refine((val) => !isNaN(Number(val)), 'amount must be a valid number')
    .transform((val) => Number(val)),
  currency: z.string().transform((val) => val.trim().toUpperCase()),
  pay_date: z.string().transform((val) => val.trim()),
  description: z.string().optional().nullable().default(''),
  external_reference: z.string().optional().nullable().default(''),
}).pipe(PaymentRowSchema);

export type RawPaymentRow = z.infer<typeof RawPaymentRowSchema>;

/**
 * Validation error details
 */
export interface ValidationError {
  rowIndex: number;
  field?: string;
  error: string;
}

/**
 * Parsed and validated CSV file
 */
export interface ParsedPayrollCSV {
  headers: string[];
  totalRows: number;
  validRows: PaymentRow[];
  invalidRows: Array<{ rowIndex: number; data: Record<string, string>; errors: ValidationError[] }>;
  duplicates: Array<{ rowIndex: number; data: Record<string, string>; duplicateOf: number }>;
}
