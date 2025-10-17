import { validatePayrollRows } from '../src/lib/csv-parser';

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

(async () => {
  const result = validatePayrollRows(rows as any, mapping as any);
  console.log(JSON.stringify(result, null, 2));
})();
