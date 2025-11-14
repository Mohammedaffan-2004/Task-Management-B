const express = require("express");
const router = express.Router();
const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectAnalytics,
} = require("../controllers/projectController");
const { protect } = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

router.use(protect);

router.post("/", authorizeRoles("Admin", "Manager"), createProject);
router.get("/", getProjects);
router.get("/:id", getProjectById);
router.put("/:id", authorizeRoles("Admin", "Manager"), updateProject);
router.delete("/:id", authorizeRoles("Admin"), deleteProject);

router.get("/:id/analytics", authorizeRoles("Admin", "Manager"), getProjectAnalytics);

module.exports = router;
