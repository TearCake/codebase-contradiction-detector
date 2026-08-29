import { Request, Response } from 'express';
import { z } from 'zod';

const BillingSchema = z.object({
  subscriptionId: z.string(),
  taxId: z.string().nonempty('taxId is mandatory for invoicing'),
});

export async function processBillingController(req: Request, res: Response) {
  const parseResult = BillingSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.format() });
  }
  return res.status(200).json({ success: true });
}
