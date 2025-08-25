const axios = require('axios');
const jwt = require('jsonwebtoken');

const MSG91_WIDGET_ID = "3567686d316c363335313136";
const MSG91_AUTHKEY = "458779TNIVxOl3qDwI6866bc33P1";
const JWT_SECRET = "your_jwt_secret"; // Change this to a secure secret

exports.sendOtp = async (req, res) => {
  const { phone } = req.body;
  try {
    const response = await axios.post(
      `https://control.msg91.com/api/v5/otp`,
      {
        mobile: phone,
        authkey: MSG91_AUTHKEY,
        // widget_id is not required for the API, but included for reference
      }
    );
    console.log("OTP sent:", response.data);
    res.json({ success: true, data: response.data });
  } catch (err) {
    console.error("Error sending OTP:", err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
};

exports.verifyOtp = async (req, res) => {
  const { phone, otp } = req.body;
  try {
    const response = await axios.get(
      `https://control.msg91.com/api/v5/otp/verify?otp=${otp}&mobile=${phone}&authkey=${MSG91_AUTHKEY}`
    );
    if (response.data && response.data.type === "success") {
      // Issue JWT
      const token = jwt.sign({ phone }, JWT_SECRET, { expiresIn: "7d" });
      console.log("OTP verified, JWT issued for", phone);
      res.json({ success: true, token });
    } else {
      res.status(400).json({ success: false, error: "Invalid OTP" });
    }
  } catch (err) {
    console.error("Error verifying OTP:", err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
}; 