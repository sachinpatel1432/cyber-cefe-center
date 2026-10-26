import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getActiveServices } from "../services/serviceService";
import "../styles/services.css";

const SERVICE_CATEGORIES = [
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

const CATEGORY_META = {
  Printing: { icon: "bi-printer", tone: "blue", description: "Print-ready documents and copies" },
  Photocopy: { icon: "bi-files", tone: "violet", description: "Clear, convenient document copies" },
  Scanning: { icon: "bi-file-earmark-image", tone: "cyan", description: "Digital copies of physical documents" },
  "Online Forms": { icon: "bi-file-earmark-text", tone: "orange", description: "Online applications and registrations" },
  Typing: { icon: "bi-keyboard", tone: "green", description: "Document typing and formatting" },
  "Passport Photos": { icon: "bi-person-bounding-box", tone: "pink", description: "Photo preparation for applications" },
  Lamination: { icon: "bi-card-image", tone: "amber", description: "Protect important documents" },
  Internet: { icon: "bi-globe2", tone: "indigo", description: "Internet and digital access support" },
  Other: { icon: "bi-grid", tone: "slate", description: "Additional cyber cafe services" },
};

const formatMoney = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

function formatDuration(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 1) return "Duration varies";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

function getServiceIcon(category) {
  const icon = CATEGORY_META[category]?.icon || CATEGORY_META.Other.icon;
  return icon.startsWith("bi bi-") ? icon.slice(3) : icon;
}

function getBookingDestination(service) {
  return `/customer/dashboard?serviceId=${encodeURIComponent(String(service._id))}&openBooking=1`;
}

function isSafeReturnPath(path) {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

export default function Services() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [services, setServices] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Services");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleNotice, setRoleNotice] = useState("");

  const loadServices = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getActiveServices();
      const list = Array.isArray(result?.services) ? result.services : [];
      setServices(
        list.filter(
          (service) => service && service.active !== false && !service.isClosed && !service.deletedAt,
        ),
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Services could not be loaded. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const availableCategories = useMemo(() => {
    const fromData = services
      .map((service) => service.category)
      .filter((value) => typeof value === "string" && value.trim());
    const present = [...new Set(fromData)];
    // Keep the schema's category order, then append any future category returned by the API.
    return [
      ...SERVICE_CATEGORIES.filter((item) => present.includes(item)),
      ...present.filter((item) => !SERVICE_CATEGORIES.includes(item)).sort((a, b) => a.localeCompare(b)),
    ];
  }, [services]);

  const filteredServices = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return services.filter((service) => {
      const matchesCategory = category === "All Services" || service.category === category;
      const searchable = [
        service.name,
        service.description,
        service.category,
        ...(Array.isArray(service.requiredDocuments) ? service.requiredDocuments : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return matchesCategory && (!term || searchable.includes(term));
    });
  }, [services, search, category]);

  const documentReadyCount = useMemo(
    () => services.filter((service) => Array.isArray(service.requiredDocuments) && service.requiredDocuments.length > 0).length,
    [services],
  );

  const handleBookService = (service, authMode = "login") => {
    const returnTo = getBookingDestination(service);
    setRoleNotice("");

    if (user?.role === "customer") {
      navigate(returnTo);
      return;
    }

    if (!user) {
      navigate(authMode === "register" ? "/register" : "/login", {
        state: { returnTo, serviceIntent: { id: String(service._id), name: service.name } },
      });
      return;
    }

    setRoleNotice(
      "This account is not a customer account. Sign out first, then sign in or register with a customer account to book a service.",
    );
  };

  return (
    <main className="public-services">
      <section className="ps-hero">
        <div className="ps-hero-glow ps-hero-glow-one" aria-hidden="true" />
        <div className="ps-hero-glow ps-hero-glow-two" aria-hidden="true" />
        <div className="ps-shell ps-hero-layout">
          <div className="ps-hero-copy">
            <div className="ps-eyebrow"><span className="ps-eyebrow-dot" /> CYBERDESK SERVICE CATALOG</div>
            <h1>Everyday digital work, <span>made simpler.</span></h1>
            <p>
              Browse real services from our catalog, see transparent pricing and required documents,
              then continue to a secure booking flow in your customer workspace.
            </p>
            <div className="ps-hero-actions">
              <a className="ps-button ps-button-primary" href="#ps-catalog">
                Explore services <i className="bi bi-arrow-down-right" aria-hidden="true" />
              </a>
              {!user && (
                <Link className="ps-button ps-button-quiet" to="/login">
                  Sign in <i className="bi bi-arrow-up-right" aria-hidden="true" />
                </Link>
              )}
            </div>
            <div className="ps-trust-row">
              <span><i className="bi bi-check2-circle" aria-hidden="true" /> Live catalog</span>
              <span><i className="bi bi-shield-check" aria-hidden="true" /> Secure account flow</span>
              <span><i className="bi bi-receipt" aria-hidden="true" /> Price shown upfront</span>
            </div>
          </div>

          <aside className="ps-hero-panel" aria-label="Catalog overview">
            <div className="ps-panel-topline"><span className="ps-panel-mark"><i className="bi bi-grid-1x2-fill" /></span><span>CATALOG OVERVIEW</span><span className="ps-live-pill"><i /> LIVE</span></div>
            <div className="ps-panel-main-stat">
              <span>Services available</span>
              <strong>{loading ? "—" : services.length}</strong>
              <small>Currently bookable services</small>
            </div>
            <div className="ps-panel-metrics">
              <div><span className="ps-metric-icon ps-metric-purple"><i className="bi bi-collection" /></span><strong>{loading ? "—" : availableCategories.length}</strong><small>Categories</small></div>
              <div><span className="ps-metric-icon ps-metric-mint"><i className="bi bi-folder-check" /></span><strong>{loading ? "—" : documentReadyCount}</strong><small>With document list</small></div>
            </div>
            <div className="ps-panel-foot"><i className="bi bi-info-circle" /> Service availability reflects the current catalog response.</div>
          </aside>
        </div>
        <div className="ps-hero-bottom-line" aria-hidden="true" />
      </section>

      <section className="ps-main ps-shell" id="ps-catalog">
        <div className="ps-section-heading">
          <div>
            <span className="ps-section-kicker">FIND WHAT YOU NEED</span>
            <h2>Explore services<span>.</span></h2>
            <p>Choose a service to view its price, estimated duration and document requirements.</p>
          </div>
          <div className="ps-results-badge"><strong>{loading ? "—" : filteredServices.length}</strong><span>matching services</span></div>
        </div>

        <div className="ps-catalog-toolbar">
          <label className="ps-search-field" htmlFor="ps-service-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              id="ps-service-search"
              type="search"
              placeholder="Search service, category or document..."
              value={search}
              maxLength={100}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")}><i className="bi bi-x-circle-fill" /></button>}
          </label>
          <div className="ps-category-filters" aria-label="Filter by category">
            {["All Services", ...availableCategories].map((item) => (
              <button
                type="button"
                key={item}
                className={`ps-filter-chip ${category === item ? "is-active" : ""}`}
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                {item === "All Services" && <i className="bi bi-grid" aria-hidden="true" />}
                {item}
              </button>
            ))}
          </div>
        </div>

        {roleNotice && <div className="ps-alert ps-alert-warning" role="alert"><i className="bi bi-person-lock" /><span>{roleNotice}</span><button type="button" onClick={() => setRoleNotice("")} aria-label="Dismiss message"><i className="bi bi-x-lg" /></button></div>}
        {error && <div className="ps-alert ps-alert-error" role="alert"><i className="bi bi-exclamation-circle" /><span>{error}</span><button type="button" className="ps-alert-retry" onClick={loadServices} disabled={loading}>{loading ? "Loading..." : "Retry"}</button></div>}

        {loading ? (
          <div className="ps-service-grid" aria-label="Loading services">
            {Array.from({ length: 6 }, (_, index) => <div className="ps-service-skeleton" key={index}><div /><span /><strong /><p /><p /><footer /></div>)}
          </div>
        ) : error ? null : filteredServices.length === 0 ? (
          <div className="ps-empty-state">
            <div className="ps-empty-icon"><i className="bi bi-search" /></div>
            <h3>{services.length ? "No matching services" : "No services available right now"}</h3>
            <p>{services.length ? "Try another keyword or choose a different category." : "Please check back shortly. The public catalog only shows active, open services."}</p>
            {(search || category !== "All Services") && <button type="button" className="ps-button ps-button-dark" onClick={() => { setSearch(""); setCategory("All Services"); }}>Clear filters</button>}
          </div>
        ) : (
          <div className="ps-service-grid">
            {filteredServices.map((service, index) => {
              const meta = CATEGORY_META[service.category] || CATEGORY_META.Other;
              const requiredDocuments = Array.isArray(service.requiredDocuments) ? service.requiredDocuments : [];
              const serviceName = service.name || "Service";
              return (
                <article className={`ps-service-card ps-tone-${meta.tone}`} key={service._id} style={{ "--ps-card-index": index }}>
                  <div className="ps-service-card-top">
                    <span className="ps-service-icon"><i className={`bi ${getServiceIcon(service.category)}`} aria-hidden="true" /></span>
                    <span className="ps-service-availability"><i /> Available</span>
                  </div>
                  <div className="ps-service-category-label">{service.category || "Other"}</div>
                  <h3>{serviceName}</h3>
                  <p className="ps-service-description">{service.description || "Service details will be confirmed during booking."}</p>
                  <div className="ps-service-meta-row">
                    <span><i className="bi bi-clock" aria-hidden="true" /> {formatDuration(service.estimatedDurationMinutes)}</span>
                    <span><i className="bi bi-shield-check" aria-hidden="true" /> Secure request</span>
                  </div>
                  <div className="ps-document-preview">
                    <div className="ps-document-heading"><span><i className="bi bi-folder2-open" aria-hidden="true" /> Required documents</span><strong>{requiredDocuments.length}</strong></div>
                    {requiredDocuments.length ? (
                      <div className="ps-document-tags">
                        {requiredDocuments.slice(0, 3).map((document, documentIndex) => <span key={`${document}-${documentIndex}`}>{document}</span>)}
                        {requiredDocuments.length > 3 && <span className="ps-document-more">+{requiredDocuments.length - 3} more</span>}
                      </div>
                    ) : <p className="ps-no-documents">No specific documents listed.</p>}
                  </div>
                  <div className="ps-service-card-footer">
                    <div className="ps-price-block"><small>Price per unit</small><strong>{formatMoney(service.price)}</strong></div>
                    <button type="button" className="ps-book-button" onClick={() => handleBookService(service, "login")}>
                      {user?.role === "customer" ? "Book service" : user ? "Customer access" : "Continue to book"}
                      <i className="bi bi-arrow-up-right" aria-hidden="true" />
                    </button>
                    {!user && <button type="button" className="ps-register-link" onClick={() => handleBookService(service, "register")}>New to CyberDesk? Create account</button>}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <section className="ps-help-panel">
          <div className="ps-help-icon"><i className="bi bi-headset" /></div>
          <div className="ps-help-copy"><span className="ps-section-kicker">NEED A HAND?</span><h2>Start with the service. We’ll guide you from there.</h2><p>Choose what you need, sign in or create a customer account, and your selected service will reopen in the booking form after authentication.</p></div>
          <a href="#ps-catalog" className="ps-button ps-button-dark">Browse catalog <i className="bi bi-arrow-up-right" /></a>
        </section>
      </section>
    </main>
  );
}
