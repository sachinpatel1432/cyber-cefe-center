import mongoose from "mongoose";

/*
|--------------------------------------------------------------------------
| Document Upload Schema
|--------------------------------------------------------------------------
| Stores document metadata and a private Cloudinary asset identifier.
| Actual file upload and access control will be handled by controllers.
*/

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    documentType: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "other",
    },

    kind: {
      type: String,
      enum: ["initial", "additional"],
      required: true,
      default: "initial",
    },

    additionalDocumentRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    fileName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },

    mimeType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    format: {
      type: String,
      trim: true,
      maxlength: 20,
      default: "",
    },

    bytes: {
      type: Number,
      required: true,
      min: 1,
    },

    storageProvider: {
      type: String,
      enum: ["cloudinary"],
      default: "cloudinary",
      required: true,
    },

    // Never expose the provider identifier in API responses.
    publicId: {
      type: String,
      required: true,
      select: false,
    },

    resourceType: {
      type: String,
      enum: ["image", "raw"],
      required: true,
      default: "raw",
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    uploadedAt: {
      type: Date,
      default: Date.now,
    },

    reviewStatus: {
      type: String,
      enum: [
        "pending_review",
        "accepted",
        "rejected",
        "changes_requested",
      ],
      default: "pending_review",
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
  },
  {
    timestamps: false,
  }
);

/*
|--------------------------------------------------------------------------
| Additional Document Request Schema
|--------------------------------------------------------------------------
| Allows staff to request missing or corrected documents without
| creating another booking.
*/

const additionalDocumentRequestSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    instructions: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    isRequired: {
      type: Boolean,
      default: true,
    },

    status: {
      type: String,
      enum: [
        "requested",
        "uploaded",
        "accepted",
        "rejected",
        "cancelled",
      ],
      default: "requested",
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    requestedAt: {
      type: Date,
      default: Date.now,
    },

    dueDate: {
      type: Date,
      default: null,
    },

    respondedAt: {
      type: Date,
      default: null,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    latestDocument: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: false,
  }
);


/*
|--------------------------------------------------------------------------
| Final Deliverable Schema
|--------------------------------------------------------------------------
| Stores final certificates, receipts, generated PDFs or other approved
| output files produced by the assigned staff member.
*/

const deliverableSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    fileName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },

    mimeType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    format: {
      type: String,
      enum: ["pdf"],
      default: "pdf",
    },

    bytes: {
      type: Number,
      required: true,
      min: 1,
    },

    storageProvider: {
      type: String,
      enum: ["cloudinary"],
      default: "cloudinary",
      required: true,
    },

    publicId: {
      type: String,
      required: true,
      select: false,
    },

    resourceType: {
      type: String,
      enum: ["image", "raw"],
      required: true,
      default: "raw",
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    uploadedAt: {
      type: Date,
      default: Date.now,
    },

    downloadCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastDownloadedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: false,
  }
);

/*
|--------------------------------------------------------------------------
| Payment Stage Schema
|--------------------------------------------------------------------------
| Advance and final payment are tracked separately.
| Real payment processing will be implemented in payment controllers.
*/

const paymentStageSchema = new mongoose.Schema(
  {
    required: {
      type: Boolean,
      default: false,
    },

    amount: {
      type: Number,
      min: 0,
      default: 0,
    },

    status: {
      type: String,
      enum: [
        "not_required",
        "pending",
        "processing",
        "paid",
        "failed",
        "refunded",
      ],
      default: "not_required",
    },

    provider: {
      type: String,
      enum: ["none", "razorpay"],
      default: "none",
    },

    providerOrderId: {
      type: String,
      default: null,
      select: false,
    },

    providerPaymentId: {
      type: String,
      default: null,
      select: false,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    failureReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    receiptNumber: {
      type: String,
      default: null,
    },
  },
  {
    _id: false,
    timestamps: false,
  }
);

/*
|--------------------------------------------------------------------------
| Staff Assignment History
|--------------------------------------------------------------------------
| Preserves who assigned the request and why it was reassigned.
*/

const assignmentHistorySchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    assignmentType: {
      type: String,
      enum: [
        "admin_assignment",
        "staff_claim",
        "admin_reassignment",
      ],
      required: true,
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    assignedAt: {
      type: Date,
      default: Date.now,
    },

    endedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: false,
  }
);


/*
|--------------------------------------------------------------------------
| Status History
|--------------------------------------------------------------------------
| Keeps an audit trail of important workflow transitions.
*/

const statusHistorySchema = new mongoose.Schema(
  {
    fromStatus: {
      type: String,
      default: null,
    },

    toStatus: {
      type: String,
      required: true,
    },

    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

/*
|--------------------------------------------------------------------------
| Immutable Pricing Snapshot
|--------------------------------------------------------------------------
| Amounts are integer paise. Legacy requests can have no snapshot.
*/

const pricingSnapshotSchema = new mongoose.Schema(
  {
    version: {
      type: Number,
      enum: [1],
      required: true,
      default: 1,
    },

    currency: {
      type: String,
      enum: ["INR"],
      required: true,
      default: "INR",
    },

    customerAmountPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message:
          "Customer amount must be stored as an integer number of paise.",
      },
    },

    platformFeePercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      validate: {
        validator: Number.isInteger,
        message:
          "Platform fee must be a whole-number percentage from 0 to 100.",
      },
    },

    platformFeePaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Platform fee must be an integer number of paise.",
      },
    },

    staffEarningPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Staff earning must be an integer number of paise.",
      },
    },

    earningStatus: {
      type: String,
      enum: [
        "held",
        "available",
        "in_payout",
        "paid",
        "on_hold",
        "reversed",
      ],
      default: "held",
      required: true,
    },

    snapshotAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    sourceServiceUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
    timestamps: false,
  }
);

/*
|--------------------------------------------------------------------------
| Main Service Request Schema
|--------------------------------------------------------------------------
*/

const serviceRequestSchema = new mongoose.Schema(
  {
    requestNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true,
    },

    serviceName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 1000,
      default: 1,
    },

    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // Snapshot preserves the split that applied at booking time.
    pricingSnapshot: {
      type: pricingSnapshotSchema,
      default: null,
    },

    preferredDate: {
      type: Date,
      default: null,
    },

    customerNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    requiredDocuments: {
      type: [String],
      default: [],
      validate: {
        validator: (items) =>
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

    requiresDigitalDelivery: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "documents_required",
        "in_progress",
        "ready_for_payment",
        "ready_for_download",
        "completed",
        "rejected",
        "cancelled",
        "delivered",
        "closed",
      ],
      default: "pending",
      index: true,
    },

    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    staffNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    documents: {
      type: [documentSchema],
      default: [],
    },

    additionalDocumentRequests: {
      type: [additionalDocumentRequestSchema],
      default: [],
    },

    deliverables: {
      type: [deliverableSchema],
      default: [],
    },

    assignmentHistory: {
      type: [assignmentHistorySchema],
      default: [],
    },

    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },



    // Work and delivery milestones.
    acceptedAt: {
      type: Date,
      default: null,
    },

    processingStartedAt: {
      type: Date,
      default: null,
    },

    readyForPaymentAt: {
      type: Date,
      default: null,
    },

    deliveredAt: {
      type: Date,
      default: null,
    },

    closedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    /*
     * Payment stages. Both default to not_required so existing requests
     * do not become locked until a payment controller explicitly enables
     * a payment requirement.
     */
    payment: {
      currency: {
        type: String,
        enum: ["INR"],
        default: "INR",
      },

      advance: {
        type: paymentStageSchema,
        default: () => ({}),
      },

      final: {
        type: paymentStageSchema,
        default: () => ({}),
      },

      updatedAt: {
        type: Date,
        default: null,
      },
    },

    // Customer feedback after delivery.
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },

    review: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    customerConfirmedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/*
|--------------------------------------------------------------------------
| Pricing Snapshot Validation
|--------------------------------------------------------------------------
| The request-creation controller calculates the amounts.
| This hook validates the stored snapshot.
*/

serviceRequestSchema.pre("validate", function validatePricingSnapshot() {
  const snapshot = this.pricingSnapshot;

  // Existing/legacy requests remain valid.
  if (!snapshot) return;

  const valuesAreIntegers =
    Number.isSafeInteger(snapshot.customerAmountPaise) &&
    Number.isSafeInteger(snapshot.platformFeePaise) &&
    Number.isSafeInteger(snapshot.staffEarningPaise);

  if (!valuesAreIntegers) return;

  if (
    snapshot.platformFeePaise + snapshot.staffEarningPaise !==
    snapshot.customerAmountPaise
  ) {
    this.invalidate(
      "pricingSnapshot.staffEarningPaise",
      "Platform fee plus staff earning must equal the customer amount."
    );
  }

  const expectedPlatformFeePaise = Math.round(
    (snapshot.customerAmountPaise * snapshot.platformFeePercent) / 100
  );

  if (snapshot.platformFeePaise !== expectedPlatformFeePaise) {
    this.invalidate(
      "pricingSnapshot.platformFeePaise",
      "Platform fee does not match the stored percentage and customer amount."
    );
  }
});

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

serviceRequestSchema.index({
  customer: 1,
  createdAt: -1,
});

serviceRequestSchema.index({
  status: 1,
  createdAt: -1,
});

serviceRequestSchema.index({
  staff: 1,
  status: 1,
  createdAt: -1,
});

/*
|--------------------------------------------------------------------------
| Hide private storage and payment identifiers from JSON responses.
|--------------------------------------------------------------------------
*/

serviceRequestSchema.set("toJSON", {
  transform(_doc, ret) {
    const cleanPrivateFields = (items) => {
      if (!Array.isArray(items)) return;

      for (const item of items) {
        if (!item || typeof item !== "object") continue;

        delete item.publicId;
        delete item.providerOrderId;
        delete item.providerPaymentId;
      }
    };

    cleanPrivateFields(ret.documents);
    cleanPrivateFields(ret.deliverables);

    // Never expose the financial split by default.
    // Controllers must explicitly build role-specific responses.
    delete ret.pricingSnapshot;

    if (ret.payment) {
      for (const key of ["advance", "final"]) {
        if (ret.payment[key]) {
          delete ret.payment[key].providerOrderId;
          delete ret.payment[key].providerPaymentId;
        }
      }
    }

    return ret;
  },
});

const ServiceRequest =
  mongoose.models.ServiceRequest ||
  mongoose.model("ServiceRequest", serviceRequestSchema);

export default ServiceRequest;

