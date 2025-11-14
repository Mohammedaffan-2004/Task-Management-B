const Task = require("../models/Task");
const Project = require("../models/Project");
const Activity = require("../models/Activity");
const asyncHandler = require("../utils/asyncHandler");
const emitUpdates = require("../utils/emitHelper");

// @desc Create a new task (Admin/Manager)
// @route POST /api/tasks
// @access Private/Admin/Manager
const createTask = asyncHandler(async (req, res) => {
  const { title, description, status, projectId, assignedTo, dueDate } = req.body;

  // Validate required fields
  if (!title?.trim()) {
    return res.status(400).json({ message: "Task title is required" });
  }
  
  if (!projectId) {
    return res.status(400).json({ message: "Project is required" });
  }

  // Check if project exists
  const project = await Project.findById(projectId);
  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }

  // Create task
  const task = await Task.create({
    title: title.trim(),
    description: description?.trim() || "",
    status: status || "To Do",
    projectId,
    assignedTo: assignedTo || null,
    dueDate: dueDate || null,
    createdBy: req.user._id,
  });

  // Populate related fields
  await task.populate([
    { path: "projectId", select: "title" },
    { path: "assignedTo", select: "name email" },
    { path: "createdBy", select: "name email" },
  ]);

  // Log activity
  await Activity.create({
    user: req.user._id,
    action: `created a new task "${task.title}"`,
    entityType: "Task",
    entityName: task.title,
  });

  emitUpdates(req, ["tasksUpdated", "activityUpdated"]);
  res.status(201).json(task);
});

// @desc Get all tasks (Admin/Manager only)
// @route GET /api/tasks
// @access Private/Admin/Manager
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

// @desc Get my assigned tasks (Member)
// @route GET /api/tasks/my-tasks
// @access Private
const getMyTasks = asyncHandler(async (req, res) => {
  const tasks = await Task.find({ assignedTo: req.user._id })
    .populate("projectId", "title")
    .populate("assignedTo", "name email")
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 });

  res.json(tasks);
});

// @desc Get task by ID
// @route GET /api/tasks/:id
// @access Private
const getTaskById = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id)
    .populate("projectId", "title")
    .populate("assignedTo", "name email")
    .populate("createdBy", "name email");

  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  // Check access permissions
  const isAdminOrManager = ["Admin", "Manager"].includes(req.user.role);
  const isAssignee = task.assignedTo?._id.toString() === req.user._id.toString();

  if (!isAdminOrManager && !isAssignee) {
    return res.status(403).json({ message: "Access denied for this task" });
  }

  res.json(task);
});

// @desc Update task
// @route PUT /api/tasks/:id
// @access Private
const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  // Check access permissions
  const isAdminOrManager = ["Admin", "Manager"].includes(req.user.role);
  const isAssignee = task.assignedTo?.toString() === req.user._id.toString();

  if (!isAdminOrManager && !isAssignee) {
    return res.status(403).json({ message: "Not authorized to update this task" });
  }

  // Define allowed fields based on role
  const allowedFields = isAdminOrManager
    ? ["title", "description", "status", "dueDate", "assignedTo", "projectId"]
    : ["status", "description"]; // Members can only update status and description

  // Update allowed fields
  Object.keys(req.body).forEach((key) => {
    if (allowedFields.includes(key)) {
      task[key] = req.body[key];
    }
  });

  const updated = await task.save();
  
  // Populate related fields
  await updated.populate([
    { path: "projectId", select: "title" },
    { path: "assignedTo", select: "name email" },
    { path: "createdBy", select: "name email" },
  ]);

  // Log activity
  await Activity.create({
    user: req.user._id,
    action: `updated task "${task.title}"`,
    entityType: "Task",
    entityName: task.title,
  });

  emitUpdates(req, ["tasksUpdated", "activityUpdated"]);
  res.json(updated);
});

// @desc Delete task (Admin/Manager only)
// @route DELETE /api/tasks/:id
// @access Private/Admin/Manager
const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  const taskTitle = task.title;
  await task.deleteOne();

  // Log activity
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