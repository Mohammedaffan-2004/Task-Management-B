// const Task = require("../models/Task");
// const Project = require("../models/Project");
// const User = require("../models/User");
// const asyncHandler = require("../utils/asyncHandler");


// const getTaskStatusSummary = asyncHandler(async (req, res) => {
//   const summary = await Task.aggregate([
//     { $group: { _id: "$status", count: { $sum: 1 } } },
//   ]);

//   const result = {
//     todo: summary.find((s) => s._id === "To Do")?.count || 0,
//     inProgress: summary.find((s) => s._id === "In Progress")?.count || 0,
//     done: summary.find((s) => s._id === "Done")?.count || 0,
//   };

//   res.json({ success: true, data: result });
// });


// const getOverdueTasks = asyncHandler(async (req, res) => {
//   const overdueTasks = await Task.find({
//     dueDate: { $lt: new Date() },
//     status: { $ne: "Done" },
//   })
//     .populate("assignedTo", "name email")
//     .populate("projectId", "title");

//   res.json({
//     success: true,
//     count: overdueTasks.length,
//     data: overdueTasks,
//   });
// });


// const getTopPerformers = asyncHandler(async (req, res) => {
//   const performers = await Task.aggregate([
//     { $match: { status: "Done" } },
//     { $group: { _id: "$assignedTo", completedTasks: { $sum: 1 } } },
//     { $sort: { completedTasks: -1 } },
//     { $limit: 5 },
//     {
//       $lookup: {
//         from: "users",
//         localField: "_id",
//         foreignField: "_id",
//         as: "user",
//       },
//     },
//     { $unwind: "$user" },
//     { 
//       $project: { 
//         _id: 0, 
//         name: "$user.name", 
//         email: "$user.email", 
//         completedTasks: 1 
//       } 
//     },
//   ]);

//   res.json({ success: true, data: performers });
// });


// const getProjectProgress = asyncHandler(async (req, res) => {
 
//   const progress = await Task.aggregate([
//     {
//       $group: {
//         _id: "$projectId",
//         totalTasks: { $sum: 1 },
//         doneTasks: {
//           $sum: { $cond: [{ $eq: ["$status", "Done"] }, 1, 0] }
//         }
//       }
//     },
//     {
//       $lookup: {
//         from: "projects",
//         localField: "_id",
//         foreignField: "_id",
//         as: "project"
//       }
//     },
//     { $unwind: "$project" },
//     {
//       $project: {
//         _id: 0,
//         project: "$project.title",
//         completionRate: {
//           $cond: [
//             { $eq: ["$totalTasks", 0] },
//             0,
//             { 
//               $round: [
//                 { $multiply: [{ $divide: ["$doneTasks", "$totalTasks"] }, 100] },
//                 0
//               ]
//             }
//           ]
//         }
//       }
//     }
//   ]);

//   res.json({ success: true, data: progress });
// });

// module.exports = {
//   getTaskStatusSummary,
//   getOverdueTasks,
//   getTopPerformers,
//   getProjectProgress,
// };


const Task = require("../models/Task");
const Project = require("../models/Project");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");

// Helper: Get user tasks (for members)
const getUserTasks = async (userId) => {
  return await Task.find({ assignedTo: userId }).populate("projectId");
};

// ===============================
// ⭐ TASK STATUS SUMMARY
// ===============================
const getTaskStatusSummary = asyncHandler(async (req, res) => {
  let tasks;

  if (req.user.role === "Admin") {
    // Admin → all tasks
    tasks = await Task.find({});
  } else {
    // User → only their assigned tasks
    tasks = await getUserTasks(req.user._id);
  }

  const summary = {
    todo: tasks.filter((t) => t.status === "To Do").length,
    inProgress: tasks.filter((t) => t.status === "In Progress").length,
    done: tasks.filter((t) => t.status === "Done").length,
  };

  res.json({ success: true, data: summary });
});

// ===============================
// ⭐ OVERDUE TASKS
// ===============================
const getOverdueTasks = asyncHandler(async (req, res) => {
  let tasks;

  if (req.user.role === "Admin") {
    tasks = await Task.find({
      dueDate: { $lt: new Date() },
      status: { $ne: "Done" },
    })
      .populate("assignedTo", "name email")
      .populate("projectId", "title");
  } else {
    tasks = await Task.find({
      assignedTo: req.user._id,
      dueDate: { $lt: new Date() },
      status: { $ne: "Done" },
    })
      .populate("assignedTo", "name email")
      .populate("projectId", "title");
  }

  res.json({ success: true, count: tasks.length, data: tasks });
});

// ===============================
// ⭐ TOP PERFORMERS (Admin only)
// ===============================
const getTopPerformers = asyncHandler(async (req, res) => {
  if (req.user.role !== "Admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  const performers = await Task.aggregate([
    { $match: { status: "Done" } },
    { $group: { _id: "$assignedTo", completedTasks: { $sum: 1 } } },
    { $sort: { completedTasks: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        _id: 0,
        name: "$user.name",
        email: "$user.email",
        completedTasks: 1,
      },
    },
  ]);

  res.json({ success: true, data: performers });
});

// ===============================
// ⭐ PROJECT PROGRESS
// - Admin: all projects
// - User: only projects they participate in
// ===============================
const getProjectProgress = asyncHandler(async (req, res) => {
  let tasks;

  if (req.user.role === "Admin") {
    tasks = await Task.find({});
  } else {
    tasks = await Task.find({ assignedTo: req.user._id });
  }

  // Group by project
  const projectMap = {};

  tasks.forEach((t) => {
    const pId = t.projectId?._id?.toString();
    if (!pId) return;

    if (!projectMap[pId]) {
      projectMap[pId] = { total: 0, done: 0, project: t.projectId.title };
    }

    projectMap[pId].total++;
    if (t.status === "Done") projectMap[pId].done++;
  });

  const progress = Object.values(projectMap).map((p) => ({
    project: p.project,
    completionRate: p.total === 0 ? 0 : Math.round((p.done / p.total) * 100),
  }));

  res.json({ success: true, data: progress });
});

module.exports = {
  getTaskStatusSummary,
  getOverdueTasks,
  getTopPerformers,
  getProjectProgress,
};
