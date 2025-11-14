const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Project title is required"],
      trim: true,
      minlength: [3, "Project title must be at least 3 characters"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed"],
      default: "Pending",
    },
    dueDate: {
      type: Date,
      default: null,
      validate: {
        validator: function(value) {
          
          if (!value) return true;
          if (this.isNew) {
            return value >= new Date();
          }
          return true;
        },
        message: "Due date cannot be in the past"
      }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

projectSchema.index({ title: 1, createdBy: 1 });
projectSchema.index({ status: 1 });

module.exports = mongoose.model("Project", projectSchema);