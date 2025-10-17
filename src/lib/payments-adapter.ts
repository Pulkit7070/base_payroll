import { PaymentRow } from '@/lib/validation';

/**
 * Payments adapter interface - abstraction for payment processing providers
 * Allows easy swapping between Stripe, Paystack, bank APIs, etc.
 */
export interface PaymentResult {
  success: boolean;
  id?: string; // Provider's transaction ID
  error?: string;
  rawResponse?: Record<string, any>;
}

export interface PaymentsAdapter {
  /**
   * Process a single payment
   * @param input Normalized payment row
   * @returns Payment result with success status and provider ID
   */
  createPayment(input: PaymentRow): Promise<PaymentResult>;
}

/**
 * Fake payments adapter for development and testing
 * Uses a deterministic seeded RNG to simulate success/failure patterns
 * Simulates network latency
 */
export class FakePaymentsAdapter implements PaymentsAdapter {
  private readonly successRate: number;
  private readonly latencyMs: number;
  private readonly seed: number;

  constructor(options: { successRate?: number; latencyMs?: number; seed?: number } = {}) {
    this.successRate = options.successRate ?? 0.8; // 80% success rate by default
    this.latencyMs = options.latencyMs ?? 100; // 100ms latency
    this.seed = options.seed ?? 42; // Fixed seed for deterministic behavior
  }

  /**
   * Simulate network latency
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Deterministic pseudo-random number generator using seed
   * Ensures reproducible results across test runs
   */
  private seededRandom(input: string): number {
    // Simple LCG (Linear Congruential Generator) for reproducibility
    let hash = this.seed;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return (Math.abs(hash) % 1000) / 1000; // Return 0-1
  }

  async createPayment(input: PaymentRow): Promise<PaymentResult> {
    // Simulate latency
    await this.delay(this.latencyMs);

    // Use deterministic RNG based on employee identifier + amount for reproducibility
    const key = `${input.employee_id || input.employee_email}:${input.amount}:${input.pay_date}`;
    const rand = this.seededRandom(key);

    if (rand < this.successRate) {
      // Success case
      const providerId = `fake_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return {
        success: true,
        id: providerId,
        rawResponse: {
          provider: 'fake',
          timestamp: new Date().toISOString(),
          status: 'completed',
          amount: input.amount,
          currency: input.currency,
        },
      };
    } else {
      // Failure case - randomize error message
      const errors = [
        'Insufficient funds',
        'Invalid account',
        'Daily limit exceeded',
        'Temporary service unavailable',
        'Invalid currency for recipient',
      ];
      const errorIndex = Math.floor(this.seededRandom(key + '_error') * errors.length);
      return {
        success: false,
        error: errors[errorIndex],
        rawResponse: {
          provider: 'fake',
          timestamp: new Date().toISOString(),
          status: 'failed',
          reason: errors[errorIndex],
        },
      };
    }
  }
}

/**
 * Example adapter implementation for reference
 * TODO: Implement real payment provider adapter (e.g., Stripe, Paystack)
 *
 * Example Stripe adapter:
 * ```
 * export class StripePaymentsAdapter implements PaymentsAdapter {
 *   constructor(private stripe: any) {}
 *
 *   async createPayment(input: PaymentRow): Promise<PaymentResult> {
 *     try {
 *       const transfer = await this.stripe.transfers.create({
 *         amount: Math.round(input.amount * 100),
 *         currency: input.currency.toLowerCase(),
 *         destination: input.stripe_account_id,
 *         description: input.description,
 *       });
 *       return {
 *         success: true,
 *         id: transfer.id,
 *         rawResponse: transfer,
 *       };
 *     } catch (error: any) {
 *       return {
 *         success: false,
 *         error: error.message,
 *         rawResponse: error,
 *       };
 *     }
 *   }
 * }
 * ```
 */
