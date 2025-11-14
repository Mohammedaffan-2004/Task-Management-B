const crypto = require("crypto");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { signAccessToken, signRefreshToken } = require("../utils/generateToken");


const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");


const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  
  // Validate input
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Please provide all fields" });
  }

  // Validate password length
  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  // Check if user already exists
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(400).json({ message: "User already exists" });
  }

  // ✅ SECURITY FIX: Never accept role from request body
  // All new registrations are Members by default (model handles this)
  const user = await User.create({ 
    name, 
    email: email.toLowerCase(), 
    password,
    // role is NOT set here - defaults to "Member" in model
  });

  // Generate tokens
  const accessToken = signAccessToken(user._id, user.role);
  const refreshToken = signRefreshToken();
  const hashedRT = hashToken(refreshToken);

  // Save refresh token to user
  user.refreshTokens.push({
    token: hashedRT,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  await user.save();

  // Set httpOnly cookies
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 15 * 60 * 1000, // 15 mins
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.status(201).json({
    token: accessToken,
    user: { 
      id: user._id, 
      name: user.name, 
      email: user.email, 
      role: user.role 
    },
  });
});

// @desc Login user
// @route POST /api/auth/login
// @access Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: "Please provide email and password" });
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select("+password +refreshTokens");

  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  // Update last login
  user.lastLogin = new Date();

  // Generate tokens
  const accessToken = signAccessToken(user._id, user.role);
  const refreshToken = signRefreshToken();
  const hashedRT = hashToken(refreshToken);

  user.refreshTokens.push({
    token: hashedRT,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  // Clean expired tokens
  user.refreshTokens = user.refreshTokens.filter((t) => new Date(t.expiresAt) > new Date());
  await user.save();

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 15 * 60 * 1000,
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    token: accessToken,
    user: { 
      id: user._id, 
      name: user.name, 
      email: user.email, 
      role: user.role 
    },
  });
});

// @desc Refresh token
// @route POST /api/auth/refresh
// @access Public
const refreshToken = asyncHandler(async (req, res) => {
  const refreshTokenPlain = req.cookies?.refreshToken;
  
  if (!refreshTokenPlain) {
    return res.status(401).json({ message: "No refresh token provided" });
  }

  const hashed = hashToken(refreshTokenPlain);
  const user = await User.findOne({ "refreshTokens.token": hashed }).select("+refreshTokens");
  
  if (!user) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  const tokenDoc = user.refreshTokens.find((t) => t.token === hashed);
  if (!tokenDoc || new Date(tokenDoc.expiresAt) < new Date()) {
    return res.status(401).json({ message: "Expired refresh token" });
  }

  // Rotate refresh token
  const newRT = signRefreshToken();
  const newHashed = hashToken(newRT);
  user.refreshTokens = user.refreshTokens.filter((t) => t.token !== hashed);
  user.refreshTokens.push({
    token: newHashed,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  await user.save();

  const newAccess = signAccessToken(user._id, user.role);
  
  res.cookie("accessToken", newAccess, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 15 * 60 * 1000,
  });

  res.cookie("refreshToken", newRT, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ message: "Tokens refreshed successfully" });
});

// @desc Logout user
// @route POST /api/auth/logout
// @access Private
const logoutUser = asyncHandler(async (req, res) => {
  const refreshTokenPlain = req.cookies?.refreshToken;
  
  if (refreshTokenPlain) {
    const hashed = hashToken(refreshTokenPlain);
    const user = await User.findById(req.user._id).select("+refreshTokens");
    
    if (user) {
      user.refreshTokens = user.refreshTokens.filter((t) => t.token !== hashed);
      await user.save();
    }
  }

  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.json({ message: "Logged out successfully" });
});

// @desc Get current user profile
// @route GET /api/auth/me
// @access Private
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
  });
});

// @desc Update user profile
// @route PUT /api/auth/update
// @access Private
const updateProfile = asyncHandler(async (req, res) => {
  const { name, password } = req.body;
  
  const user = await User.findById(req.user._id).select("+password");
  
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Update name if provided
  if (name && name.trim()) {
    user.name = name.trim();
  }

  // Update password if provided
  if (password && password.trim()) {
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    user.password = password; // Will be hashed by pre-save hook
  }

  await user.save();

  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
});

// @desc Get all users (Admin only)
// @route GET /api/auth/users
// @access Private/Admin
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find();
  
  res.json(users.map(u => ({
    _id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    lastLogin: u.lastLogin,
    createdAt: u.createdAt,
  })));
});

// @desc Forgot password
// @route POST /api/auth/forgot-password
// @access Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });
  
  if (!user) {
    return res.status(200).json({ message: "If the email exists, a link will be sent" });
  }

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetURL = `${process.env.CORS_ORIGIN}/reset-password/${resetToken}`;
  
  // For now, just log (you can integrate email service later)
  console.log(`Password reset URL: ${resetURL}`);
  
  res.status(200).json({ 
    message: "Password reset link sent to email",
    // Remove in production:
    resetUrl: process.env.NODE_ENV === "development" ? resetURL : undefined 
  });
});

// @desc Reset password
// @route POST /api/auth/reset-password/:token
// @access Public
const resetPassword = asyncHandler(async (req, res) => {
  const hashed = crypto.createHash("sha256").update(req.params.token).digest("hex");
  const user = await User.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpires: { $gt: Date.now() },
  }).select("+resetPasswordToken +resetPasswordExpires");
  
  if (!user) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({ message: "Password reset successful" });
});

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  refreshToken,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  getAllUsers,
};