import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getMyProfile,
  updateMyProfile,
} from "../services/profileService";
import { getErrorMessage } from "../services/api";
import "../styles/edit-profile.css";

const emptyForm = {
  fullName: "",
  phone: "",
  dateOfBirth: "",
  bio: "",
  address: {
    street: "",
    city: "",
    state: "",
    pincode: "",
  },
};

const getLocalDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const toDateInputValue = (value) => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const normalizeProfile = (profile = {}) => ({
  fullName: profile.fullName || "",
  phone: profile.phone || "",
  dateOfBirth: toDateInputValue(profile.dateOfBirth),
  bio: profile.bio || "",
  address: {
    street: profile.address?.street || "",
    city: profile.address?.city || "",
    state: profile.address?.state || "",
    pincode: profile.address?.pincode || "",
  },
});

function EditProfile() {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setError("");
      try {
        const result = await getMyProfile();
        if (!cancelled) setForm(normalizeProfile(result?.profile));
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, "Could not load your profile. Please try again."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const filledFields = useMemo(() => {
    const values = [
      form.fullName,
      form.phone,
      form.dateOfBirth,
      form.bio,
      form.address.street,
      form.address.city,
      form.address.state,
      form.address.pincode,
    ];
    return values.filter((value) => String(value || "").trim()).length;
  }, [form]);

  const completeness = Math.round((filledFields / 8) * 100);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setSuccess("");
    setError("");

    if (name.startsWith("address.")) {
      const key = name.split(".")[1];
      setForm((previous) => ({
        ...previous,
        address: { ...previous.address, [key]: value },
      }));
      return;
    }

    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const fullName = form.fullName.trim();
    const phone = form.phone.trim();
    const pincode = form.address.pincode.trim();

    if (fullName.length < 2 || fullName.length > 80) {
      setError("Full name must contain 2 to 80 characters.");
      return;
    }

    if (phone && !/^\+?[1-9]\d{7,14}$/.test(phone)) {
      setError("Enter a valid phone number with country code, e.g. +919876543210.");
      return;
    }

    if (pincode && !/^\d{6}$/.test(pincode)) {
      setError("PIN code must contain exactly 6 digits.");
      return;
    }

    if (form.dateOfBirth && form.dateOfBirth > getLocalDate()) {
      setError("Date of birth cannot be in the future.");
      return;
    }

    if (form.bio.trim().length > 300) {
      setError("About Me cannot exceed 300 characters.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        fullName,
        phone,
        dateOfBirth: form.dateOfBirth,
        bio: form.bio.trim(),
        address: {
          street: form.address.street.trim(),
          city: form.address.city.trim(),
          state: form.address.state.trim(),
          pincode,
        },
      };
      const result = await updateMyProfile(payload);
      setForm(normalizeProfile(result?.profile || payload));
      setSuccess("Your profile has been updated successfully.");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update your profile. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="edit-profile-page">
        <div className="edit-profile-shell">
          <div className="edit-profile-skeleton-head" />
          <div className="edit-profile-skeleton-card">
            <span /> <span /> <span /> <span /> <span /> <span />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="edit-profile-page">
      <div className="edit-profile-shell">
        <header className="edit-profile-header">
          <div>
            <div className="edit-profile-breadcrumb">
              <Link to="/profile">My Profile</Link>
              <i className="bi bi-chevron-right" aria-hidden="true" />
              <span>Edit details</span>
            </div>
            <span className="edit-profile-eyebrow"><i className="bi bi-sliders2 me-2" aria-hidden="true" />ACCOUNT SETTINGS</span>
            <h1>Edit your profile</h1>
            <p>Keep your personal and contact information accurate and up to date.</p>
          </div>
          <Link to="/profile" className="edit-profile-back-link">
            <i className="bi bi-arrow-left" aria-hidden="true" />
            View profile
          </Link>
        </header>

        {error && (
          <div className="edit-profile-alert edit-profile-alert-error" role="alert">
            <i className="bi bi-exclamation-circle-fill" aria-hidden="true" />
            <span>{error}</span>
            <button type="button" aria-label="Dismiss error" onClick={() => setError("")}><i className="bi bi-x-lg" /></button>
          </div>
        )}
        {success && (
          <div className="edit-profile-alert edit-profile-alert-success" role="status">
            <i className="bi bi-check-circle-fill" aria-hidden="true" />
            <span>{success}</span>
            <button type="button" aria-label="Dismiss message" onClick={() => setSuccess("")}><i className="bi bi-x-lg" /></button>
          </div>
        )}

        <div className="edit-profile-layout">
          <aside className="edit-profile-aside">
            <section className="edit-profile-progress-card">
              <div className="edit-profile-progress-icon"><i className="bi bi-person-vcard" aria-hidden="true" /></div>
              <span className="edit-profile-aside-kicker">PROFILE COMPLETENESS</span>
              <div className="edit-profile-progress-row"><strong>{completeness}%</strong><span>{filledFields} of 8 fields</span></div>
              <div className="edit-profile-progress-track" role="progressbar" aria-label="Profile completeness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completeness}>
                <span style={{ width: `${completeness}%` }} />
              </div>
              <p>Complete your profile so your account information stays useful and up to date.</p>
            </section>
            <section className="edit-profile-tip-card">
              <div className="edit-profile-tip-icon"><i className="bi bi-shield-check" aria-hidden="true" /></div>
              <h2>Keep your details safe</h2>
              <p>Only add the information needed for your account. Your profile updates are saved securely through CyberDesk.</p>
            </section>
            <div className="edit-profile-aside-footer"><i className="bi bi-lock-fill" aria-hidden="true" /> Your account details are private.</div>
          </aside>

          <form className="edit-profile-form" onSubmit={handleSubmit}>
            <section className="edit-profile-section">
              <div className="edit-profile-section-heading">
                <span className="edit-profile-section-icon"><i className="bi bi-person-lines-fill" aria-hidden="true" /></span>
                <div><h2>Personal information</h2><p>Basic details associated with your account.</p></div>
              </div>
              <div className="edit-profile-fields">
                <label className="edit-profile-field" htmlFor="edit-full-name">
                  <span>Full name <b>*</b></span>
                  <input id="edit-full-name" name="fullName" value={form.fullName} onChange={handleChange} minLength={2} maxLength={80} autoComplete="name" placeholder="Enter your full name" required disabled={saving} />
                  <small>Use the name you want displayed on your account.</small>
                </label>
                <label className="edit-profile-field" htmlFor="edit-phone">
                  <span>Mobile number</span>
                  <input id="edit-phone" name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="+919876543210" autoComplete="tel" maxLength={16} disabled={saving} />
                  <small>Include country code, for example +91.</small>
                </label>
                <label className="edit-profile-field" htmlFor="edit-dob">
                  <span>Date of birth</span>
                  <input id="edit-dob" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} max={getLocalDate()} autoComplete="bday" disabled={saving} />
                </label>
                <label className="edit-profile-field edit-profile-field-full" htmlFor="edit-bio">
                  <span>About me</span>
                  <textarea id="edit-bio" name="bio" value={form.bio} onChange={handleChange} rows={4} maxLength={300} placeholder="Write a short introduction about yourself..." disabled={saving} />
                  <small className="edit-profile-counter">{form.bio.length}/300 characters</small>
                </label>
              </div>
            </section>

            <section className="edit-profile-section">
              <div className="edit-profile-section-heading">
                <span className="edit-profile-section-icon edit-profile-section-icon-teal"><i className="bi bi-geo-alt-fill" aria-hidden="true" /></span>
                <div><h2>Address details</h2><p>Optional location information for your profile.</p></div>
              </div>
              <div className="edit-profile-fields">
                <label className="edit-profile-field edit-profile-field-full" htmlFor="edit-street">
                  <span>Street / house number</span>
                  <input id="edit-street" name="address.street" value={form.address.street} onChange={handleChange} maxLength={150} autoComplete="street-address" placeholder="House number, street, locality" disabled={saving} />
                </label>
                <label className="edit-profile-field" htmlFor="edit-city">
                  <span>City / village</span>
                  <input id="edit-city" name="address.city" value={form.address.city} onChange={handleChange} maxLength={80} autoComplete="address-level2" placeholder="Enter city or village" disabled={saving} />
                </label>
                <label className="edit-profile-field" htmlFor="edit-state">
                  <span>State</span>
                  <input id="edit-state" name="address.state" value={form.address.state} onChange={handleChange} maxLength={80} autoComplete="address-level1" placeholder="Enter state" disabled={saving} />
                </label>
                <label className="edit-profile-field" htmlFor="edit-pincode">
                  <span>PIN code</span>
                  <input id="edit-pincode" name="address.pincode" value={form.address.pincode} onChange={handleChange} inputMode="numeric" maxLength={6} pattern="[0-9]{6}" autoComplete="postal-code" placeholder="6-digit PIN code" disabled={saving} />
                  <small>Enter exactly 6 digits.</small>
                </label>
              </div>
            </section>

            <footer className="edit-profile-actions">
              <Link to="/profile" className="edit-profile-cancel">Cancel</Link>
              <button type="submit" className="edit-profile-save" disabled={saving}>
                {saving ? <><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Saving changes...</> : <><i className="bi bi-check2-circle" aria-hidden="true" /> Save changes</>}
              </button>
            </footer>
          </form>
        </div>
      </div>
    </main>
  );
}

export default EditProfile;
