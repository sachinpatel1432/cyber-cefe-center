import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const requestMessageSchema = new Schema(
  {
    request: {
      type: Schema.Types.ObjectId,
      ref: "ServiceRequest",
      required: true,
      index: true,
    },

    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    senderRole: {
      type: String,
      enum: ["customer", "staff", "admin"],
      required: true,
    },

    message: {
      type: String,
      required: [true, "Message cannot be empty."],
      trim: true,
      minlength: [1, "Message cannot be empty."],
      maxlength: [2000, "Message cannot exceed 2000 characters."],
    },

    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    editedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/**
 * Retrieve messages for a request in chronological order.
 */
requestMessageSchema.index({
  request: 1,
  createdAt: 1,
});

/**
 * Query unread messages for an individual user.
 */
requestMessageSchema.index({
  request: 1,
  readBy: 1,
  createdAt: -1,
});

const RequestMessage =
  models.RequestMessage ||
  model("RequestMessage", requestMessageSchema);

export default RequestMessage;