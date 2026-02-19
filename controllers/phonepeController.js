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

// Helper function to process successful payment
const processOrderPayment = async (order, transactionId) => {
  try {
    // Avoid double processing if already completed or upfront paid
    if (order.paymentStatus === 'completed' || order.paymentStatus === 'pending_upfront') {
      console.log(`[processOrderPayment] Order ${order.customOrderId} already processed with status: ${order.paymentStatus}`);
      return order;
    }

    console.log(`[processOrderPayment] Starting post-payment processing for order: ${order.customOrderId}`);

    // Determine target status
    // If it's a COD order, the upfront payment means they now only owe the remaining amount.
    // We use 'pending_upfront' to signify "Paid upfront, pending rest on COD"
    const targetStatus = order.paymentMethod === 'cod' ? 'pending_upfront' : 'completed';

    // Update basic order info
    order.paymentStatus = targetStatus;
    // Store PhonePe's transaction order ID
    if (transactionId) order.transactionId = transactionId;
    await order.save();

    console.log(`[processOrderPayment] Updated order ${order.customOrderId} status to ${targetStatus}`);

    // -- Commission Logic --
    if (order.sellerToken) {
      try {
        const Seller = require('../models/Seller');
        const commissionController = require('./commissionController');
        const seller = await Seller.findOne({ sellerToken: order.sellerToken });
        if (seller) {
          // Calculate commission (example: 30%)
          const commissionRate = 0.30;
          await commissionController.createCommissionEntry(order._id, seller._id, order.totalAmount, commissionRate);
          console.log(`[processOrderPayment] Commission entry created for seller: ${seller.businessName}`);
        }
      } catch (err) {
        console.error('[processOrderPayment] Commission error:', err);
      }
    }

    // -- Stock Logic --
    for (const item of order.items) {
      if (item.productId) {
        try {
          const Product = require('../models/Product');
          const product = await Product.findById(item.productId);
          if (product) {
            product.stock = Math.max(0, (product.stock || 0) - (item.quantity || 1));
            if (product.stock === 0) product.inStock = false;
            await product.save();
          }
        } catch (err) {
          console.error(`[processOrderPayment] Stock update error for product ${item.productId}:`, err);
        }
      }
    }

    // -- Send Notifications --
    try {
      const { sendOrderConfirmationEmail } = require('./orderController');
      await sendOrderConfirmationEmail(order);
      console.log(`[processOrderPayment] Confirmation email sent for order: ${order.customOrderId}`);
    } catch (err) {
      console.error("[processOrderPayment] Notification error:", err);
    }

    return order;
  } catch (error) {
    console.error('[processOrderPayment] Critical error during payment processing:', error);
    throw error;
  }
};

// ----------------------------
// PhonePe Webhook handler
// ----------------------------
exports.phonePeWebhook = async (req, res) => {
  console.log("[phonePeWebhook] Received webhook callback");

  try {
    // 1. Verify Authorization Header
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

    const expectedHash = crypto.createHash('sha256')
      .update(`${webhookUsername}:${webhookPassword}`)
      .digest('hex');

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
      console.log(`[phonePeWebhook] Processing completed event for order: ${merchantOrderId}`);

      if (state !== 'COMPLETED') {
        console.log(`[phonePeWebhook] Order state is ${state}, ignoring.`);
        return res.status(200).json({ success: true, message: "Ignored non-completed state" });
      }

      // Find order by merchantOrderId or PhonePe transactionId
      let order = await Order.findOne({
        $or: [
          { phonepeMerchantOrderId: merchantOrderId },
          { transactionId: transactionId }
        ]
      });

      if (!order) {
        console.warn(`[phonePeWebhook] Order not found for ID: ${merchantOrderId} or ${transactionId}`);
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      // Process the successful payment
      await processOrderPayment(order, transactionId);

      return res.status(200).json({ success: true, message: "Webhook processed successfully" });

    } else if (event === 'checkout.order.failed') {
      console.log(`[phonePeWebhook] Payment failed for order: ${payload.merchantOrderId}`);
      await Order.findOneAndUpdate(
        {
          $or: [
            { phonepeMerchantOrderId: payload.merchantOrderId },
            { transactionId: payload.transactionId }
          ]
        },
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
    const { merchantOrderId, orderId, status } = req.body;
    console.log('PhonePe callback received:', req.body);

    if (!merchantOrderId && !orderId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid callback data: merchantOrderId or orderId required'
      });
    }

    const idToVerify = orderId || merchantOrderId;

    try {
      const accessToken = await getPhonePeToken();
      const env = process.env.PHONEPE_ENV || 'sandbox';
      const baseUrl = env === 'production'
        ? 'https://api.phonepe.com/apis/pg'
        : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

      const apiEndpoint = `/checkout/v2/order/${idToVerify}/status`;
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
        // Find the order
        const order = await Order.findOne({
          $or: [
            { phonepeMerchantOrderId: merchantOrderId },
            { phonepeMerchantOrderId: orderId },
            { transactionId: orderId },
            { transactionId: merchantOrderId }
          ]
        });

        if (order) {
          await processOrderPayment(order, orderId || response.data.orderId);
          return res.json({
            success: true,
            message: 'Payment completed successfully',
            orderId: orderId,
            status: 'COMPLETED'
          });
        } else {
          console.warn('Order not found during callback verification');
          return res.status(404).json({ success: false, message: 'Order not found' });
        }
      } else {
        return res.json({
          success: false,
          message: `Payment status: ${response.data?.state || 'Unknown'}`,
          status: response.data?.state
        });
      }
    } catch (verifError) {
      console.error('PhonePe verification error:', verifError);
      return res.status(500).json({ success: false, message: 'Verification failed' });
    }
  } catch (error) {
    console.error('PhonePe callback error:', error);
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
};

exports.getPhonePeStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const env = process.env.PHONEPE_ENV || 'sandbox';
    const accessToken = await getPhonePeToken();
    const baseUrl = env === 'production'
      ? 'https://api.phonepe.com/apis/pg'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

    const apiEndpoint = `/checkout/v2/order/${orderId}/status`;
    console.log(`Checking PhonePe status for orderId: ${orderId}`);

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

    if (response.data && response.data.state === 'COMPLETED') {
      // PROACTIVE UPDATE: Check if our DB is updated
      const order = await Order.findOne({
        $or: [
          { phonepeMerchantOrderId: orderId },
          { transactionId: orderId }
        ]
      });

      if (order && order.paymentStatus === 'pending') {
        console.log(`[getPhonePeStatus] Proactively updating order ${order.customOrderId} to completed`);
        await processOrderPayment(order, orderId);
      }

      return res.json({
        success: true,
        data: response.data,
        message: 'Payment completed'
      });
    }

    return res.json({
      success: response.data?.state === 'COMPLETED',
      data: response.data,
      message: response.data?.state || 'Unknown'
    });

  } catch (error) {
    console.error('PhonePe status check error:', error.response?.data || error.message);
    return res.status(500).json({ success: false, message: 'Failed to check status' });
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