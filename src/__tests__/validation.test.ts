import { PaymentRowSchema } from '@/lib/validation';
import { parseCSV, detectColumnMapping, validatePayrollRows, rowsToCSV } from '@/lib/csv-parser';

describe('CSV Validation', () => {
  describe('Payment Row Schema', () => {
    it('should validate a complete valid row', () => {
      const data = {
        employee_email: 'test@example.com',
        amount: 1500.50,
        currency: 'usd',
        pay_date: '2025-11-01',
        description: 'November salary',
        external_reference: 'REF-202511',
      };

      const result = PaymentRowSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should validate with employee_id instead of email', () => {
      const data = {
        employee_id: 'EMP001',
        amount: 2000,
        currency: 'EUR',
        pay_date: '2025-11-05',
      };

      const result = PaymentRowSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject if neither employee_id nor email is provided', () => {
      const data = {
        amount: 1500,
        currency: 'USD',
        pay_date: '2025-11-01',
      };

      const result = PaymentRowSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const data = {
        employee_email: 'not-an-email',
        amount: 1500,
        currency: 'USD',
        pay_date: '2025-11-01',
      };

      const result = PaymentRowSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid employee_id format', () => {
      const data = {
        employee_id: 'ab', // Too short
        amount: 1500,
        currency: 'USD',
        pay_date: '2025-11-01',
      };

      const result = PaymentRowSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject negative amount', () => {
      const data = {
        employee_email: 'test@example.com',
        amount: -1500,
        currency: 'USD',
        pay_date: '2025-11-01',
      };

      const result = PaymentRowSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject amount exceeding maximum', () => {
      const data = {
        employee_email: 'test@example.com',
        amount: 1000001,
        currency: 'USD',
        pay_date: '2025-11-01',
      };

      const result = PaymentRowSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid currency code', () => {
      const data = {
        employee_email: 'test@example.com',
        amount: 1500,
        currency: 'INVALID',
        pay_date: '2025-11-01',
      };

      const result = PaymentRowSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should normalize currency to uppercase', () => {
      const data = {
        employee_email: 'test@example.com',
        amount: 1500,
        currency: 'usd',
        pay_date: '2025-11-01',
      };

      const result = PaymentRowSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currency).toBe('USD');
      }
    });

    it('should reject pay_date in past beyond 30 days', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 31);
      const dateStr = pastDate.toISOString().split('T')[0];

      const data = {
        employee_email: 'test@example.com',
        amount: 1500,
        currency: 'USD',
        pay_date: dateStr,
      };

      const result = PaymentRowSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject pay_date in future beyond 365 days', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 366);
      const dateStr = futureDate.toISOString().split('T')[0];

      const data = {
        employee_email: 'test@example.com',
        amount: 1500,
        currency: 'USD',
        pay_date: dateStr,
      };

      const result = PaymentRowSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('CSV Parsing', () => {
    it('should parse valid CSV', () => {
      const csv = `employee_email,amount,currency,pay_date
test@example.com,1500.00,USD,2025-11-01`;

      const { headers, rows } = parseCSV(csv);
      expect(headers).toEqual(['employee_email', 'amount', 'currency', 'pay_date']);
      expect(rows.length).toBe(1);
      expect(rows[0].employee_email).toBe('test@example.com');
    });

    it('should detect common column aliases', () => {
      const headers = ['email', 'salary', 'curr', 'date'];
      const mapping = detectColumnMapping(headers);

      expect(mapping.employee_email).toBe('email');
      expect(mapping.amount).toBe('salary');
      expect(mapping.currency).toBe('curr');
      expect(mapping.pay_date).toBe('date');
    });
  });

  describe('Row Validation', () => {
    it('should identify valid and invalid rows', () => {
      const rows = [
        {
          employee_email: 'test@example.com',
          amount: '1500.00',
          currency: 'USD',
          pay_date: '2025-11-01',
        },
        {
          employee_email: 'invalid-email',
          amount: 'not-a-number',
          currency: 'INVALID',
          pay_date: '2025-11-01',
        },
      ];

      const mapping = {
        employee_id: null,
        employee_email: 'employee_email',
        amount: 'amount',
        currency: 'currency',
        pay_date: 'pay_date',
        description: null,
        external_reference: null,
      };

      const result = validatePayrollRows(rows, mapping);
      expect(result.validRows.length).toBe(1);
      expect(result.invalidRows.length).toBe(1);
    });

    it('should detect duplicate rows', () => {
      const rows = [
        {
          employee_email: 'test@example.com',
          amount: '1500.00',
          currency: 'USD',
          pay_date: '2025-11-01',
        },
        {
          employee_email: 'test@example.com',
          amount: '1500.00',
          currency: 'USD',
          pay_date: '2025-11-01',
        },
      ];

      const mapping = {
        employee_id: null,
        employee_email: 'employee_email',
        amount: 'amount',
        currency: 'currency',
        pay_date: 'pay_date',
        description: null,
        external_reference: null,
      };

      const result = validatePayrollRows(rows, mapping);
      expect(result.validRows.length).toBe(1);
      expect(result.duplicates.length).toBe(1);
      expect(result.duplicates[0].duplicateOf).toBe(0);
    });
  });

  describe('CSV Export', () => {
    it('should export rows to CSV format', () => {
      const rows = [
        {
          rowIndex: 0,
          data: {
            employee_email: 'test@example.com',
            amount: '1500.00',
            currency: 'USD',
            pay_date: '2025-11-01',
          },
        },
      ];

      const headers = ['employee_email', 'amount', 'currency', 'pay_date'];
      const csv = rowsToCSV(rows, headers);

      expect(csv).toContain('employee_email,amount,currency,pay_date');
      expect(csv).toContain('test@example.com,1500.00,USD,2025-11-01');
    });

    it('should escape CSV values with commas', () => {
      const rows = [
        {
          rowIndex: 0,
          data: {
            employee_email: 'test@example.com',
            description: 'Salary, bonus, benefits',
          },
        },
      ];

      const headers = ['employee_email', 'description'];
      const csv = rowsToCSV(rows, headers);

      expect(csv).toContain('"Salary, bonus, benefits"');
    });
  });
});
