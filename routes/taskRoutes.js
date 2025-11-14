const express = require("express");
const router = express.Router();
const {
  createTask,
  getTasks,
  getMyTasks,
  getTaskById,
  updateTask,
  deleteTask,
} = require("../controllers/taskController");
const { protect } = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

router.use(protect);


router.post("/", authorizeRoles("Admin", "Manager"), createTask);


router.get("/", authorizeRoles("Admin", "Manager"), getTasks);


router.get("/my-tasks", getMyTasks);


router.get("/:id", getTaskById);
router.put("/:id", updateTask);
router.delete("/:id", authorizeRoles("Admin", "Manager"), deleteTask);

module.exports = router;
