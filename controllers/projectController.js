const Project = require("../models/Project");
const Task = require("../models/Task");
const Activity = require("../models/Activity");
const asyncHandler = require("../utils/asyncHandler");
const emitUpdates = require("../utils/emitHelper");

// @desc Create a new project (Admin/Manager)
// @route POST /api/projects
// @access Private/Admin/Manager
const createProject = asyncHandler(async (req, res) => {
  const { title, description, dueDate } = req.body;
  
  if (!title?.trim()) {
    return res.status(400).json({ message: "Project title is required" });
  }

  const project = await Project.create({
    title: title.trim(),
    description: description?.trim() || "",
    dueDate,
    createdBy: req.user._id,
  });

  // Populate creator info
  await project.populate("createdBy", "name email role");

  // Log activity
  await Activity.create({
    user: req.user._id,
    action: "created a new project",
    entityType: "Project",
    entityName: project.title,
  });

  emitUpdates(req, ["projectsUpdated", "activityUpdated"]);

  res.status(201).json(project);
});

// @desc Get all projects (Admin: all | Member: assigned only)
// @route GET /api/projects
// @access Private
const getProjects = asyncHandler(async (req, res) => {
  let query = {};

  // Members only see projects they're assigned tasks in
  if (req.user.role !== "Admin" && req.user.role !== "Manager") {
    const userTasks = await Task.find({ assignedTo: req.user._id }).select("projectId");
    const projectIds = [...new Set(userTasks.map((t) => t.projectId?.toString()).filter(Boolean))];
    query = { _id: { $in: projectIds } };
  }

  const projects = await Project.find(query)
    .populate("createdBy", "name email role")
    .sort({ createdAt: -1 });

  res.json(projects);
});

// @desc Get project by ID
// @route GET /api/projects/:id
// @access Private
const getProjectById = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id).populate("createdBy", "name email role");
  
  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }

  // Get all tasks for this project
  const tasks = await Task.find({ projectId: project._id })
    .populate("assignedTo", "name email")
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 });

  res.json({
    project,
    tasks,
  });
});

// @desc Update project (Admin/Manager)
// @route PUT /api/projects/:id
// @access Private/Admin/Manager
const updateProject = asyncHandler(async (req, res) => {
  const { title, description, status, dueDate } = req.body;
  const project = await Project.findById(req.params.id);

  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }

  // Update fields if provided
  if (title?.trim()) project.title = title.trim();
  if (description !== undefined) project.description = description?.trim() || "";
  if (status) project.status = status;
  if (dueDate !== undefined) project.dueDate = dueDate;

  await project.save();
  await project.populate("createdBy", "name email role");

  // Log activity
  await Activity.create({
    user: req.user._id,
    action: "updated a project",
    entityType: "Project",
    entityName: project.title,
  });

  emitUpdates(req, ["projectsUpdated", "activityUpdated"]);

  res.json(project);
});

// @desc Delete project (Admin only)
// @route DELETE /api/projects/:id
// @access Private/Admin
const deleteProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  
  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }

  const projectTitle = project.title;

  // Delete all related tasks first
  await Task.deleteMany({ projectId: project._id });
  
  // Delete project
  await project.deleteOne();

  // Log activity
  await Activity.create({
    user: req.user._id,
    action: "deleted a project",
    entityType: "Project",
    entityName: projectTitle,
  });

  emitUpdates(req, ["projectsUpdated", "activityUpdated"]);

  res.json({ message: "Project and related tasks deleted successfully" });
});

// @desc Project Analytics (Admin/Manager)
// @route GET /api/projects/:id/analytics
// @access Private/Admin/Manager
const getProjectAnalytics = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  
  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }

  // Get all tasks for analytics
  const tasks = await Task.find({ projectId: project._id })
    .populate("assignedTo", "name email")
    .sort({ createdAt: -1 });

  // Calculate status counts
  const statusCount = { 
    todo: 0, 
    progress: 0, 
    done: 0 
  };
  
  const userWorkload = {};

  tasks.forEach((task) => {
    // Count by status
    if (task.status === "To Do") statusCount.todo++;
    else if (task.status === "In Progress") statusCount.progress++;
    else if (task.status === "Done") statusCount.done++;

    // Count by assigned user
    if (task.assignedTo?.name) {
      userWorkload[task.assignedTo.name] = (userWorkload[task.assignedTo.name] || 0) + 1;
    }
  });

  // Recent tasks (last 10)
  const recentTasks = tasks.slice(0, 10).map(t => ({
    _id: t._id,
    title: t.title,
    status: t.status,
    assignedTo: t.assignedTo ? {
      _id: t.assignedTo._id,
      name: t.assignedTo.name,
      email: t.assignedTo.email
    } : null,
    dueDate: t.dueDate,
    createdAt: t.createdAt,
  }));

  res.json({
    project: project.title,
    totalTasks: tasks.length,
    statusCount,
    userWorkload,
    recentTasks,
  });
});

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectAnalytics,
};