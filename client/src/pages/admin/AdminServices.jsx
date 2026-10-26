import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getManageableServices,
  createService,
  updateService,
  closeService,
  reopenService,
  activateService,
  deactivateService,
  deleteService,
} from "../../services/serviceService";
import "../../styles/admin-services.css";

const CATEGORIES = [
  "Printing",
  "Photocopy",
  "Scanning",
  "Online Forms",
  "Typing",
  "Passport Photos",
  "Lamination",
  "Internet",
  "Other",
];

const CATEGORY_ICONS = {
  Printing: "bi-printer",
  Photocopy: "bi-copy",
  Scanning: "bi-upc-scan",
  "Online Forms": "bi-file-earmark-text",
  Typing: "bi-keyboard",
  "Passport Photos": "bi-person-bounding-box",
  Lamination: "bi-card-image",
  Internet: "bi-wifi",
  Other: "bi-grid",
};

const INITIAL_FORM = {
  name: "",
  category: "Printing",
  description: "",
  price: "",
  platformFeePercent: "20",
  estimatedDurationMinutes: "5",
  requiredDocumentsText: "",
  active: true,
};

const PAGE_SIZE = 10;

function formatMoney(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function formatDuration(value) {
  const minutes = Math.max(0, Number(value) || 0);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours < 24) return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
}

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getServiceStatus(service) {
  if (service.deletedAt) return { label: "Archived", tone: "archived" };
  if (!service.active) return { label: "Inactive", tone: "inactive" };
  if (service.isClosed) return { label: "Temporarily closed", tone: "closed" };
  return { label: "Available", tone: "available" };
}

function getActorName(actor) {
  if (!actor) return "Not available";
  if (typeof actor === "string") return `ID ${actor.slice(-8)}`;
  return actor.fullName || actor.name || actor.email || "Recorded account";
}

function parseRequiredDocuments(text) {
  return text
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AdminServices() {
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [closedFilter, setClosedFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [closureTarget, setClosureTarget] = useState(null);
  const [closureReason, setClosureReason] = useState("");

  const loadServices = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = { page, limit: PAGE_SIZE };
      if (search.trim()) params.search = search.trim();
      if (category) params.category = category;
      if (activeFilter) params.active = activeFilter;
      if (closedFilter) params.isClosed = closedFilter;

      const result = await getManageableServices(params);
      setServices(Array.isArray(result?.services) ? result.services : []);
      setPagination(result?.pagination || { page: 1, total: 0, totalPages: 0 });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load the service catalog.");
    } finally {
      setLoading(false);
    }
  }, [page, search, category, activeFilter, closedFilter]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const pageStats = useMemo(() => {
    return {
      available: services.filter((item) => item.active && !item.isClosed && !item.deletedAt).length,
      closed: services.filter((item) => item.isClosed && !item.deletedAt).length,
      inactive: services.filter((item) => !item.active && !item.deletedAt).length,
      archived: services.filter((item) => Boolean(item.deletedAt)).length,
    };
  }, [services]);

  const updateField = (event) => {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const resetForm = () => {
    setForm({ ...INITIAL_FORM });
    setEditingId(null);
    setFormOpen(false);
  };

  const startEdit = (service) => {
    setEditingId(service._id);
    setForm({
      name: service.name || "",
      category: service.category || "Printing",
      description: service.description || "",
      price: String(service.price ?? ""),
      platformFeePercent: String(service.platformFeePercent ?? 20),
      estimatedDurationMinutes: String(service.estimatedDurationMinutes ?? 5),
      requiredDocumentsText: (service.requiredDocuments || []).join("\n"),
      active: Boolean(service.active),
    });
    setError("");
    setNotice("");
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const name = form.name.trim();
    const description = form.description.trim();
    const price = Number(form.price);
    const platformFeePercent = Number(form.platformFeePercent);
    const duration = Number(form.estimatedDurationMinutes);
    const requiredDocuments = parseRequiredDocuments(form.requiredDocumentsText);

    if (name.length < 2 || name.length > 100) {
      setError("Service name 2 se 100 characters ka hona chahiye.");
      return;
    }
    if (!description || description.length > 1000) {
      setError("Description required hai aur 1000 characters se zyada nahi ho sakta.");
      return;
    }
    if (form.price === "" || !Number.isFinite(price) || price < 0 || price > 10000000) {
      setError("Price ₹0 se ₹1,00,00,000 ke beech hona chahiye.");
      return;
    }
    if (form.platformFeePercent === "" || !Number.isInteger(platformFeePercent) || platformFeePercent < 0 || platformFeePercent > 100) {
      setError("Platform fee 0 se 100 ke beech whole-number percentage hona chahiye.");
      return;
    }
    if (!Number.isInteger(duration) || duration < 1 || duration > 10080) {
      setError("Estimated duration 1 se 10080 minutes ke beech whole number hona chahiye.");
      return;
    }
    if (requiredDocuments.length > 30) {
      setError("Maximum 30 required documents add kar sakte hain.");
      return;
    }
    if (requiredDocuments.some((item) => item.length > 100)) {
      setError("Har required document ka naam 100 characters ya usse kam hona chahiye.");
      return;
    }

    const payload = {
      name,
      category: form.category,
      description,
      price,
      platformFeePercent,
      estimatedDurationMinutes: duration,
      requiredDocuments,
      active: form.active,
    };

    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (editingId) {
        await updateService(editingId, payload);
        setNotice("Service details updated successfully.");
      } else {
        await createService(payload);
        setNotice("New service added to the catalog.");
      }
      resetForm();
      await loadServices();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save service. Please review the details and try again.");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (serviceId, action, message) => {
    if (busyId) return;
    setBusyId(serviceId);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(message);
      await loadServices();
    } catch (err) {
      setError(err.response?.data?.message || "The requested action could not be completed.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (service) => {
    const confirmed = window.confirm(
      `Archive “${service.name}” from the catalog? The service record will be retained for audit purposes.`
    );
    if (!confirmed) return;
    runAction(service._id, () => deleteService(service._id), "Service archived from the catalog.");
  };

  const openClosureDialog = (service) => {
    setClosureTarget(service);
    setClosureReason(service.closureReason || "");
    setError("");
    setNotice("");
  };

  const handleClosureSubmit = async (event) => {
    event.preventDefault();
    if (!closureTarget || busyId) return;
    const reason = closureReason.trim();
    if (reason.length > 300) {
      setError("Closure reason 300 characters se zyada nahi ho sakta.");
      return;
    }

    const target = closureTarget;
    setBusyId(target._id);
    setError("");
    setNotice("");
    try {
      await closeService(target._id, reason);
      setNotice("Service temporarily closed. Closure reason has been saved.");
      setClosureTarget(null);
      setClosureReason("");
      await loadServices();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to close this service.");
    } finally {
      setBusyId(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("");
    setActiveFilter("");
    setClosedFilter("");
    setPage(1);
  };

  const openCreateForm = () => {
    setForm({ ...INITIAL_FORM });
    setEditingId(null);
    setFormOpen(true);
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="admin-services-page container-fluid px-3 px-lg-4 py-4 py-lg-5">
      <header className="as-hero mb-4">
        <div className="as-hero-content">
          <div className="as-eyebrow"><span className="as-eyebrow-dot" /> CYBERDESK CONTROL CENTER</div>
          <h1>Service Catalog</h1>
          <p>Manage your service offering, pricing, document requirements and availability from one workspace.</p>
          <div className="as-hero-actions">
            <button type="button" className="btn as-btn-primary" onClick={openCreateForm}>
              <i className="bi bi-plus-lg me-2" /> Add a service
            </button>
            <Link to="/admin" className="btn as-btn-ghost">
              <i className="bi bi-arrow-left me-2" /> Admin dashboard
            </Link>
          </div>
        </div>
        <div className="as-hero-visual" aria-hidden="true">
          <div className="as-visual-orbit as-orbit-one" />
          <div className="as-visual-orbit as-orbit-two" />
          <div className="as-visual-icon"><i className="bi bi-grid-1x2-fill" /></div>
          <span className="as-visual-chip as-chip-top"><i className="bi bi-check-circle-fill" /> Catalog control</span>
          <span className="as-visual-chip as-chip-bottom"><i className="bi bi-sliders" /> Flexible pricing</span>
        </div>
      </header>

      {error && (
        <div className="as-alert as-alert-error mb-3" role="alert">
          <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
          <span>{error}</span>
          <button type="button" className="as-alert-close" aria-label="Dismiss error" onClick={() => setError("")}><i className="bi bi-x-lg" /></button>
        </div>
      )}
      {notice && (
        <div className="as-alert as-alert-success mb-3" role="status">
          <i className="bi bi-check-circle-fill" aria-hidden="true" />
          <span>{notice}</span>
          <button type="button" className="as-alert-close" aria-label="Dismiss message" onClick={() => setNotice("")}><i className="bi bi-x-lg" /></button>
        </div>
      )}

      <section className="as-metrics-grid mb-4" aria-label="Service catalog summary">
        <article className="as-metric-card as-metric-total">
          <div className="as-metric-top"><span className="as-metric-icon"><i className="bi bi-collection" /></span><span className="as-metric-context">Current filters</span></div>
          <div className="as-metric-number">{pagination.total ?? 0}</div>
          <div className="as-metric-label">Matching catalog records</div>
          <div className="as-metric-foot">Across all matching pages</div>
        </article>
        <article className="as-metric-card">
          <div className="as-metric-top"><span className="as-metric-icon is-green"><i className="bi bi-check2-circle" /></span><span className="as-metric-context">This page</span></div>
          <div className="as-metric-number">{pageStats.available}</div>
          <div className="as-metric-label">Available now</div>
          <div className="as-metric-foot">Active and not temporarily closed</div>
        </article>
        <article className="as-metric-card">
          <div className="as-metric-top"><span className="as-metric-icon is-amber"><i className="bi bi-pause-circle" /></span><span className="as-metric-context">This page</span></div>
          <div className="as-metric-number">{pageStats.closed}</div>
          <div className="as-metric-label">Temporarily closed</div>
          <div className="as-metric-foot">Can be reopened when ready</div>
        </article>
        <article className="as-metric-card">
          <div className="as-metric-top"><span className="as-metric-icon is-rose"><i className="bi bi-archive" /></span><span className="as-metric-context">This page</span></div>
          <div className="as-metric-number">{pageStats.inactive + pageStats.archived}</div>
          <div className="as-metric-label">Inactive or archived</div>
          <div className="as-metric-foot">Not available to customers</div>
        </article>
      </section>

      {formOpen && (
        <section className="as-panel as-form-panel mb-4" id="service-editor">
          <div className="as-panel-heading">
            <div className="as-heading-icon"><i className={`bi ${editingId ? "bi-pencil-square" : "bi-plus-square-dotted"}`} /></div>
            <div className="as-heading-copy">
              <span className="as-section-kicker">CATALOG CONFIGURATION</span>
              <h2>{editingId ? "Edit service details" : "Create a new service"}</h2>
              <p>Fields and limits follow the Service schema. Created-by and updated-by metadata are managed by the server.</p>
            </div>
            <button type="button" className="as-icon-button" onClick={resetForm} aria-label="Close service editor"><i className="bi bi-x-lg" /></button>
          </div>

          <form onSubmit={handleSubmit} className="as-service-form">
            <div className="as-form-section-label"><span>01</span> Service information</div>
            <div className="row g-3">
              <div className="col-12 col-lg-7">
                <label className="form-label" htmlFor="as-service-name">Service name <span className="as-required">*</span></label>
                <input id="as-service-name" name="name" className="form-control as-control" value={form.name} onChange={updateField} minLength={2} maxLength={100} required placeholder="e.g. Black & White Printing" />
                <div className="as-field-note">2–100 characters</div>
              </div>
              <div className="col-12 col-lg-5">
                <label className="form-label" htmlFor="as-service-category">Category <span className="as-required">*</span></label>
                <select id="as-service-category" name="category" className="form-select as-control" value={form.category} onChange={updateField} required>
                  {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="as-service-description">Description <span className="as-required">*</span></label>
                <textarea id="as-service-description" name="description" className="form-control as-control" rows={4} maxLength={1000} value={form.description} onChange={updateField} required placeholder="Describe what is included in this service, any important limitations, and what the customer can expect." />
                <div className="as-field-footer"><span>Required · Maximum 1,000 characters</span><span>{form.description.length}/1000</span></div>
              </div>
            </div>

            <div className="as-form-divider" />
            <div className="as-form-section-label"><span>02</span> Price and delivery estimate</div>
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label" htmlFor="as-service-price">Price (INR) <span className="as-required">*</span></label>
                <div className="as-input-with-prefix"><span>₹</span><input id="as-service-price" name="price" type="number" className="form-control as-control" min="0" max="10000000" step="0.01" value={form.price} onChange={updateField} required placeholder="0.00" /></div>
                <div className="as-field-note">₹0 to ₹1,00,00,000</div>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label" htmlFor="as-service-platform-fee">Platform fee (%) <span className="as-required">*</span></label>
                <div className="as-input-with-suffix"><input id="as-service-platform-fee" name="platformFeePercent" type="number" className="form-control as-control" min="0" max="100" step="1" value={form.platformFeePercent} onChange={updateField} required /><span>%</span></div>
                <div className="as-field-note">0–100% · Har service ke liye alag commission</div>
                {(() => {
                  const amountPaise = Math.max(0, Math.round((Number(form.price) || 0) * 100));
                  const feePct = Number(form.platformFeePercent);
                  const validPct = Number.isInteger(feePct) && feePct >= 0 && feePct <= 100;
                  const feePaise = validPct ? Math.round(amountPaise * feePct / 100) : 0;
                  return (
                    <div className="as-fee-preview" aria-live="polite">
                      <span><small>Platform share</small><strong>{formatMoney(feePaise / 100)}</strong></span>
                      <span><small>Staff earning / unit</small><strong>{formatMoney((amountPaise - feePaise) / 100)}</strong></span>
                    </div>
                  );
                })()}
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label" htmlFor="as-service-duration">Estimated duration (minutes) <span className="as-required">*</span></label>
                <div className="as-input-with-suffix"><input id="as-service-duration" name="estimatedDurationMinutes" type="number" className="form-control as-control" min="1" max="10080" step="1" value={form.estimatedDurationMinutes} onChange={updateField} required /><span>minutes</span></div>
                <div className="as-field-note">1 minute to 7 days · Preview: {formatDuration(form.estimatedDurationMinutes)}</div>
              </div>
            </div>

            <div className="as-form-divider" />
            <div className="as-form-section-label"><span>03</span> Customer document requirements</div>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label" htmlFor="as-service-documents">Required documents <span className="as-optional">Optional</span></label>
                <textarea id="as-service-documents" name="requiredDocumentsText" className="form-control as-control" rows={3} value={form.requiredDocumentsText} onChange={updateField} placeholder={'Enter one item per line, or separate with commas\ne.g. Passport-size photo\nIdentity proof'} />
                <div className="as-field-footer"><span>Up to 30 items · Each item max 100 characters</span><span>{parseRequiredDocuments(form.requiredDocumentsText).length}/30 items</span></div>
                {parseRequiredDocuments(form.requiredDocumentsText).length > 0 && (
                  <div className="as-document-preview" aria-label="Required document preview">
                    {parseRequiredDocuments(form.requiredDocumentsText).slice(0, 30).map((item, index) => <span className="as-document-chip" key={`${item}-${index}`}><i className="bi bi-file-earmark-check" />{item}</span>)}
                  </div>
                )}
              </div>
              <div className="col-12">
                <label className={`as-activation-toggle ${form.active ? "is-enabled" : ""}`} htmlFor="as-service-active">
                  <span className="as-toggle-symbol"><i className={`bi ${form.active ? "bi-toggle-on" : "bi-toggle-off"}`} /></span>
                  <span className="as-toggle-copy"><strong>{form.active ? "Service active" : "Service inactive"}</strong><small>{form.active ? "This service can be offered when it is not temporarily closed." : "This service will not be available to customers until activated again."}</small></span>
                  <input id="as-service-active" name="active" type="checkbox" checked={form.active} onChange={updateField} />
                  <span className="as-custom-switch" aria-hidden="true" />
                </label>
                {editingId && <p className="as-field-note mt-2 mb-0">Temporary closure is managed separately so its reason and reopening state remain explicit.</p>}
              </div>
            </div>

            <div className="as-form-actions">
              <span className="as-form-required-note"><span className="as-required">*</span> Required fields</span>
              <div className="d-flex gap-2 flex-wrap">
                <button type="button" className="btn as-btn-light" onClick={resetForm} disabled={saving}>Cancel</button>
                <button type="submit" className="btn as-btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner-border spinner-border-sm me-2" role="status" />Saving…</> : <><i className={`bi ${editingId ? "bi-check2-circle" : "bi-plus-lg"} me-2`} />{editingId ? "Save changes" : "Create service"}</>}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      <section className="as-panel as-catalog-panel">
        <div className="as-catalog-heading">
          <div className="as-panel-heading-copy">
            <span className="as-section-kicker">SERVICE OPERATIONS</span>
            <h2>Catalog management</h2>
            <p>Search, filter, update availability and maintain service requirements.</p>
          </div>
          <div className="as-catalog-heading-actions">
            <button type="button" className="btn as-btn-light" onClick={loadServices} disabled={loading}><i className={`bi bi-arrow-clockwise me-2 ${loading ? "as-spin" : ""}`} />Refresh</button>
            {!formOpen && <button type="button" className="btn as-btn-primary" onClick={openCreateForm}><i className="bi bi-plus-lg me-2" />New service</button>}
          </div>
        </div>

        <div className="as-filter-panel">
          <div className="as-search-field">
            <label htmlFor="as-service-search">Search catalog</label>
            <div className="as-search-control"><i className="bi bi-search" aria-hidden="true" /><input id="as-service-search" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search by service name…" /></div>
          </div>
          <div className="as-filter-field">
            <label htmlFor="as-filter-category">Category</label>
            <select id="as-filter-category" className="form-select as-control" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
              <option value="">All categories</option>
              {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="as-filter-field">
            <label htmlFor="as-filter-active">Activation</label>
            <select id="as-filter-active" className="form-select as-control" value={activeFilter} onChange={(event) => { setActiveFilter(event.target.value); setPage(1); }}>
              <option value="">All</option><option value="true">Active</option><option value="false">Inactive</option>
            </select>
          </div>
          <div className="as-filter-field">
            <label htmlFor="as-filter-closed">Availability</label>
            <select id="as-filter-closed" className="form-select as-control" value={closedFilter} onChange={(event) => { setClosedFilter(event.target.value); setPage(1); }}>
              <option value="">All</option><option value="false">Open</option><option value="true">Temporarily closed</option>
            </select>
          </div>
          <button type="button" className="btn as-btn-light as-clear-filter" onClick={clearFilters} title="Clear all filters"><i className="bi bi-arrow-counterclockwise me-1" />Clear</button>
        </div>

        <div className="as-list-summary">
          <span><strong>{pagination.total ?? 0}</strong> matching services</span>
          <span className="as-list-summary-separator">·</span>
          <span>Showing {services.length} on this page</span>
          {(search || category || activeFilter || closedFilter) && <span className="as-filter-active"><i className="bi bi-funnel-fill me-1" />Filters applied</span>}
        </div>

        {loading ? (
          <div className="as-loading-grid" aria-label="Loading services">
            {[1, 2, 3, 4].map((item) => <div className="as-service-skeleton" key={item}><div className="as-skeleton-line as-skeleton-short" /><div className="as-skeleton-line as-skeleton-title" /><div className="as-skeleton-line" /><div className="as-skeleton-line as-skeleton-medium" /><div className="as-skeleton-actions" /></div>)}
          </div>
        ) : services.length === 0 ? (
          <div className="as-empty-state">
            <div className="as-empty-icon"><i className="bi bi-inboxes" /></div>
            <h3>No services found</h3>
            <p>{search || category || activeFilter || closedFilter ? "Try adjusting the filters or search terms." : "Your catalog is empty. Create your first service to get started."}</p>
            <div className="d-flex justify-content-center gap-2 flex-wrap">
              {(search || category || activeFilter || closedFilter) && <button type="button" className="btn as-btn-light" onClick={clearFilters}>Clear filters</button>}
              {!formOpen && <button type="button" className="btn as-btn-primary" onClick={openCreateForm}><i className="bi bi-plus-lg me-2" />Create service</button>}
            </div>
          </div>
        ) : (
          <div className="as-service-grid">
            {services.map((service) => {
              const status = getServiceStatus(service);
              const busy = busyId === service._id;
              const docs = Array.isArray(service.requiredDocuments) ? service.requiredDocuments : [];
              const isArchived = Boolean(service.deletedAt);
              return (
                <article className={`as-service-card ${isArchived ? "is-archived" : ""}`} key={service._id}>
                  <div className="as-service-card-top">
                    <div className="as-service-icon"><i className={`bi ${CATEGORY_ICONS[service.category] || "bi-grid"}`} /></div>
                    <div className="as-service-title-wrap">
                      <div className="as-service-category">{service.category || "Other"}</div>
                      <h3>{service.name}</h3>
                    </div>
                    <span className={`as-status-pill is-${status.tone}`}><span />{status.label}</span>
                  </div>

                  <p className="as-service-description">{service.description || "No description provided."}</p>

                  <div className="as-service-facts">
                    <div className="as-service-fact"><span>Customer price / unit</span><strong>{formatMoney(service.price)}</strong></div>
                    <div className="as-service-fact"><span>Platform fee</span><strong>{Number(service.platformFeePercent ?? 20)}%</strong></div>
                    <div className="as-service-fact"><span>Staff earning / unit</span><strong>{formatMoney((Math.round((Number(service.price) || 0) * 100) - Math.round(Math.round((Number(service.price) || 0) * 100) * Number(service.platformFeePercent ?? 20) / 100)) / 100)}</strong></div>
                    <div className="as-service-fact"><span>Est. duration</span><strong><i className="bi bi-clock me-1" />{formatDuration(service.estimatedDurationMinutes)}</strong></div>
                  </div>

                  <div className="as-card-subsection">
                    <div className="as-subsection-label"><i className="bi bi-file-earmark-text me-1" />Required documents <span>{docs.length}</span></div>
                    {docs.length ? <div className="as-card-documents">{docs.slice(0, 4).map((doc, index) => <span className="as-document-chip" key={`${doc}-${index}`}>{doc}</span>)}{docs.length > 4 && <span className="as-document-more">+{docs.length - 4} more</span>}</div> : <p className="as-no-documents">No documents specified</p>}
                  </div>

                  {service.closureReason && (
                    <div className="as-closure-note"><i className="bi bi-info-circle-fill" /><div><strong>Closure reason</strong><span>{service.closureReason}</span></div></div>
                  )}
                  {service.deletedAt && <div className="as-archive-note"><i className="bi bi-archive-fill me-2" />Archived {formatDate(service.deletedAt)}</div>}

                  <div className="as-service-meta">
                    <span title={`Created by ${getActorName(service.createdBy)}`}><i className="bi bi-person-plus me-1" />Created {formatDate(service.createdAt)}<small>by {getActorName(service.createdBy)}</small></span>
                    <span title={`Last updated by ${getActorName(service.updatedBy)}`}><i className="bi bi-pencil-square me-1" />Updated {formatDate(service.updatedAt)}<small>by {getActorName(service.updatedBy)}</small></span>
                  </div>

                  <div className="as-service-actions">
                    <div className="as-service-primary-actions">
                      <Link to={`/admin/services/${service._id}`} className="btn as-btn-light as-action-view" title="View full service details"><i className="bi bi-eye me-1" />View</Link>
                      <button type="button" className="btn as-btn-light as-action-edit" onClick={() => startEdit(service)} disabled={isArchived || Boolean(busyId)}><i className="bi bi-pencil-square me-1" />Edit</button>
                    </div>
                    <div className="as-service-secondary-actions">
                      {service.isClosed ? (
                        <button type="button" className="btn as-action-positive" onClick={() => runAction(service._id, () => reopenService(service._id), "Service reopened and available state recalculated.")} disabled={isArchived || Boolean(busyId)}>{busy ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-play-circle me-1" />}Reopen</button>
                      ) : (
                        <button type="button" className="btn as-action-warning" onClick={() => openClosureDialog(service)} disabled={isArchived || Boolean(busyId) || !service.active}><i className="bi bi-pause-circle me-1" />Close temporarily</button>
                      )}
                      {service.active ? (
                        <button type="button" className="btn as-action-muted" onClick={() => runAction(service._id, () => deactivateService(service._id), "Service deactivated.")} disabled={isArchived || Boolean(busyId)}>{busy ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-toggle-off me-1" />}Deactivate</button>
                      ) : (
                        <button type="button" className="btn as-action-positive" onClick={() => runAction(service._id, () => activateService(service._id), "Service activated.")} disabled={isArchived || Boolean(busyId)}>{busy ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-toggle-on me-1" />}Activate</button>
                      )}
                      <button type="button" className="btn as-action-danger" onClick={() => handleDelete(service)} disabled={isArchived || Boolean(busyId)}><i className="bi bi-archive me-1" />Archive</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <footer className="as-pagination-footer">
          <div className="as-pagination-info">Page <strong>{pagination.totalPages ? page : 0}</strong> of <strong>{pagination.totalPages || 0}</strong><span> · </span>{pagination.total ?? 0} matching services</div>
          <div className="as-pagination-controls">
            <button type="button" className="btn as-btn-light" disabled={loading || page <= 1} onClick={() => setPage((current) => current - 1)}><i className="bi bi-chevron-left me-1" />Previous</button>
            <button type="button" className="btn as-btn-light" disabled={loading || !pagination.totalPages || page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Next<i className="bi bi-chevron-right ms-1" /></button>
          </div>
        </footer>
      </section>

      {closureTarget && (
        <div className="as-modal-backdrop" role="presentation">
          <section className="as-closure-modal" role="dialog" aria-modal="true" aria-labelledby="as-closure-title">
            <div className="as-modal-icon"><i className="bi bi-pause-circle" /></div>
            <button type="button" className="as-modal-close" aria-label="Close dialog" onClick={() => setClosureTarget(null)}><i className="bi bi-x-lg" /></button>
            <span className="as-section-kicker">AVAILABILITY CONTROL</span>
            <h2 id="as-closure-title">Temporarily close service?</h2>
            <p className="as-modal-description"><strong>{closureTarget.name}</strong> will remain in your catalog but will be marked temporarily closed. You can reopen it later.</p>
            <form onSubmit={handleClosureSubmit}>
              {error && <div className="as-modal-inline-error" role="alert"><i className="bi bi-exclamation-circle-fill me-2" />{error}</div>}
              <label htmlFor="as-closure-reason" className="form-label">Closure reason <span className="as-optional">Optional</span></label>
              <textarea id="as-closure-reason" className="form-control as-control" rows={4} maxLength={300} value={closureReason} onChange={(event) => setClosureReason(event.target.value)} placeholder="e.g. Printer maintenance, staff unavailable, supplies out of stock…" />
              <div className="as-field-footer"><span>Saved with the service record</span><span>{closureReason.length}/300</span></div>
              <div className="as-modal-actions">
                <button type="button" className="btn as-btn-light" onClick={() => setClosureTarget(null)} disabled={Boolean(busyId)}>Cancel</button>
                <button type="submit" className="btn as-btn-warning" disabled={Boolean(busyId)}>{busyId === closureTarget._id ? <><span className="spinner-border spinner-border-sm me-2" />Closing…</> : <><i className="bi bi-pause-circle me-2" />Confirm closure</>}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
