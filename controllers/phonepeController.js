const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();
const Order = require('../models/Order');
const { sendOrderConfirmationEmail } = require('./orderController');

// Cache for OAuth token
let oauthToken = null;
let tokenExpiry = null;

// Get OAuth token for PhonePe API
async function getPhonePeToken() {
  try {
    // Check if we have a valid cached token
    if (oauthToken && tokenExpiry && new Date() < tokenExpiry) {
      return oauthToken;
    }

    const clientId = process.env.PHONEPE_CLIENT_ID;
    const clientSecret = process.env.PHONEPE_CLIENT_SECRET;
    const clientVersion = '1';
    const env = process.env.PHONEPE_ENV || 'sandbox';

    if (!clientId || !clientSecret) {
      throw new Error('PhonePe OAuth credentials not configured');
    }

    // Set OAuth URL based on environment
    // Based on PhonePe documentation: https://developer.phonepe.com/v1/reference/authorization-standard-checkout/
    let oauthUrl;
    if (env === 'production')
      oauthUrl = 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token';
    else
      oauthUrl = 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token';


    console.log('Getting PhonePe OAuth token from:', oauthUrl);

    const response = await axios.post(oauthUrl,
      new URLSearchParams({
        client_id: clientId,
        client_version: clientVersion,
        client_secret: clientSecret,
        grant_type: 'client_credentials'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      }
    );

    if (response.data && response.data.access_token) {
      oauthToken = response.data.access_token;
      // Set expiry based on expires_at field from response
      if (response.data.expires_at) {
        tokenExpiry = new Date(response.data.expires_at * 1000); // Convert from seconds to milliseconds
      } else {
        // Fallback to 1 hour if expires_at is not provided
        tokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
      }

      console.log('PhonePe OAuth token obtained successfully');
      console.log('Token expires at:', tokenExpiry);
      return oauthToken;
    } else {
      throw new Error('Invalid OAuth response from PhonePe');
    }
  } catch (error) {
    console.error('PhonePe OAuth token error:', error.response?.data || error.message);

    // Provide more specific error message for INVALID_CLIENT
    if (error.response?.data?.code === 'INVALID_CLIENT') {
      throw new Error('PhonePe credentials are invalid or not configured. Please check your PHONEPE_CLIENT_ID and PHONEPE_CLIENT_SECRET environment variables.');
    }

    throw new Error('Failed to get PhonePe OAuth token');
  }
}

const Counter = require('../models/Counter');
const Seller = require('../models/Seller');
const commissionController = require('./commissionController');
const Product = require('../models/Product');

exports.createPhonePeOrder = async (req, res) => {
  try {
    const {
      amount,
      customerName,
      email,
      phone,
      address, // Can be object or string (street)
      city,
      pincode,
      country,
      items,
      totalAmount,
      shippingCost,
      codExtraCharge,
      finalTotal,
      paymentMethod,
      upfrontAmount,
      remainingAmount,
      sellerToken,
      couponCode,
      scheduledDelivery // Optional scheduled delivery date
    } = req.body;

    const env = process.env.PHONEPE_ENV || 'sandbox';
    const frontendUrl = process.env.FRONTEND_URL;
    const backendUrl = process.env.BACKEND_URL;

    // Check PhonePe credentials first
    if (!process.env.PHONEPE_CLIENT_ID || !process.env.PHONEPE_CLIENT_SECRET) {
      console.error('PhonePe credentials not configured');
      return res.status(500).json({
        success: false,
        message: 'Payment gateway not configured. Please contact support.',
      });
    }

    // Enhanced validation
    if (!frontendUrl || !backendUrl) {
      console.error('URL configuration missing:', {
        frontendUrl: !!frontendUrl,
        backendUrl: !!backendUrl
      });
      return res.status(500).json({
        success: false,
        message: 'Application configuration missing. Please contact support.',
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount provided'
      });
    }

    if (!customerName || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Customer details are required'
      });
    }

    // Get OAuth token
    const accessToken = await getPhonePeToken();

    // Set base URL for payment API based on PhonePe documentation
    const baseUrl = env === 'production'
      ? 'https://api.phonepe.com/apis/pg'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

    const apiEndpoint = '/checkout/v2/pay';

    const merchantOrderId = `MT${Date.now()}${Math.random().toString(36).substr(2, 6)}`;

    // 1. Generate custom order ID and Save Pending Order to DB
    // This ensures even if the browser is closed, the order exists.
    const orderNumber = await Counter.getNextSequence('order');
    const customOrderId = `decorationcelebration${orderNumber}`;

    const newOrder = new Order({
      customOrderId,
      customerName,
      email,
      phone,
      address: typeof address === 'object' ? address : {
        street: address,
        city: city || '',
        pincode: pincode || '',
        country: country || 'India'
      },
      items: items.map(item => ({
        productId: item.productId || null,
        name: item.name,
        price: Number(item.price),
        quantity: Number(item.quantity),
        image: item.image || null
      })),
      totalAmount: finalTotal || amount,
      paymentMethod: paymentMethod || 'online',
      paymentStatus: 'pending',
      upfrontAmount: upfrontAmount || 0,
      remainingAmount: remainingAmount || 0,
      sellerToken,
      phonepeMerchantOrderId: merchantOrderId, // Store for webhook lookup
      couponCode,
      scheduledDelivery: scheduledDelivery ? new Date(scheduledDelivery) : null
    });

    const savedOrder = await newOrder.save();
    console.log(`[createPhonePeOrder] Pending order created: ${customOrderId}`);

    // Prepare payload according to PhonePe API documentation
    const payload = {
      merchantOrderId: merchantOrderId,
      amount: Math.round(amount * 100), // Convert to paise
      expireAfter: 1200, // 20 minutes expiry
      metaInfo: {
        udf1: customerName,
        udf2: email,
        udf3: phone,
        udf4: sellerToken || '',
        udf5: couponCode || '',
        udf6: upfrontAmount ? `upfront:${upfrontAmount}` : '',
        udf7: remainingAmount ? `remaining:${remainingAmount}` : ''
      },
      paymentFlow: {
        type: 'PG_CHECKOUT',
        message: paymentMethod === 'cod'
          ? `Upfront payment ₹${upfrontAmount} for COD order ${merchantOrderId}`
          : `Payment for order ${merchantOrderId}`,
        merchantUrls: {
          redirectUrl: `${frontendUrl.replace(/\/+$/, '')}/payment/status?orderId=${merchantOrderId}`
        }
      }
    };

    console.log(`Making PhonePe API request for order ${customOrderId}`);

    const response = await axios.post(
      baseUrl + apiEndpoint,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `O-Bearer ${accessToken}`
        },
        timeout: 30000
      }
    );

    // Success response from PhonePe
    if (response.data && response.data.orderId) {
      const redirectUrl = response.data.redirectUrl;
      const phonepeOrderId = response.data.orderId;
      const state = response.data.state;

      // Update order with PhonePe's transaction ID
      savedOrder.transactionId = phonepeOrderId;
      await savedOrder.save();

      return res.json({
        success: true,
        redirectUrl,
        orderId: phonepeOrderId,
        merchantOrderId: merchantOrderId,
        state: state,
        order: savedOrder
      });
    } else {
      console.error('PhonePe payment initiation failed:', response.data);
      // Optionally cleanup the order or mark as failed
      savedOrder.paymentStatus = 'failed';
      await savedOrder.save();

      return res.status(500).json({
        success: false,
        message: response.data.message || 'PhonePe payment initiation failed',
        data: response.data
      });
    }

  } catch (error) {
    console.error('PhonePe order error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create PhonePe order',
    });
  }
};

// ----------------------------
// PhonePe Webhook handler
// ----------------------------
exports.phonePeWebhook = async (req, res) => {
  console.log("[phonePeWebhook] Received webhook callback");

  try {
    // 1. Verify Authorization Header
    // Format: SHA256(username:password)
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      console.warn("[phonePeWebhook] Missing Authorization header");
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const webhookUsername = process.env.PHONEPE_WEBHOOK_USERNAME;
    const webhookPassword = process.env.PHONEPE_WEBHOOK_PASSWORD;

    if (!webhookUsername || !webhookPassword) {
      console.error("[phonePeWebhook] Webhook credentials not configured in .env");
      return res.status(500).json({ success: false, message: "Server configuration error" });
    }

    // Calculate expected hash
    const expectedHash = crypto.createHash('sha256')
      .update(`${webhookUsername}:${webhookPassword}`)
      .digest('hex');

    // Check if it matches (case-insensitive check is safer for hex)
    if (authHeader.toLowerCase() !== expectedHash.toLowerCase()) {
      console.warn("[phonePeWebhook] Invalid Authorization header");
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // 2. Parse Payload
    const { event, payload } = req.body;
    console.log("[phonePeWebhook] Event:", event);

    if (!event || !payload) {
      return res.status(400).json({ success: false, message: "Invalid payload structure" });
    }

    // 3. Handle Events
    if (event === 'checkout.order.completed') {
      const { merchantOrderId, transactionId, state } = payload;

      console.log(`[phonePeWebhook] Processing completed order: ${merchantOrderId}`);

      if (state !== 'COMPLETED') {
        console.log(`[phonePeWebhook] Order state is ${state}, ignoring.`);
        return res.status(200).json({ success: true, message: "Ignored non-completed state" });
      }

      // Find order
      const order = await Order.findOne({ phonepeMerchantOrderId: merchantOrderId });

      if (!order) {
        console.warn(`[phonePeWebhook] Order not found for Merchant Order ID: ${merchantOrderId}`);
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      if (order.paymentStatus === 'completed') {
        console.log(`[phonePeWebhook] Order ${order.customOrderId} already marked as completed`);
        return res.status(200).json({ success: true, message: "Already processed" });
      }

      // Update Order
      order.paymentStatus = "completed";
      order.transactionId = transactionId || merchantOrderId;
      await order.save();

      console.log(`[phonePeWebhook] Updated order ${order.customOrderId} status to Completed`);

      // 4. Post-payment logic: Commission, Stock, Notifications
      // This is exactly what was in orderController.js

      // -- Commission Logic --
      if (order.sellerToken) {
        const seller = await Seller.findOne({ sellerToken: order.sellerToken });
        if (seller) {
          const commissionAmount = order.totalAmount * 0.30;
          try {
            await commissionController.createCommissionEntry(order._id, seller._id, order.totalAmount, 0.30);
          } catch (err) { console.error('Commission error:', err); }
        }
      }

      // -- Stock Logic --
      for (const item of order.items) {
        if (item.productId) {
          try {
            const product = await Product.findById(item.productId);
            if (product) {
              product.stock = Math.max(0, (product.stock || 0) - (item.quantity || 1));
              if (product.stock === 0) product.inStock = false;
              await product.save();
            }
          } catch (err) { console.error('Stock update error:', err); }
        }
      }

      // -- Send Notifications --
      const { sendOrderConfirmationEmail } = require('./orderController');
      sendOrderConfirmationEmail(order).catch(err =>
        console.error("[phonePeWebhook] Notification error:", err)
      );

      return res.status(200).json({ success: true, message: "Webhook processed successfully" });

    } else if (event === 'checkout.order.failed') {
      console.log(`[phonePeWebhook] Payment failed for order: ${payload.merchantOrderId}`);
      await Order.findOneAndUpdate(
        { phonepeMerchantOrderId: payload.merchantOrderId },
        { paymentStatus: 'failed' }
      );
      return res.status(200).json({ success: true, message: "Payment failed event received" });
    } else {
      console.log(`[phonePeWebhook] Unhandled event type: ${event}`);
      return res.status(200).json({ success: true, message: "Event ignored" });
    }

  } catch (error) {
    console.error("[phonePeWebhook] Error processing webhook:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.phonePeCallback = async (req, res) => {
  try {
    // Accept both merchantOrderId and orderId, but use orderId for status check
    const { merchantOrderId, orderId, amount, status, code, merchantId } = req.body;
    console.log('PhonePe callback received:', req.body);
    if (!merchantOrderId || !orderId || !status) {
      return res.status(400).json({
        success: false,
        message: 'Invalid callback data: merchantOrderId, orderId, and status are required'
      });
    }
    try {
      const accessToken = await getPhonePeToken();
      const env = process.env.PHONEPE_ENV || 'sandbox';
      const baseUrl = env === 'production'
        ? 'https://api.phonepe.com/apis/pg'
        : 'https://api-preprod.phonepe.com/apis/pg-sandbox';
      // Use orderId (PhonePe's transaction ID) for status check
      const apiEndpoint = `/checkout/v2/order/${orderId}/status`;
      const response = await axios.get(
        baseUrl + apiEndpoint,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `O-Bearer ${accessToken}`
          },
          timeout: 30000
        }
      );
      console.log('PhonePe verification response:', response.data);
      if (response.data && response.data.state === 'COMPLETED') {
        console.log(`Payment completed for transaction: ${merchantOrderId}`);
        // Update order in DB and send confirmation email
        const order = await Order.findOneAndUpdate(
          { transactionId: orderId },
          { paymentStatus: 'completed' },
          { new: true }
        );
        if (order) {
          await sendOrderConfirmationEmail(order);
        } else {
          console.warn('Order not found for transactionId:', orderId);
        }
        return res.json({
          success: true,
          message: 'Payment completed successfully',
          orderId: orderId,
          merchantOrderId: merchantOrderId,
          status: 'COMPLETED'
        });
      } else if (response.data && response.data.state === 'FAILED') {
        console.log(`Payment failed for transaction: ${merchantOrderId}`);
        return res.json({
          success: false,
          message: 'Payment failed',
          orderId: orderId,
          merchantOrderId: merchantOrderId,
          status: 'FAILED',
          errorCode: response.data.errorCode,
          detailedErrorCode: response.data.detailedErrorCode
        });
      } else {
        console.log(`Payment pending for transaction: ${merchantOrderId}`);
        return res.json({
          success: true,
          message: 'Payment is pending',
          orderId: orderId,
          merchantOrderId: merchantOrderId,
          status: 'PENDING'
        });
      }
    } catch (verificationError) {
      console.error('PhonePe verification error:', verificationError);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify payment with PhonePe'
      });
    }
  } catch (error) {
    console.error('PhonePe callback error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process callback'
    });
  }
};

exports.getPhonePeStatus = async (req, res) => {
  try {
    // Accept both merchantOrderId and orderId, but use orderId for status check
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'PhonePe orderId (transaction ID) is required'
      });
    }
    const env = process.env.PHONEPE_ENV || 'sandbox';
    const accessToken = await getPhonePeToken();
    const baseUrl = env === 'production'
      ? 'https://api.phonepe.com/apis/pg'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';
    const apiEndpoint = `/checkout/v2/order/${orderId}/status`;
    console.log(`Checking PhonePe status for orderId: ${orderId}`);
    console.log(`API URL: ${baseUrl}${apiEndpoint}`);
    const response = await axios.get(
      baseUrl + apiEndpoint,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `O-Bearer ${accessToken}`
        },
        timeout: 30000
      }
    );
    console.log('PhonePe status response:', response.data);
    // Only COMPLETED is considered success; all others are not
    // Try to extract merchantOrderId from metaInfo if available
    let merchantOrderId = null;
    if (response.data && response.data.metaInfo && response.data.metaInfo.merchantOrderId) {
      merchantOrderId = response.data.metaInfo.merchantOrderId;
    } else if (response.data && response.data.orderId) {
      // Optionally, look up merchantOrderId from your DB if you store the mapping
      // merchantOrderId = await lookupMerchantOrderId(response.data.orderId);
    }
    if (response.data && response.data.state) {
      return res.json({
        success: response.data.state === 'COMPLETED',
        data: {
          orderId: response.data.orderId,
          merchantOrderId,
          state: response.data.state,
          amount: response.data.amount,
          expireAt: response.data.expireAt,
          paymentDetails: response.data.paymentDetails || [],
          errorCode: response.data.errorCode,
          detailedErrorCode: response.data.detailedErrorCode,
          errorContext: response.data.errorContext
        },
        message: response.data.state === 'COMPLETED' ? 'Payment completed' : (response.data.state === 'FAILED' ? 'Payment failed' : 'Payment pending')
      });
    } else if (response.data && response.data.success === false) {
      return res.status(400).json({
        success: false,
        message: response.data.message || 'Failed to get transaction status',
        code: response.data.code
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid response from PhonePe'
      });
    }
  } catch (error) {
    const phonePeError = error.response?.data;
    console.error('PhonePe status check error:', phonePeError || error.message);
    if (phonePeError && typeof phonePeError === 'object') {
      return res.status(error.response.status || 500).json({
        success: false,
        message: phonePeError.message || 'PhonePe error',
        code: phonePeError.code,
        data: phonePeError.data || null
      });
    }
    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    } else if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed'
      });
    } else if (error.code === 'ECONNABORTED') {
      return res.status(408).json({
        success: false,
        message: 'Request timeout'
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to check transaction status'
    });
  }
};

// Refund API implementation
exports.refundPayment = async (req, res) => {
  try {
    const { merchantRefundId, originalMerchantOrderId, amount } = req.body;

    if (!merchantRefundId || !originalMerchantOrderId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Refund details are required'
      });
    }

    const env = process.env.PHONEPE_ENV || 'sandbox';
    const accessToken = await getPhonePeToken();

    const baseUrl = env === 'production'
      ? 'https://api.phonepe.com/apis/pg'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

    const apiEndpoint = '/payments/v2/refund';

    const payload = {
      merchantRefundId,
      originalMerchantOrderId,
      amount: Math.round(amount * 100) // Convert to paise
    };

    const response = await axios.post(
      baseUrl + apiEndpoint,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `O-Bearer ${accessToken}`
        },
        timeout: 30000
      }
    );

    if (response.data && response.data.success) {
      return res.json({
        success: true,
        data: response.data.data
      });
    } else {
      return res.status(400).json({
        success: false,
        message: response.data.message || 'Failed to process refund'
      });
    }

  } catch (error) {
    console.error('PhonePe refund error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to process refund'
    });
  }
};

// Refund status check
exports.getRefundStatus = async (req, res) => {
  try {
    const { merchantRefundId } = req.params;

    if (!merchantRefundId) {
      return res.status(400).json({
        success: false,
        message: 'Refund ID is required'
      });
    }

    const env = process.env.PHONEPE_ENV || 'sandbox';
    const accessToken = await getPhonePeToken();

    const baseUrl = env === 'production'
      ? 'https://api.phonepe.com/apis/pg'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

    const apiEndpoint = `/payments/v2/refund/${merchantRefundId}/status`;

    const response = await axios.get(
      baseUrl + apiEndpoint,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `O-Bearer ${accessToken}`
        },
        timeout: 30000
      }
    );

    if (response.data && response.data.success) {
      return res.json({
        success: true,
        data: response.data.data
      });
    } else {
      return res.status(400).json({
        success: false,
        message: response.data.message || 'Failed to get refund status'
      });
    }

  } catch (error) {
    console.error('PhonePe refund status error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to check refund status'
    });
  }
};