const express = require('express');
const router = express.Router();
const axios = require('axios');

router.get('/ip', async (req, res) => {
  try {
    const response = await axios.get('https://api.db-ip.com/v2/free/self');
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch IP info' });
  }
});

module.exports = router; 