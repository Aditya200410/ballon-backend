const DataPage = require('../models/DataPage');

// Get all data pages
const dataPageController = async (req, res) => {
  try {
    console.log('Fetching all data pages...');
    const pages = await DataPage.find();
    console.log('Found pages:', pages);
    res.json(pages);
  } catch (err) {
    console.error('Error fetching data pages:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get data page by type
exports.getDataPageByType = async (req, res) => {
  try {
    const { type } = req.params;
    const page = await DataPage.findOne({ type });
    if (!page) return res.status(404).json({ error: 'Not found' });
    res.json(page);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add new data page
exports.addDataPage = async (req, res) => {
  try {
    const { type, heading, content } = req.body;
    const exists = await DataPage.findOne({ type });
    if (exists) return res.status(400).json({ error: 'Type already exists' });
    const page = new DataPage({ type, heading, content });
    await page.save();
    res.status(201).json(page);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update data page by type
exports.updateDataPage = async (req, res) => {
  try {
    const { type } = req.params;
    const { heading, content } = req.body;
    const page = await DataPage.findOneAndUpdate(
      { type },
      { heading, content },
      { new: true }
    );
    if (!page) return res.status(404).json({ error: 'Not found' });
    res.json(page);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all data pages
exports.getAllDataPages = dataPageController;

// Initialize default policies data
exports.initializePolicies = async (req, res) => {
  try {
    console.log('Initializing default policies...');
    
    const defaultPolicies = [
      {
        type: 'terms',
        heading: 'Terms and Conditions',
        content: `Terms and Conditions:
Welcome to RikoCraft. By accessing our website, you agree to these terms and conditions.

Acceptance of Terms:
By using our services, you acknowledge that you have read, understood, and agree to be bound by these terms.

User Accounts:
You are responsible for maintaining the confidentiality of your account information and for all activities under your account.

Product Information:
We strive to provide accurate product descriptions, but we do not warrant that product descriptions are accurate, complete, or current.

Pricing and Payment:
All prices are subject to change without notice. Payment must be made at the time of order placement.

Shipping and Delivery:
Delivery times are estimates only. We are not responsible for delays beyond our control.

Returns and Refunds:
Please refer to our Refund Policy for detailed information about returns and refunds.

Intellectual Property:
All content on this website is protected by copyright and other intellectual property laws.

Limitation of Liability:
We shall not be liable for any indirect, incidental, or consequential damages.

Governing Law:
These terms are governed by the laws of India.`
      },
      {
        type: 'refund',
        heading: 'Refund Policy',
        content: `Refund Policy:
We want you to be completely satisfied with your purchase from RikoCraft.

Eligibility for Refunds:
Items must be returned within 30 days of delivery in their original condition.

Return Process:
Contact our customer service team to initiate a return. Provide your order number and reason for return.

Return Shipping:
Customers are responsible for return shipping costs unless the item is defective or incorrect.

Refund Timeline:
Refunds are processed within 5-7 business days after we receive your return.

Non-Refundable Items:
Custom or personalized items cannot be returned unless defective.

Damaged Items:
If you receive a damaged item, contact us immediately with photos for replacement or refund.

Quality Issues:
We stand behind the quality of our products. Contact us for any quality concerns.

Refund Methods:
Refunds are issued to the original payment method used for the purchase.

International Returns:
International customers may be subject to additional shipping and customs fees.

Contact Information:
For return inquiries, email us at support@rikocraft.com or call our customer service.`
      },
      {
        type: 'privacy',
        heading: 'Privacy Policy',
        content: `Privacy Policy:
Your privacy is important to us. This policy explains how we collect, use, and protect your information.

Information We Collect:
We collect information you provide directly to us, such as name, email, address, and payment information.

How We Use Information:
We use your information to process orders, communicate with you, and improve our services.

Information Sharing:
We do not sell, trade, or rent your personal information to third parties.

Data Security:
We implement appropriate security measures to protect your personal information.

Cookies and Tracking:
We use cookies to enhance your browsing experience and analyze website traffic.

Third-Party Services:
We may use third-party services for payment processing and analytics.

Data Retention:
We retain your information as long as necessary to provide our services and comply with legal obligations.

Your Rights:
You have the right to access, update, or delete your personal information.

Children's Privacy:
Our services are not intended for children under 13 years of age.

Changes to Policy:
We may update this privacy policy from time to time.`
      }
    ];

    // Check if policies already exist
    const existingPolicies = await DataPage.find();
    if (existingPolicies.length > 0) {
      console.log('Policies already exist, skipping initialization');
      return res.json({ message: 'Policies already exist', count: existingPolicies.length });
    }

    // Add default policies
    const result = await DataPage.insertMany(defaultPolicies);
    console.log('Initialized policies:', result.length);
    
    res.status(201).json({ 
      message: 'Policies initialized successfully', 
      count: result.length,
      policies: result 
    });
  } catch (err) {
    console.error('Error initializing policies:', err);
    res.status(500).json({ error: err.message });
  }
}; 