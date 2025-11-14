const jwt = require("jsonwebtoken");
const crypto = require("crypto");


const signAccessToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "15m", 
  });
};


const signRefreshToken = () => {
  return crypto.randomBytes(64).toString("hex");
};


const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyToken,
};