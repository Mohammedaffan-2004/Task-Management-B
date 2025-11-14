const crypto = require("crypto");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { signAccessToken, signRefreshToken } = require("../utils/generateToken");

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const isProd = process.env.NODE_ENV === "production";

// ================= REGISTER USER =================
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Please provide all fields" });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ message: "Password must be at least 6 characters" });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(400).json({ message: "User already exists" });
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
  });

  const accessToken = signAccessToken(user._id, user.role);
  const refreshToken = signRefreshToken();
  const hashedRT = hashToken(refreshToken);

  user.refreshTokens.push({
    token: hashedRT,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  await user.save();

  // ---- COOKIES FIXED FOR CROSS-SITE ----
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
    maxAge: 15 * 60 * 1000,
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(201).json({
    token: accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

// ================= LOGIN USER =================
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide email and password" });
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+password +refreshTokens"
  );

  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  user.lastLogin = new Date();

  const accessToken = signAccessToken(user._id, user.role);
  const refreshToken = signRefreshToken();
  const hashedRT = hashToken(refreshToken);

  user.refreshTokens.push({
    token: hashedRT,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  user.refreshTokens = user.refreshTokens.filter(
    (t) => new Date(t.expiresAt) > new Date()
  );

  await user.save();

  // ---- LOGIN COOKIES (FIXED) ----
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
    maxAge: 15 * 60 * 1000,
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    token: accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

// ================= REFRESH TOKEN =================
const refreshToken = asyncHandler(async (req, res) => {
  const refreshTokenPlain = req.cookies?.refreshToken;

  if (!refreshTokenPlain) {
    return res.status(401).json({ message: "No refresh token provided" });
  }

  const hashed = hashToken(refreshTokenPlain);
  const user = await User.findOne({
    "refreshTokens.token": hashed,
  }).select("+refreshTokens");

  if (!user) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  const tokenDoc = user.refreshTokens.find((t) => t.token === hashed);
  if (!tokenDoc || new Date(tokenDoc.expiresAt) < new Date()) {
    return res.status(401).json({ message: "Expired refresh token" });
  }

  const newRT = signRefreshToken();
  const newHashed = hashToken(newRT);

  user.refreshTokens = user.refreshTokens.filter((t) => t.token !== hashed);
  user.refreshTokens.push({
    token: newHashed,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  await user.save();

  const newAccess = signAccessToken(user._id, user.role);

  // ---- REFRESH COOKIES (FIXED) ----
  res.cookie("accessToken", newAccess, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
    maxAge: 15 * 60 * 1000,
  });

  res.cookie("refreshToken", newRT, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ message: "Tokens refreshed successfully" });
});

// ================= LOGOUT =================
const logoutUser = asyncHandler(async (req, res) => {
  const refreshTokenPlain = req.cookies?.refreshToken;

  if (refreshTokenPlain) {
    const hashed = hashToken(refreshTokenPlain);
    const user = await User.findById(req.user._id).select("+refreshTokens");

    if (user) {
      user.refreshTokens = user.refreshTokens.filter(
        (t) => t.token !== hashed
      );
      await user.save();
    }
  }

  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
  });

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
  });

  res.json({ message: "Logged out successfully" });
});

// ================= GET PROFILE =================
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

// ================= UPDATE PROFILE =================
const updateProfile = asyncHandler(async (req, res) => {
  const { name, password } = req.body;

  const user = await User.findById(req.user._id).select("+password");

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (name && name.trim()) {
    user.name = name.trim();
  }

  if (password && password.trim()) {
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }
    user.password = password;
  }

  await user.save();

  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
});

// ================= GET ALL USERS (ADMIN) =================
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find();

  res.json(
    users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      lastLogin: u.lastLogin,
      createdAt: u.createdAt,
    }))
  );
});

// ================= FORGOT PASSWORD =================
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    return res
      .status(200)
      .json({ message: "If the email exists, a link will be sent" });
  }

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetURL = `${process.env.CORS_ORIGIN}/reset-password/${resetToken}`;
  console.log(`Password reset URL: ${resetURL}`);

  res.status(200).json({
    message: "Password reset link sent to email",
    resetUrl: process.env.NODE_ENV === "development" ? resetURL : undefined,
  });
});

// ================= RESET PASSWORD =================
const resetPassword = asyncHandler(async (req, res) => {
  const hashed = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");
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
