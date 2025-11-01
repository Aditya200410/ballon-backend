# PhonePe Payment Integration Setup

## Required Environment Variables

Add the following environment variables to your `.env` file in the `ballon-backend` directory:

```env
# PhonePe Payment Gateway Configuration
PHONEPE_CLIENT_ID=your_phonepe_client_id
PHONEPE_CLIENT_SECRET=your_phonepe_client_secret
PHONEPE_ENV=sandbox
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:5175
```

## Getting PhonePe Credentials

1. Go to [PhonePe Developer Dashboard](https://developer.phonepe.com)
2. Create an account or log in
3. Create a new application
4. Get your Client ID and Client Secret
5. Choose your environment (sandbox for testing, production for live)

## Testing the Integration

### Sandbox Environment
- Use `PHONEPE_ENV=sandbox` for testing
- Test credentials will be provided by PhonePe

### Production Environment
- Use `PHONEPE_ENV=production` for live payments
- Update `FRONTEND_URL` and `BACKEND_URL` to your production URLs

## Common Issues

### Error: "INVALID_CLIENT" / "Client authentication failure"
- **Cause**: Missing or incorrect `PHONEPE_CLIENT_ID` or `PHONEPE_CLIENT_SECRET`
- **Solution**: Double-check your .env file has the correct credentials

### Error: "Payment gateway not configured"
- **Cause**: Missing PhonePe environment variables
- **Solution**: Add the required environment variables to your .env file

### Error: "Application configuration missing"
- **Cause**: Missing `FRONTEND_URL` or `BACKEND_URL`
- **Solution**: Add these URLs to your .env file

## API Flow

1. Frontend calls `/api/payment/phonepe` with order details
2. Backend validates data and gets OAuth token from PhonePe
3. Backend creates payment intent with PhonePe
4. Backend returns redirect URL to frontend
5. Frontend redirects user to PhonePe payment page
6. User completes payment on PhonePe
7. PhonePe redirects back to frontend with status
8. Frontend calls backend to verify payment status

## Endpoints

- `POST /api/payment/phonepe` - Initiate payment
- `POST /api/payment/phonepe/callback` - Handle PhonePe callback
- `GET /api/payment/phonepe/status/:orderId` - Check payment status

## Support

For PhonePe API documentation, visit: https://developer.phonepe.com/v1/reference

