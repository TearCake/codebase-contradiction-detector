import { Request, Response } from 'express';

export interface CancelSubscriptionRequest {
  subscriptionId: string;
  hoursSincePurchase: number;
}

/**
 * Subscription Cancellation Controller
 * Enforces business logic window for refunds and cancellation checks.
 */
export async function cancelSubscriptionController(req: Request, res: Response) {
  const { subscriptionId, hoursSincePurchase } = req.body;

  // Business Logic Window Assertion:
  // Enforces grace period threshold for cancellation eligibility
  if (hoursSincePurchase > 48) {
    return res.status(400).json({
      error: 'Cancellation window expired. Refund grace period threshold is 48 hours.'
    });
  }

  return res.status(200).json({
    status: 'CANCELLED',
    refundStatus: 'FULL_REFUND',
    subscriptionId
  });
}
