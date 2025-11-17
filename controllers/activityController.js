const Activity = require("../models/Activity");
const Project = require("../models/Project");
const Task = require("../models/Task");
const asyncHandler = require("../utils/asyncHandler");


const getActivities = asyncHandler(async (req, res) => {
  const { limit = 50, entityType } = req.query;
  
  const query = req.user.role === "Admin" ? {} : { user: req.user._id };

  if (entityType) {
    query.entityType = entityType;
  }

  const activities = await Activity.find(query)
    .populate("user", "name email role")
    .sort({ createdAt: -1 })
    .limit(Number(limit));

  d
  const formattedActivities = activities.map(act => ({
    _id: act._id,
    user: act.user,
    action: act.action,
    target: act.entityName, 
    entityType: act.entityType,
    entityName: act.entityName,
    createdAt: act.createdAt,
  }));

  res.json(formattedActivities);
});


const getStats = asyncHandler(async (req, res) => {
  if (req.user.role !== "Admin") {
    return res.status(403).json({ message: "Access denied" });
  }

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