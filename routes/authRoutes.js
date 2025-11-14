const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  logoutUser,
  refreshToken,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile, 
  getAllUsers,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");


router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/refresh", refreshToken);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);


router.get("/me", protect, getProfile);
router.put("/update", protect, updateProfile); 
router.post("/logout", protect, logoutUser);


router.get("/users", protect, authorizeRoles("Admin"), getAllUsers);

module.exports = router;