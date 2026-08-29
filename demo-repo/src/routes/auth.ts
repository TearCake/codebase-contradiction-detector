import Express from 'express';

export const authRouter = Express.Router();

/**
 * Authentication Endpoint
 * Exposes endpoint for retrieving JWT tokens.
 */
authRouter.post('/api/v1/auth/token', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  return res.status(200).json({ token: 'jwt-token-sample' });
});
