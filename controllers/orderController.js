const Order = require('../models/Order');
const Seller = require('../models/Seller');
const fs = require('fs').promises;
const path = require('path');
const ordersJsonPath = path.join(__dirname, '../data/orders.json');
const Product = require('../models/Product');
const commissionController = require('./commissionController');
const nodemailer = require('nodemailer');

// Setup nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Create a new order
const createOrder = async (req, res) => {
  try {
    const {
      customerName,
      email,
      phone,
      address, // Expects the full address object, including optional location
      items,
      totalAmount,
      paymentMethod,
      paymentStatus,
      upfrontAmount,
      remainingAmount,
      sellerToken,
      transactionId,
      couponCode,
      scheduledDelivery, // NEW: Get scheduled delivery date/time
      addOns,           // NEW: Get optional add-ons
    } = req.body;

    // Comprehensive validation
    const requiredFields = ['customerName', 'email', 'phone', 'address', 'items', 'totalAmount', 'paymentMethod', 'paymentStatus'];
    const missingFields = requiredFields.filter(field => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }

    // Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Items array is required and must not be empty.' 
      });
    }

    // Validate each item has required fields
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemRequiredFields = ['name', 'price', 'quantity'];
      const missingItemFields = itemRequiredFields.filter(field => !item[field]);
      
      if (missingItemFields.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: `Item ${i + 1} is missing required fields: ${missingItemFields.join(', ')}` 
        });
      }
    }

    const newOrder = new Order({
      customerName,
      email,
      phone,
      address, // Use the address object directly
      items,
      totalAmount,
      paymentMethod,
      paymentStatus, // Ensure your schema handles mapping if needed
      upfrontAmount: upfrontAmount || 0,
      remainingAmount: remainingAmount || 0,
      sellerToken,
      transactionId,
      couponCode,
      scheduledDelivery, // NEW: Save scheduled delivery
      addOns,           // NEW: Save add-ons
    });

    const savedOrder = await newOrder.save();

    // --- Commission and Stock Logic (unchanged) ---
    let commission = 0;
    let seller = null;
    
    if (sellerToken) {
      seller = await Seller.findOne({ sellerToken });
      if (seller) {
        commission = totalAmount * 0.30;
        try {
          await commissionController.createCommissionEntry(savedOrder._id, seller._id, totalAmount, 0.30);
          console.log(`Commission entry created for seller ${seller.businessName}: ₹${commission}`);
        } catch (commissionError) {
          console.error('Failed to create commission entry:', commissionError);
        }
      }
    }

    for (const item of items) {
      if (item.productId) {
        const product = await Product.findById(item.productId);
        if (product) {
          product.stock = Math.max(0, (product.stock || 0) - (item.quantity || 1));
          if (product.stock === 0) {
            product.inStock = false;
          }
          await product.save();
        }
      }
    }
    // --- End of Commission and Stock Logic ---

    await appendOrderToJson(savedOrder);

    // Send the redesigned order confirmation email
    sendOrderConfirmationEmail(savedOrder);
    
    res.status(201).json({ 
      success: true, 
      message: 'Order created successfully!', 
      order: savedOrder,
      commission: seller ? { amount: commission, sellerName: seller.businessName } : null
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: 'Failed to create order.', error: error.message });
  }
};


// Helper to send the NEW redesigned order confirmation email
async function sendOrderConfirmationEmail(order) {
  const { email, customerName, items, addOns, totalAmount, address, scheduledDelivery, _id } = order;
  const subject = '🎉 Let\'s Get this Party Started! Your Order is Confirmed!';

  // Build order items table
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 10px; border: 1px solid #FFECB3;">${item.name}</td>
      <td style="padding: 10px; border: 1px solid #FFECB3; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border: 1px solid #FFECB3; text-align: right;">₹${item.price.toFixed(2)}</td>
    </tr>
  `).join('');
  
  // Build add-ons table (if they exist)
  let addOnsHtml = '';
  if (addOns && addOns.length > 0) {
      const addOnRows = addOns.map(addOn => `
          <tr>
              <td style="padding: 8px; border: 1px solid #FFECB3;">+ ${addOn.name}</td>
              <td colspan="2" style="padding: 8px; border: 1px solid #FFECB3; text-align: right;">₹${addOn.price.toFixed(2)}</td>
          </tr>
      `).join('');
      addOnsHtml = `<h3 style="color: #444; border-bottom: 2px solid #FFD700; padding-bottom: 5px; margin-top: 25px; margin-bottom: 10px; font-size: 18px;">✨ Add-Ons</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tbody>${addOnRows}</tbody>
      </table>`;
  }

  // Format Address with Map Link
  let mapLink = '';
  if (address.location && address.location.coordinates && address.location.coordinates.length === 2) {
      const [lng, lat] = address.location.coordinates;
      mapLink = `<br/><a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="color: #E65100; font-weight: bold; text-decoration: none;">📍 View on Map</a>`;
  }
  const addressHtml = `
    <p style="margin: 0; line-height: 1.6;">
      ${address.street || ''}<br/>
      ${address.city || ''}, ${address.state || ''} - ${address.pincode || ''}<br/>
      ${address.country || ''}
      ${mapLink}
    </p>
  `;

  // Format Scheduled Delivery
  let scheduledDeliveryHtml = '';
  if (scheduledDelivery) {
      const deliveryDate = new Date(scheduledDelivery);
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' };
      const formattedDate = deliveryDate.toLocaleString('en-IN', options);
      scheduledDeliveryHtml = `
          <div style="margin-bottom: 20px; padding: 10px; background-color: #FFF9C4; border-left: 4px solid #FBC02D; color: #444;">
              <strong>Scheduled For:</strong><br/>
              📅 ${formattedDate}
          </div>
      `;
  }

  const htmlBody = `
    <div style="font-family: 'Comic Sans MS', 'Chalkboard SE', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #FFFDE7; border: 5px solid #FFD700; border-radius: 15px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
      <div style="text-align: center; border-bottom: 2px dashed #FFC107; padding-bottom: 15px; margin-bottom: 25px;">
        <h1 style="color: #FF6F00; margin: 0; font-size: 32px;">Decoryy!</h1>
        <p style="color: #666; margin: 5px 0; font-size: 16px;">Your Celebration Starts Here!</p>
      </div>
      <div style="padding: 0 10px;">
        <p style="color: #333; font-size: 18px; line-height: 1.6; margin: 0;">
          Hey <strong>${customerName}</strong>,
        </p>
        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 15px 0 25px 0;">
          Woohoo! Your order is confirmed and the party preparations have begun. We're so excited to help make your event special. Here are the details:
        </p>
        
        ${scheduledDeliveryHtml}

        <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
          <div style="width: 48%;">
            <h3 style="color: #444; border-bottom: 2px solid #FFD700; padding-bottom: 5px; margin-top: 0; font-size: 18px;">🚚 Shipping To</h3>
            ${addressHtml}
          </div>
          <div style="width: 48%;">
            <h3 style="color: #444; border-bottom: 2px solid #FFD700; padding-bottom: 5px; margin-top: 0; font-size: 18px;">📋 Order ID</h3>
            <p style="margin: 0; line-height: 1.6;">#${_id}</p>
          </div>
        </div>

        <h3 style="color: #444; border-bottom: 2px solid #FFD700; padding-bottom: 5px; margin-bottom: 10px; font-size: 18px;">🎈 Your Goodies</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 14px;">
          <thead>
            <tr>
              <th style="padding: 10px; border: 1px solid #FFECB3; background: #FFF176; text-align: left;">Item</th>
              <th style="padding: 10px; border: 1px solid #FFECB3; background: #FFF176;">Qty</th>
              <th style="padding: 10px; border: 1px solid #FFECB3; background: #FFF176; text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        ${addOnsHtml}

        <div style="text-align: right; margin: 20px 0; font-size: 18px; font-weight: bold; color: #333;">
          Total: ₹${totalAmount.toFixed(2)}
        </div>
        
        <div style="border-top: 2px dashed #FFC107; padding-top: 20px; margin-top: 20px; text-align: center;">
          <p style="color: #555; font-size: 14px; margin: 0;">
            If you have any questions, just reply to this email. We're here to help!
          </p>
          <p style="color: #555; font-size: 16px; margin: 15px 0;">
            <strong>Thanks for choosing us!</strong><br>
            The Decoryy Team 🥳
          </p>
        </div>
      </div>
    </div>
  `;

  // Plain text version
  const textBody = `Hey ${customerName},\n\nWoohoo! Your Decoryy order is confirmed! Here are the details:\n\nOrder ID: #${_id}\n\nItems:\n${items.map(item => `- ${item.name} x${item.quantity} (₹${item.price.toFixed(2)})`).join('\n')}\n\n${addOns && addOns.length > 0 ? 'Add-Ons:\n' + addOns.map(a => `- ${a.name} (₹${a.price.toFixed(2)})`).join('\n') + '\n' : ''}Total: ₹${totalAmount.toFixed(2)}\n\nShipping Address:\n${address.street || ''}\n${address.city || ''}, ${address.state || ''} - ${address.pincode || ''}\n${address.country || ''}\n\n${scheduledDelivery ? 'Scheduled For: ' + new Date(scheduledDelivery).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + '\n' : ''}\nThanks for choosing us!\nThe Decoryy Team 🥳`;

  try {
    await transporter.sendMail({
      from: `"Decoryy" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      text: textBody,
      html: htmlBody,
    });
    console.log(`Order confirmation email sent to ${email}`);
  } catch (mailErr) {
    console.error('Error sending order confirmation email:', mailErr);
  }
}


// --- Unchanged Functions (getOrdersByEmail, getOrderById, appendOrderToJson) ---
// These functions do not need to be modified for this request.
// I have included them here for completeness.

const getOrdersByEmail = async (req, res) => {
  try {
    const userEmail = req.query.email;
    if (!userEmail) {
      return res.status(400).json({ success: false, message: 'Email query parameter is required.' });
    }
    const orders = await Order.find({ email: { $regex: new RegExp(`^${userEmail}$`, 'i') } }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch orders.', error: error.message });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error('Error fetching order by ID:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch order.', error: error.message });
  }
};

async function appendOrderToJson(order) {
  try {
    let orders = [];
    try {
      const data = await fs.readFile(ordersJsonPath, 'utf8');
      orders = JSON.parse(data);
      if (!Array.isArray(orders)) orders = [];
    } catch (err) {
      orders = [];
    }
    orders.push(order.toObject ? order.toObject({ virtuals: true }) : order);
    await fs.writeFile(ordersJsonPath, JSON.stringify(orders, null, 2));
  } catch (err) {
    console.error('Failed to append order to orders.json:', err);
  }
}


// BONUS: Updated Order Status Email with new branding
async function sendOrderStatusUpdateEmail(order) {
  const { email, customerName, orderStatus, _id } = order;
  const subject = `🥳 Party Update! Your Order is Now: ${orderStatus.charAt(0).toUpperCase() + orderStatus.slice(1)}`;

  const htmlBody = `
    <div style="font-family: 'Comic Sans MS', 'Chalkboard SE', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #FFFDE7; border: 5px solid #FFD700; border-radius: 15px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
      <div style="text-align: center; border-bottom: 2px dashed #FFC107; padding-bottom: 15px; margin-bottom: 25px;">
        <h1 style="color: #FF6F00; margin: 0; font-size: 32px;">Decoryy!</h1>
        <p style="color: #666; margin: 5px 0; font-size: 16px;">An Update on Your Celebration!</p>
      </div>
      <div style="padding: 0 10px;">
        <p style="color: #333; font-size: 18px; line-height: 1.6; margin: 0;">
          Hi <strong>${customerName}</strong>,
        </p>
        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 15px 0;">
          Just a quick note to let you know your order #${_id} has been updated.
        </p>
        <div style="text-align: center; margin: 25px 0; padding: 15px; background-color: #FFF9C4; border-radius: 10px; border: 2px solid #FBC02D;">
          <p style="margin: 0; font-size: 16px; color: #555;">New Status:</p>
          <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #E65100;">${orderStatus.charAt(0).toUpperCase() + orderStatus.slice(1)}</p>
        </div>
        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 25px 0;">
          We're working hard to get your goodies to you. We'll send another update when it's on its way!
        </p>
        <div style="border-top: 2px dashed #FFC107; padding-top: 20px; margin-top: 20px; text-align: center;">
          <p style="color: #555; font-size: 16px; margin: 15px 0;">
            <strong>Cheers,</strong><br>
            The Decoryy Team 🥳
          </p>
        </div>
      </div>
    </div>
  `;
  
  const textBody = `Hi ${customerName},\n\nAn update on your Decoryy order #${_id}.\nNew Status: ${orderStatus.charAt(0).toUpperCase() + orderStatus.slice(1)}\n\nCheers,\nThe Decoryy Team 🥳`;

  try {
    await transporter.sendMail({
      from: `"Decoryy" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      text: textBody,
      html: htmlBody,
    });
    console.log(`Order status update email sent to ${email}`);
  } catch (mailErr) {
    console.error('Error sending order status update email:', mailErr);
  }
}

module.exports = {
  createOrder,
  getOrdersByEmail,
  getOrderById,
  sendOrderStatusUpdateEmail,
};