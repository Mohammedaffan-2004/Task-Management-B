const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    let token = null;

    
    if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: "Not authorized, token missing" 
      });
    }

   
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid token" 
      });
    }

  
    const user = await User.findById(decoded.id).select("-password -refreshTokens -resetPasswordToken -resetPasswordExpires");
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    
    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err.message);
    const expired = err.name === "TokenExpiredError";
    res.status(401).json({
      success: false,
      message: expired ? "Access token expired" : "Not authorized, token failed",
    });
  }
};

module.exports = { protect };