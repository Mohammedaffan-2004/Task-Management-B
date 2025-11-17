const Task = require("../models/Task");
const Project = require("../models/Project");
const Activity = require("../models/Activity");
const asyncHandler = require("../utils/asyncHandler");
const emitUpdates = require("../utils/emitHelper");


const createTask = asyncHandler(async (req, res) => {
  const { title, description, status, projectId, assignedTo, dueDate } = req.body;

 
  if (!title?.trim()) {
    return res.status(400).json({ message: "Task title is required" });
  }
  
  if (!projectId) {
    return res.status(400).json({ message: "Project is required" });
  }

 
  const project = await Project.findById(projectId);
  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }

 
  const task = await Task.create({
    title: title.trim(),
    description: description?.trim() || "",
    status: status || "To Do",
    projectId,
    assignedTo: assignedTo || null,
    dueDate: dueDate || null,
    createdBy: req.user._id,
  });

 
  await task.populate([
    { path: "projectId", select: "title" },
    { path: "assignedTo", select: "name email" },
    { path: "createdBy", select: "name email" },
  ]);

 
  await Activity.create({
    user: req.user._id,
    action: `created a new task "${task.title}"`,
    entityType: "Task",
    entityName: task.title,
  });

  emitUpdates(req, ["tasksUpdated", "activityUpdated"]);
  res.status(201).json(task);
});


const getTasks = asyncHandler(async (req, res) => {
  const { page = 1, limit = 100, status, projectId } = req.query;
  let filter = {};

  if (status) filter.status = status;
  if (projectId) filter.projectId = projectId;

  const tasks = await Task.find(filter)
    .populate("projectId", "title")
    .populate("assignedTo", "name email")
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json(tasks);
});


const getMyTasks = asyncHandler(async (req, res) => {
  const tasks = await Task.find({ assignedTo: req.user._id })
    .populate("projectId", "title")
    .populate("assignedTo", "name email")
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 });

  res.json(tasks);
});


const getTaskById = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id)
    .populate("projectId", "title")
    .populate("assignedTo", "name email")
    .populate("createdBy", "name email");

  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

 
  const isAdminOrManager = ["Admin", "Manager"].includes(req.user.role);
  const isAssignee = task.assignedTo?._id.toString() === req.user._id.toString();

  if (!isAdminOrManager && !isAssignee) {
    return res.status(403).json({ message: "Access denied for this task" });
  }

  res.json(task);
});


const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }


  const isAdminOrManager = ["Admin", "Manager"].includes(req.user.role);
  const isAssignee = task.assignedTo?.toString() === req.user._id.toString();

  if (!isAdminOrManager && !isAssignee) {
    return res.status(403).json({ message: "Not authorized to update this task" });
  }

  
  const allowedFields = isAdminOrManager
    ? ["title", "description", "status", "dueDate", "assignedTo", "projectId"]
    : ["status", "description"]; 

  
  Object.keys(req.body).forEach((key) => {
    if (allowedFields.includes(key)) {
      task[key] = req.body[key];
    }
  });

  const updated = await task.save();
  

  await updated.populate([
    { path: "projectId", select: "title" },
    { path: "assignedTo", select: "name email" },
    { path: "createdBy", select: "name email" },
  ]);


  await Activity.create({
    user: req.user._id,
    action: `updated task "${task.title}"`,
    entityType: "Task",
    entityName: task.title,
  });

  emitUpdates(req, ["tasksUpdated", "activityUpdated"]);
  res.json(updated);
});


const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  const taskTitle = task.title;
  await task.deleteOne();

 
  await Activity.create({
    user: req.user._id,
    action: `deleted task "${taskTitle}"`,
    entityType: "Task",
    entityName: taskTitle,
  });

  emitUpdates(req, ["tasksUpdated", "activityUpdated"]);
  res.json({ message: "Task deleted successfully" });
});

module.exports = {
  createTask,
  getTasks,
  getMyTasks,
  getTaskById,
  updateTask,
  deleteTask,
};