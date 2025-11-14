const express = require("express");
const router = express.Router();
const {
  getTaskStatusSummary,
  getOverdueTasks,
  getTopPerformers,
  getProjectProgress,
} = require("../controllers/analyticsController");
const { protect } = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

router.use(protect);
router.get("/status-summary", authorizeRoles("Admin", "Manager"), getTaskStatusSummary);
router.get("/overdue", authorizeRoles("Admin", "Manager"), getOverdueTasks);
router.get("/top-performers", authorizeRoles("Admin", "Manager"), getTopPerformers);
router.get("/project-progress", authorizeRoles("Admin", "Manager"), getProjectProgress);

module.exports = router;
