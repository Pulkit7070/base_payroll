import { FakePaymentsAdapter } from '@/lib/payments-adapter';

describe('Payments Adapter', () => {
  describe('FakePaymentsAdapter', () => {
    it('should create payment with success', async () => {
      const adapter = new FakePaymentsAdapter({ successRate: 1.0, latencyMs: 0 });

      const result = await adapter.createPayment({
        employee_email: 'test@example.com',
        amount: 1500,
        currency: 'USD',
        pay_date: '2025-11-01',
      });

      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.id?.startsWith('fake_')).toBe(true);
    });

    it('should create payment with failure', async () => {
      const adapter = new FakePaymentsAdapter({ successRate: 0.0, latencyMs: 0 });

      const result = await adapter.createPayment({
        employee_email: 'test@example.com',
        amount: 1500,
        currency: 'USD',
        pay_date: '2025-11-01',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.length).toBeGreaterThan(0);
    });

    it('should be deterministic with seeded RNG', async () => {
      const adapter1 = new FakePaymentsAdapter({ seed: 42, successRate: 0.5, latencyMs: 0 });
      const adapter2 = new FakePaymentsAdapter({ seed: 42, successRate: 0.5, latencyMs: 0 });

      const paymentData = {
        employee_email: 'test@example.com',
        amount: 1500,
        currency: 'USD',
        pay_date: '2025-11-01',
      };

      const result1 = await adapter1.createPayment(paymentData);
      const result2 = await adapter2.createPayment(paymentData);

      expect(result1.success).toBe(result2.success);
    });

    it('should simulate latency', async () => {
      const adapter = new FakePaymentsAdapter({ latencyMs: 100, successRate: 1.0 });

      const start = Date.now();
      await adapter.createPayment({
        employee_email: 'test@example.com',
        amount: 1500,
        currency: 'USD',
        pay_date: '2025-11-01',
      });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(elapsed).toBeLessThan(200); // Allow some variance
    });

    it('should include raw response in result', async () => {
      const adapter = new FakePaymentsAdapter({ successRate: 1.0, latencyMs: 0 });

      const result = await adapter.createPayment({
        employee_email: 'test@example.com',
        amount: 1500,
        currency: 'USD',
        pay_date: '2025-11-01',
      });

      expect(result.rawResponse).toBeDefined();
      expect(result.rawResponse?.provider).toBe('fake');
      expect(result.rawResponse?.status).toBe('completed');
    });
  });
});
