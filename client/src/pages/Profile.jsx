import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/profile-overview.css";

import {
  getProfile,
  updateProfile,
  uploadProfilePhoto,
  removeProfilePhoto,
} from "../services/profileService";

const emptyForm = {
  fullName: "",
  phone: "",
  dateOfBirth: "",
  bio: "",
  street: "",
  city: "",
  state: "",
  pincode: "",
};

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function normalizeDateInput(value) {
  if (!value) return "";

  // Date-only ISO strings should not shift because of timezone conversion.
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}/.test(value)
  ) {
    return value.slice(0, 10);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getFormData(profile) {
  return {
    fullName: profile?.fullName || "",
    phone: profile?.phone || "",
    dateOfBirth: normalizeDateInput(profile?.dateOfBirth),
    bio: profile?.bio || "",
    street: profile?.address?.street || "",
    city: profile?.address?.city || "",
    state: profile?.address?.state || "",
    pincode: profile?.address?.pincode || "",
  };
}

function getError(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
}

function getProfileFromResponse(response) {
  return response?.profile ?? response?.data?.profile ?? null;
}

function Field({
  label,
  name,
  value,
  onChange,
  disabled,
  placeholder,
  type = "text",
  maxLength,
  required = false,
  help,
  min,
  max,
  inputMode,
}) {
  return (
    <div className="col-md-6 mb-3">
      <label
        htmlFor={name}
        className="form-label fw-semibold"
      >
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        className="form-control"
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        min={min}
        max={max}
        inputMode={inputMode}
      />

      {help && (
        <small className="text-secondary d-block mt-1">
          {help}
        </small>
      )}
    </div>
  );
}

export default function Profile() {
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [originalForm, setOriginalForm] = useState(emptyForm);

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /**
   * Load profile information.
   */
  const loadProfile = useCallback(
    async ({ showLoader = true } = {}) => {
      if (showLoader) {
        setLoading(true);
      }

      setError("");

      try {
        const response = await getProfile();
        const data = getProfileFromResponse(response);

        if (!data) {
          throw new Error(
            "Profile data was not returned by the server."
          );
        }

        const values = getFormData(data);

        setProfile(data);
        setForm(values);
        setOriginalForm(values);

        return data;
      } catch (err) {
        setError(getError(err));
        return null;
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  /**
   * Handle editable profile fields.
   */
  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  }

  /**
   * Enter edit mode with the last saved values.
   */
  function startEditing() {
    const values = getFormData(profile);

    setForm(values);
    setOriginalForm(values);
    setEditing(true);

    setError("");
    setSuccess("");
  }

  /**
   * Discard unsaved changes.
   */
  function cancelEditing() {
    if (saving) return;

    setForm(originalForm);
    setEditing(false);
    setError("");
    setSuccess("");
  }

  /**
   * Validate and save the profile.
   */
  async function handleSave(event) {
    event.preventDefault();

    if (!editing || saving) return;

    setError("");
    setSuccess("");

    const fullName = form.fullName.trim();
    const phone = form.phone.trim();
    const bio = form.bio.trim();
    const dateOfBirth = form.dateOfBirth;

    if (fullName.length < 2 || fullName.length > 80) {
      setError("Full name must contain 2 to 80 characters.");
      return;
    }

    if (
      phone &&
      !/^\+?[1-9]\d{7,14}$/.test(phone)
    ) {
      setError(
        "Enter a valid phone number with country code, e.g. +919876543210."
      );
      return;
    }

    if (bio.length > 300) {
      setError("Bio cannot exceed 300 characters.");
      return;
    }

    if (
      dateOfBirth &&
      (
        !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ||
        Number.isNaN(new Date(`${dateOfBirth}T00:00:00`).getTime()) ||
        dateOfBirth > normalizeDateInput(new Date())
      )
    ) {
      setError("Please enter a valid date of birth that is not in the future.");
      return;
    }

    const pincode = form.pincode.trim();

    if (pincode && !/^\d{6}$/.test(pincode)) {
      setError("PIN code must contain exactly 6 digits.");
      return;
    }

    const street = form.street.trim();
    const city = form.city.trim();
    const state = form.state.trim();

    if (
      street.length > 150 ||
      city.length > 80 ||
      state.length > 80
    ) {
      setError(
        "Please check your address fields for maximum character limits."
      );
      return;
    }

    const address = {
      street,
      city,
      state,
      pincode,
    };

    const payload = {
      fullName,
      phone,
      dateOfBirth: dateOfBirth || null,
      bio,
      address,
    };

    setSaving(true);

    try {
      const response = await updateProfile(payload);
      const updatedProfile = getProfileFromResponse(response);

      if (updatedProfile) {
        const values = getFormData(updatedProfile);

        setProfile(updatedProfile);
        setForm(values);
        setOriginalForm(values);
      } else {
        // Some APIs return only a success message.
        const reloadedProfile = await loadProfile({
          showLoader: false,
        });

        if (!reloadedProfile) {
          setEditing(false);
          setSuccess(
            "Profile updated. Refresh the page to confirm the saved information."
          );
          return;
        }
      }

      setEditing(false);
      setSuccess("Profile updated successfully!");
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  }

  /**
   * Upload a new profile photo.
   */
  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setSuccess("");

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setError("Please select a JPG, PNG or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size <= 0 || file.size > MAX_PHOTO_SIZE) {
      setError("Image size must be greater than 0 and 5 MB or less.");
      event.target.value = "";
      return;
    }

    setPhotoLoading(true);

    try {
      await uploadProfilePhoto(file);

      const updatedProfile = await loadProfile({
        showLoader: false,
      });

      if (updatedProfile) {
        setSuccess("Profile photo updated successfully!");
      }
    } catch (err) {
      setError(getError(err));
    } finally {
      setPhotoLoading(false);
      event.target.value = "";
    }
  }

  /**
   * Remove the current profile photo.
   */
  async function handleRemovePhoto() {
    if (photoLoading || !profile?.profileImage?.url) return;

    const confirmed = window.confirm(
      "Are you sure you want to remove your profile photo?"
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setPhotoLoading(true);

    try {
      await removeProfilePhoto();

      const updatedProfile = await loadProfile({
        showLoader: false,
      });

      if (updatedProfile) {
        setSuccess("Profile photo removed successfully!");
      }
    } catch (err) {
      setError(getError(err));
    } finally {
      setPhotoLoading(false);
    }
  }

  /**
   * Loading screen.
   */
  if (loading) {
    return (
      <main className="container py-5 text-center">
        <div
          className="spinner-border text-primary"
          role="status"
        >
          <span className="visually-hidden">
            Loading profile...
          </span>
        </div>

        <p className="mt-3 text-secondary">
          Loading your profile...
        </p>
      </main>
    );
  }

  /**
   * Error screen if profile data is unavailable.
   */
  if (!profile) {
    return (
      <main className="container py-5">
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body text-center py-5">
            <i className="bi bi-person-exclamation fs-1 text-danger" />

            <h1 className="h4 fw-bold mt-3">
              Unable to load profile
            </h1>

            <p className="text-secondary">
              {error || "Please try again."}
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => loadProfile()}
            >
              <i className="bi bi-arrow-clockwise me-2" />
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  const photoUrl = profile.profileImage?.url || "";

  const accountStatus = profile.accountStatus || "unknown";
  const normalizedAccountStatus = String(accountStatus).toLowerCase();

  const accountStatusClass =
    normalizedAccountStatus === "active"
      ? "success"
      : normalizedAccountStatus === "suspended" ||
          normalizedAccountStatus === "disabled"
        ? "danger"
        : "secondary";

  const memberSince = profile.createdAt
    ? new Date(profile.createdAt)
    : null;

  const memberSinceLabel =
    memberSince && !Number.isNaN(memberSince.getTime())
      ? memberSince.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";

  const currentDate = normalizeDateInput(new Date());

  return (
    <main className="cyber-profile-page container py-4 py-lg-5">
      {/* Page heading */}
      <div className="profile-page-heading d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <span className="badge text-bg-primary mb-2">
            ACCOUNT SETTINGS
          </span>

          <h1 className="h2 fw-bold mb-1">
            My Profile
          </h1>

          <p className="text-secondary mb-0">
            Manage your personal information and account details.
          </p>
        </div>

        <div className="d-flex flex-wrap gap-2">
          {profile.role === "customer" && (
            <Link
              to="/customer/dashboard"
              className="btn btn-outline-secondary"
            >
              <i className="bi bi-grid me-2" />
              Dashboard
            </Link>
          )}

          {!editing && (
            <button
              type="button"
              className="btn btn-primary px-4"
              onClick={startEditing}
            >
              <i className="bi bi-pencil-square me-2" />
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Error and success messages */}
      {error && (
        <div className="alert alert-danger" role="alert">
          <div className="d-flex justify-content-between align-items-start gap-3">
            <div>
              <i className="bi bi-exclamation-circle me-2" />
              {error}
            </div>

            <button
              type="button"
              className="btn-close"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            />
          </div>
        </div>
      )}

      {success && (
        <div className="alert alert-success" role="status">
          <div className="d-flex justify-content-between align-items-start gap-3">
            <div>
              <i className="bi bi-check-circle me-2" />
              {success}
            </div>

            <button
              type="button"
              className="btn-close"
              aria-label="Dismiss success message"
              onClick={() => setSuccess("")}
            />
          </div>
        </div>
      )}

      <div className="row g-4">
        {/* Profile sidebar */}
        <div className="col-lg-4">
          <div className="profile-sidebar-card card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body text-center p-4 p-lg-4">
              {/* Profile photo */}
              <div
                className="mx-auto mb-3 rounded-circle overflow-hidden bg-light d-flex align-items-center justify-content-center border"
                style={{
                  width: 140,
                  height: 140,
                }}
              >
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Profile"
                    className="w-100 h-100"
                    style={{
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <i
                    className="bi bi-person-circle text-secondary"
                    aria-hidden="true"
                    style={{
                      fontSize: 82,
                    }}
                  />
                )}
              </div>

              <h2 className="h4 fw-bold mb-1">
                {profile.fullName || "User"}
              </h2>

              <p className="text-secondary small text-break mb-3">
                {profile.email || "No email available"}
              </p>

              {/* Role and verification */}
              <div className="d-flex justify-content-center flex-wrap gap-2 mb-4">
                <span className="badge rounded-pill text-bg-light border text-dark text-capitalize px-3 py-2">
                  <i className="bi bi-person-badge me-1" />
                  {profile.role || "User"}
                </span>

                <span
                  className={`badge rounded-pill px-3 py-2 ${
                    profile.emailVerified
                      ? "text-bg-success"
                      : "text-bg-warning"
                  }`}
                >
                  <i
                    className={`bi ${
                      profile.emailVerified
                        ? "bi-patch-check"
                        : "bi-envelope-exclamation"
                    } me-1`}
                  />

                  {profile.emailVerified
                    ? "Email Verified"
                    : "Email Not Verified"}
                </span>
              </div>

              {/* Profile completeness based on fields returned by the API */}
              {(() => {
                const completionFields = [
                  profile.fullName,
                  profile.email,
                  profile.phone,
                  profile.dateOfBirth,
                  profile.bio,
                  profile.address?.street,
                  profile.address?.city,
                  profile.address?.state,
                  profile.address?.pincode,
                  photoUrl,
                ];
                const completedFields = completionFields.filter(
                  (value) => String(value || "").trim().length > 0
                ).length;
                const completion = Math.round(
                  (completedFields / completionFields.length) * 100
                );

                return (
                  <div className="profile-completion-panel text-start mb-4">
                    <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                      <span className="small fw-semibold">Profile completeness</span>
                      <strong className="small">{completion}%</strong>
                    </div>
                    <div
                      className="progress profile-completion-progress"
                      role="progressbar"
                      aria-label="Profile completeness"
                      aria-valuenow={completion}
                      aria-valuemin="0"
                      aria-valuemax="100"
                    >
                      <div className="progress-bar" style={{ width: `${completion}%` }} />
                    </div>
                    <p className="small text-secondary mt-2 mb-0">
                      {completedFields === completionFields.length
                        ? "Your profile has all available details."
                        : "Add the missing details to keep your profile up to date."}
                    </p>
                  </div>
                );
              })()}

              {/* Photo controls */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="d-none"
                disabled={photoLoading || saving}
                onChange={handlePhotoChange}
              />

              <button
                type="button"
                className="btn btn-outline-primary w-100 mb-2"
                disabled={photoLoading || saving}
                onClick={() => fileInputRef.current?.click()}
              >
                <i className="bi bi-camera me-2" />

                {photoLoading
                  ? "Please wait..."
                  : photoUrl
                    ? "Change Profile Photo"
                    : "Upload Profile Photo"}
              </button>

              {photoUrl && (
                <button
                  type="button"
                  className="btn btn-outline-danger w-100"
                  disabled={photoLoading || saving}
                  onClick={handleRemovePhoto}
                >
                  <i className="bi bi-trash me-2" />

                  {photoLoading
                    ? "Please wait..."
                    : "Remove Photo"}
                </button>
              )}

              <small className="d-block text-secondary mt-2">
                JPG, PNG or WebP. Maximum size: 5 MB.
              </small>

              <hr className="my-4" />

              {/* Account details */}
              <div className="text-start">
                <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
                  <span className="small text-secondary">
                    Account status
                  </span>

                  <span
                    className={`badge text-bg-${accountStatusClass} text-capitalize`}
                  >
                    {accountStatus}
                  </span>
                </div>

                <div className="d-flex justify-content-between align-items-center gap-3">
                  <span className="small text-secondary">
                    Member since
                  </span>

                  <span className="small fw-semibold text-end">
                    {memberSinceLabel}
                  </span>
                </div>
              </div>

              {profile.role === "customer" && (
                <>
                  <hr className="my-4" />

                  <Link
                    to="/my-requests"
                    className="btn btn-light border w-100"
                  >
                    <i className="bi bi-clipboard-check me-2" />
                    My Service Requests
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Profile form */}
        <div className="col-lg-8">
          <form onSubmit={handleSave}>
            {/* Personal information */}
            <section className="profile-content-card card border-0 shadow-sm rounded-4 mb-4">
              <div className="card-body p-4">
                <h2 className="h5 fw-bold mb-1">
                  <i className="bi bi-person-lines-fill me-2 text-primary" />
                  Personal Information
                </h2>

                <p className="text-secondary small mb-4">
                  Update your basic personal details.
                </p>

                <div className="row">
                  <Field
                    label="Full Name"
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    disabled={!editing || saving}
                    placeholder="Enter your full name"
                    maxLength={80}
                    required
                  />

                  <div className="col-md-6 mb-3">
                    <label
                      htmlFor="profile-email"
                      className="form-label fw-semibold"
                    >
                      Email Address
                    </label>

                    <input
                      id="profile-email"
                      type="email"
                      className="form-control"
                      value={profile.email || ""}
                      readOnly
                    />

                    <small className="text-secondary">
                      <Link to="/change-email">
                        Change email address
                      </Link>
                    </small>
                  </div>

                  <Field
                    label="Phone Number"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    disabled={!editing || saving}
                    placeholder="+919876543210"
                    maxLength={16}
                    inputMode="tel"
                    help="Include country code, e.g. +91."
                  />

                  <Field
                    label="Date of Birth"
                    name="dateOfBirth"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={handleChange}
                    disabled={!editing || saving}
                    max={currentDate}
                    help="Optional."
                  />

                  <div className="col-12 mb-3">
                    <label
                      htmlFor="bio"
                      className="form-label fw-semibold"
                    >
                      About Me / Bio
                    </label>

                    <textarea
                      id="bio"
                      name="bio"
                      className="form-control"
                      rows={4}
                      maxLength={300}
                      value={form.bio}
                      onChange={handleChange}
                      disabled={!editing || saving}
                      placeholder="Write something about yourself..."
                    />

                    <div className="text-end small text-secondary mt-1">
                      {form.bio.length}/300 characters
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Address information */}
            <section className="card border-0 shadow-sm rounded-4 mb-4">
              <div className="card-body p-4">
                <h2 className="h5 fw-bold mb-1">
                  <i className="bi bi-geo-alt me-2 text-primary" />
                  Address Information
                </h2>

                <p className="text-secondary small mb-4">
                  Add or update your residential address.
                </p>

                <div className="row">
                  <Field
                    label="Street / House Address"
                    name="street"
                    value={form.street}
                    onChange={handleChange}
                    disabled={!editing || saving}
                    placeholder="House number, street, area"
                    maxLength={150}
                  />

                  <Field
                    label="City"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    disabled={!editing || saving}
                    placeholder="Enter city"
                    maxLength={80}
                  />

                  <Field
                    label="State"
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    disabled={!editing || saving}
                    placeholder="Enter state"
                    maxLength={80}
                  />

                  <Field
                    label="PIN Code"
                    name="pincode"
                    value={form.pincode}
                    onChange={handleChange}
                    disabled={!editing || saving}
                    placeholder="6-digit PIN code"
                    maxLength={6}
                    inputMode="numeric"
                    help="Enter exactly 6 digits if provided."
                  />
                </div>
              </div>
            </section>

            {/* Save and cancel */}
            {editing && (
              <div className="d-flex flex-wrap justify-content-end gap-2 mb-4">
                <button
                  type="button"
                  className="btn btn-outline-secondary px-4"
                  onClick={cancelEditing}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary px-4"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        aria-hidden="true"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check2-circle me-2" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Account security */}
            <section className="profile-content-card card border-0 shadow-sm rounded-4">
              <div className="card-body p-4">
                <h2 className="h5 fw-bold mb-3">
                  <i className="bi bi-shield-lock me-2 text-primary" />
                  Account & Security
                </h2>

                <div className="d-flex flex-wrap gap-2">
                  <Link
                    to="/change-password"
                    className="btn btn-outline-dark"
                  >
                    <i className="bi bi-key me-2" />
                    Change Password
                  </Link>

                  <Link
                    to="/change-email"
                    className="btn btn-outline-dark"
                  >
                    <i className="bi bi-envelope me-2" />
                    Change Email
                  </Link>
                </div>

                <p className="text-secondary small mt-3 mb-0">
                  Account role, status and email verification are
                  managed separately and cannot be edited from this form.
                </p>
              </div>
            </section>
          </form>
        </div>
      </div>
    </main>
  );
}