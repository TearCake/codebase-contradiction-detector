import { Request, Response } from 'express';
import { z } from 'zod';

const TransferSchema = z.object({
  escrowId: z.string(),
  callbackWebhookUrl: z.string().nonempty('callbackWebhookUrl is mandatory for settlement notification'),
});

export async function processTransferController(req: Request, res: Response) {
  const parseResult = TransferSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.format() });
  }
  return res.status(200).json({ success: true });
}
