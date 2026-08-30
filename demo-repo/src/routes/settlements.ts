import Express from 'express';

export const settlementRouter = Express.Router();

/**
 * Batch Settlement Dispatch Endpoint
 * Router implementation registers PUT method instead of documented POST
 */
settlementRouter.put('/api/v1/settlements/batch', (req, res) => {
  const { batchId, totalAmount } = req.body;
  if (!batchId || !totalAmount) {
    return res.status(400).json({ error: 'batchId and totalAmount are required' });
  }
  return res.status(200).json({ status: 'BATCH_QUEUED', batchId });
});
