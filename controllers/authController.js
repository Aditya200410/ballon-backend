const jwt = require('jsonwebtoken');

const login = (req, res) => {
  const { username, email, password } = req.body;

  // Validate input - accept either username or email
  if ((!username && !email) || !password) {
    return res.status(400).json({ message: "Email/Username and password are required" });
  }

  // Use either username or email for authentication
  const loginCredential = username || email;

  // For demo purposes, using hardcoded admin credentials
  // In production, you should use a proper database and password hashing
  if (loginCredential === "koushik048@gmail.com" && password === "Riko!@#123") {
    const token = jwt.sign(
      { 
        id: 1, 
        username: "koushik048@gmail.com",
        email: "koushik048@gmail.com",
        isAdmin: true 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: 1,
        username: "koushik048@gmail.com",
        email: "koushik048@gmail.com",
        isAdmin: true
      }
    });
  } else {
    res.status(401).json({ message: "Invalid credentials" });
  }
};

module.exports = {
  login
}; 