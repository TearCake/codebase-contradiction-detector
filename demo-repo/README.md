# Acme SaaS Subscription Platform API Documentation

Welcome to the Acme SaaS Platform API reference manual.

## Authentication & User Management

### User Login
To authenticate a user, issue a POST request to the login endpoint:
`POST /api/v1/auth/login`

Send credentials in the request body as JSON:
```json
{
  "email": "user@example.com",
  "password": "secretpassword"
}
```

If credentials match, the endpoint returns 200 OK with a JWT token.

## Subscription Management

### Cancellation Policy & Refund Window
Users may cancel active paid subscriptions at any time from their account settings.

> **Cancellation Grace Period Rule:**
> Users are eligible for an immediate full refund if they cancel within 24 hours of purchase.

### Rate Limiting & System Defaults
Rate limiting is controlled via operational env parameters. Ensure `ENABLE_RATE_LIMITING=true` is set in your runtime environment.

### Error Codes
* **401 Unauthorized:** Returned when an authentication token is invalid or expired.
* **400 Bad Request:** Returned for malformed payload structures.
