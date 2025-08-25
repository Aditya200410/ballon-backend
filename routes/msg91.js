const express = require('express');
const axios = require('axios');
const router = express.Router();

const msg91Controller = require('../controllers/msg91Controller');

router.post('/send-otp', msg91Controller.sendOtp);
router.post('/verify-otp', msg91Controller.verifyOtp);

router.post('/verify-otp-access-token', async (req, res) => {
  try {
    const { accessToken } = req.body;
    const response = await axios.post(
      'https://control.msg91.com/api/v5/widget/verifyAccessToken',
      {
        "authkey": "458779TNIVxOl3qDwI6866bc33P1",
        "access-token": accessToken
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        }
      }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify OTP access token', details: err.message });
  }
});

module.exports = router; 