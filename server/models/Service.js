
import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Service name is required."],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    category: {
      type: String,
      required: [true, "Service category is required."],
      enum: [
        "Printing",
        "Photocopy",
        "Scanning",
        "Online Forms",
        "Typing",
        "Passport Photos",
        "Lamination",
        "Internet",
        "Other",
      ],
      index: true,
    },

    description: {
      type: String,
      required: [true, "Service description is required."],
      trim: true,
      maxlength: 1000,
    },

    // Customer-facing price in INR rupees.
    // Controllers must calculate order pricing from this trusted value.
    price: {
      type: Number,
      required: [true, "Service price is required."],
      min: [0, "Price cannot be negative."],
      max: [10000000, "Price exceeds the maximum allowed amount."],
      validate: {
        validator: (value) =>
          Number.isFinite(value) &&
          Math.round(value * 100) === value * 100,
        message: "Price must have no more than two decimal places.",
      },
    },

    /*
    |--------------------------------------------------------------------------
    | Platform Fee Configuration
    |--------------------------------------------------------------------------
    | Whole-number percentage from 0 to 100.
    | Example: ₹100 at 20% means ₹20 platform fee and ₹80 staff earning.
    | The actual order split is snapshotted when the request is created.
    */

    platformFeePercent: {
      type: Number,
      required: true,
      default: 20,
      min: [0, "Platform fee cannot be below 0%."],
      max: [100, "Platform fee cannot exceed 100%."],
      validate: {
        validator: Number.isInteger,
        message: "Platform fee must be a whole-number percentage.",
      },
    },

    estimatedDurationMinutes: {
      type: Number,
      required: [true, "Estimated duration is required."],
      min: [1, "Duration must be at least one minute."],
      max: [10080, "Duration cannot exceed seven days."],
      validate: {
        validator: Number.isInteger,
        message: "Duration must be a whole number of minutes.",
      },
    },

    requiredDocuments: {
      type: [String],
      default: [],
      validate: {
        validator: (items) =>
          Array.isArray(items) &&
          items.length <= 30 &&
          items.every(
            (item) =>
              typeof item === "string" &&
              item.trim().length > 0 &&
              item.trim().length <= 100
          ),
        message: "Invalid required documents list.",
      },
    },

    // Final digital output can be provided through a secure download.
    requiresDigitalDelivery: {
      type: Boolean,
      default: false,
    },

    /*
    |--------------------------------------------------------------------------
    | Payment Configuration
    |--------------------------------------------------------------------------
    */

    advancePaymentRequired: {
      type: Boolean,
      default: false,
    },

    advanceAmount: {
      type: Number,
      default: 0,
      min: [0, "Advance amount cannot be negative."],
      max: [10000000, "Advance amount exceeds the maximum allowed amount."],
      validate: {
        validator: (value) =>
          Number.isFinite(value) &&
          Math.round(value * 100) === value * 100,
        message: "Advance amount must have no more than two decimal places.",
      },
    },

    finalPaymentRequired: {
      type: Boolean,
      default: false,
    },

    /*
    |--------------------------------------------------------------------------
    | Service Availability
    |--------------------------------------------------------------------------
    */

    active: {
      type: Boolean,
      default: true,
      index: true,
    },

    isClosed: {
      type: Boolean,
      default: false,
    },

    closureReason: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },

    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Audit Fields
    |--------------------------------------------------------------------------
    */

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/*
|--------------------------------------------------------------------------
| Validation Hooks
|--------------------------------------------------------------------------
| Keep payment configuration internally consistent.
*/

serviceSchema.pre("validate", function validateServiceConfiguration() {
  if (!this.advancePaymentRequired && this.advanceAmount > 0) {
    this.invalidate(
      "advanceAmount",
      "Advance amount must be zero when advance payment is disabled."
    );
  }

  if (
    this.advancePaymentRequired &&
    this.advanceAmount <= 0
  ) {
    this.invalidate(
      "advanceAmount",
      "Advance amount must be greater than zero when advance payment is enabled."
    );
  }

  if (
    this.advancePaymentRequired &&
    this.advanceAmount > this.price
  ) {
    this.invalidate(
      "advanceAmount",
      "Advance amount cannot exceed the service price."
    );
  }
});

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

serviceSchema.index({
  active: 1,
  isClosed: 1,
  deletedAt: 1,
});

serviceSchema.index({
  category: 1,
  name: 1,
});

serviceSchema.index({
  createdAt: -1,
});

/*
|--------------------------------------------------------------------------
| Model
|--------------------------------------------------------------------------
*/

const Service =
  mongoose.models.Service ||
  mongoose.model("Service", serviceSchema);

export default Service;
