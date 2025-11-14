const Task = require("../models/Task");
const Project = require("../models/Project");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");


const getTaskStatusSummary = asyncHandler(async (req, res) => {
  const summary = await Task.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const result = {
    todo: summary.find((s) => s._id === "To Do")?.count || 0,
    inProgress: summary.find((s) => s._id === "In Progress")?.count || 0,
    done: summary.find((s) => s._id === "Done")?.count || 0,
  };

  res.json({ success: true, data: result });
});


const getOverdueTasks = asyncHandler(async (req, res) => {
  const overdueTasks = await Task.find({
    dueDate: { $lt: new Date() },
    status: { $ne: "Done" },
  })
    .populate("assignedTo", "name email")
    .populate("projectId", "title");

  res.json({
    success: true,
    count: overdueTasks.length,
    data: overdueTasks,
  });
});


const getTopPerformers = asyncHandler(async (req, res) => {
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
        completedTasks: 1 
      } 
    },
  ]);

  res.json({ success: true, data: performers });
});


const getProjectProgress = asyncHandler(async (req, res) => {
 
  const progress = await Task.aggregate([
    {
      $group: {
        _id: "$projectId",
        totalTasks: { $sum: 1 },
        doneTasks: {
          $sum: { $cond: [{ $eq: ["$status", "Done"] }, 1, 0] }
        }
      }
    },
    {
      $lookup: {
        from: "projects",
        localField: "_id",
        foreignField: "_id",
        as: "project"
      }
    },
    { $unwind: "$project" },
    {
      $project: {
        _id: 0,
        project: "$project.title",
        completionRate: {
          $cond: [
            { $eq: ["$totalTasks", 0] },
            0,
            { 
              $round: [
                { $multiply: [{ $divide: ["$doneTasks", "$totalTasks"] }, 100] },
                0
              ]
            }
          ]
        }
      }
    }
  ]);

  res.json({ success: true, data: progress });
});

module.exports = {
  getTaskStatusSummary,
  getOverdueTasks,
  getTopPerformers,
  getProjectProgress,
};