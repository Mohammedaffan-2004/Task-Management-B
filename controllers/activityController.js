const Activity = require("../models/Activity");
const Project = require("../models/Project");
const Task = require("../models/Task");
const asyncHandler = require("../utils/asyncHandler");

// @desc Get Activities (User-specific or all if Admin)
// @route GET /api/activities
// @access Private
const getActivities = asyncHandler(async (req, res) => {
  const { limit = 50, entityType } = req.query;
  
  // Build query based on user role
  const query = req.user.role === "Admin" ? {} : { user: req.user._id };

  // Filter by entity type if provided
  if (entityType) {
    query.entityType = entityType;
  }

  const activities = await Activity.find(query)
    .populate("user", "name email role")
    .sort({ createdAt: -1 })
    .limit(Number(limit));

  // Format activities for frontend
  const formattedActivities = activities.map(act => ({
    _id: act._id,
    user: act.user,
    action: act.action,
    target: act.entityName, // Frontend uses 'target'
    entityType: act.entityType,
    entityName: act.entityName,
    createdAt: act.createdAt,
  }));

  res.json(formattedActivities);
});

// @desc Get Admin Stats Overview
// @route GET /api/activities/stats
// @access Private/Admin
const getStats = asyncHandler(async (req, res) => {
  if (req.user.role !== "Admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  // Get all stats in parallel for better performance
  const [
    totalProjects, 
    totalTasks, 
    completedTasks, 
    inProgressTasks, 
    todoTasks
  ] = await Promise.all([
    Project.countDocuments(),
    Task.countDocuments(),
    Task.countDocuments({ status: "Done" }),
    Task.countDocuments({ status: "In Progress" }),
    Task.countDocuments({ status: "To Do" }),
  ]);

  res.json({
    totalProjects,
    totalTasks,
    completedTasks,
    inProgressTasks,
    todoTasks,
  });
});

module.exports = { getActivities, getStats };