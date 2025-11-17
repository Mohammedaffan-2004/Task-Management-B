// const Activity = require("../models/Activity");
// const Project = require("../models/Project");
// const Task = require("../models/Task");
// const asyncHandler = require("../utils/asyncHandler");


// const getActivities = asyncHandler(async (req, res) => {
//   const { limit = 50, entityType } = req.query;
  
//   const query = req.user.role === "Admin" ? {} : { user: req.user._id };

//   if (entityType) {
//     query.entityType = entityType;
//   }

//   const activities = await Activity.find(query)
//     .populate("user", "name email role")
//     .sort({ createdAt: -1 })
//     .limit(Number(limit));

  
//   const formattedActivities = activities.map(act => ({
//     _id: act._id,
//     user: act.user,
//     action: act.action,
//     target: act.entityName, 
//     entityType: act.entityType,
//     entityName: act.entityName,
//     createdAt: act.createdAt,
//   }));

//   res.json(formattedActivities);
// });


// const getStats = asyncHandler(async (req, res) => {
//   if (req.user.role !== "Admin") {
//     return res.status(403).json({ message: "Access denied" });
//   }

//   const [
//     totalProjects, 
//     totalTasks, 
//     completedTasks, 
//     inProgressTasks, 
//     todoTasks
//   ] = await Promise.all([
//     Project.countDocuments(),
//     Task.countDocuments(),
//     Task.countDocuments({ status: "Done" }),
//     Task.countDocuments({ status: "In Progress" }),
//     Task.countDocuments({ status: "To Do" }),
//   ]);

//   res.json({
//     totalProjects,
//     totalTasks,
//     completedTasks,
//     inProgressTasks,
//     todoTasks,
//   });
// });

// module.exports = { getActivities, getStats };

const Activity = require("../models/Activity");
const Project = require("../models/Project");
const Task = require("../models/Task");
const asyncHandler = require("../utils/asyncHandler");

// ===============================
// ⭐ GET ACTIVITIES (Admin & Users)
// ===============================
const getActivities = asyncHandler(async (req, res) => {
  const { limit = 50, entityType } = req.query;

  let query = {};

  // ============================================
  // ⭐ Admin: See ALL activity logs
  // ============================================
  if (req.user.role === "Admin") {
    if (entityType) query.entityType = entityType;

    const activities = await Activity.find(query)
      .populate("user", "name email role")
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    return res.json(
      activities.map((act) => ({
        _id: act._id,
        user: act.user,
        action: act.action,
        target: act.entityName,
        entityType: act.entityType,
        entityName: act.entityName,
        createdAt: act.createdAt,
      }))
    );
  }

  // ============================================
  // ⭐ USER (Member):
  // Show meaningful activity:
  // - Actions they performed
  // - Actions performed ON tasks assigned to them
  // ============================================

  // Find tasks assigned to the logged-in user
  const myTasks = await Task.find({ assignedTo: req.user._id }).select("_id");
  const myTaskIds = myTasks.map((t) => t._id);

  query = {
    $or: [
      { user: req.user._id }, // Activity DONE by the user
      {
        // Activity ON tasks assigned to the user
        entityType: "Task",
        entityId: { $in: myTaskIds },
      },
    ],
  };

  if (entityType) {
    query.entityType = entityType;
  }

  const activities = await Activity.find(query)
    .populate("user", "name email role")
    .sort({ createdAt: -1 })
    .limit(Number(limit));

  const formattedActivities = activities.map((act) => ({
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

// ===============================
// ⭐ GET ADMIN STATS ONLY
// ===============================
const getStats = asyncHandler(async (req, res) => {
  if (req.user.role !== "Admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  const [
    totalProjects,
    totalTasks,
    completedTasks,
    inProgressTasks,
    todoTasks,
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
