import { Request, Response } from 'express';

export interface EscrowReleaseRequest {
  escrowId: string;
  holdPeriodDays: number;
}

/**
 * Escrow Release Controller
 * Enforces business logic window for escrow hold and dispute thresholds.
 */
export async function releaseEscrowController(req: Request, res: Response) {
  const { escrowId, holdPeriodDays } = req.body;

  // Business Logic Window Assertion:
  // Enforces mandatory 30 days hold period threshold before releasing funds
  if (holdPeriodDays < 30) {
    return res.status(400).json({
      error: 'Escrow release window not satisfied. Mandatory escrow hold threshold is 30 days.'
    });
  }

  return res.status(200).json({
    status: 'RELEASED',
    settlementStatus: 'FULL_RELEASE',
    escrowId
  });
}
