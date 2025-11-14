const express = require("express");
const router = express.Router();
const { getActivities, getStats } = require("../controllers/activityController");
const { protect } = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

router.get("/", protect, getActivities);

router.get("/stats", protect, authorizeRoles("Admin"), getStats);

module.exports = router;
