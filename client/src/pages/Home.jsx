import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/home.css";

// Optional public API endpoints. Configure these in the Vite .env file.
// The homepage never invents business metrics or claims demo data is live.
const API_BASE = (import.meta.env?.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const API_ENDPOINTS = {
  stats: import.meta.env?.VITE_HOME_STATS_ENDPOINT || (API_BASE ? `${API_BASE}/api/public/home/stats` : ""),
  staff: import.meta.env?.VITE_HOME_STAFF_ENDPOINT || (API_BASE ? `${API_BASE}/api/public/home/staff` : ""),
  feedback: import.meta.env?.VITE_HOME_FEEDBACK_ENDPOINT || (API_BASE ? `${API_BASE}/api/public/home/testimonials` : ""),
  contact: import.meta.env?.VITE_HOME_CONTACT_ENDPOINT || (API_BASE ? `${API_BASE}/api/public/home/contact` : ""),
};

async function requestPublicJson(url, signal, options = {}) {
  if (!url) return null;
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) },
    credentials: "omit",
    ...(signal ? { signal } : {}),
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok || payload?.success === false || payload?.ok === false) {
    const message = payload?.message || payload?.error || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

function getApiList(payload, keys) {
  const root = payload?.data ?? payload?.result ?? payload;
  if (Array.isArray(root)) return root;
  for (const key of keys) {
    if (Array.isArray(root?.[key])) return root[key];
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

function getNumericValue(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function normalizePublicStats(payload) {
  const source = payload?.data ?? payload?.stats ?? payload?.result ?? payload ?? {};
  let successRate = getNumericValue(source, ["successRate", "success_rate", "completionRate", "completion_rate"]);
  if (successRate !== null && successRate > 0 && successRate <= 1) successRate *= 100;
  return {
    ordersProcessed: getNumericValue(source, ["totalOrdersProcessed", "ordersProcessed", "totalOrders", "completedOrders"]),
    activeStaff: getNumericValue(source, ["activeStaffOnline", "activeStaff", "onlineStaff", "staffOnline"]),
    successRate: successRate === null ? null : Math.max(0, Math.min(100, successRate)),
    satisfiedCustomers: getNumericValue(source, ["satisfiedCustomers", "totalCustomers", "happyCustomers", "customersServed"]),
  };
}

function normalizePublicStaff(payload) {
  return getApiList(payload, ["staff", "users", "items", "results"]).map((item, index) => {
    const statusText = String(item.statusLabel || item.status || item.availability || "").toLowerCase();
    const isOnline = item.isOnline === true || statusText === "online" || statusText === "available";
    const rawName = item.name || item.fullName || item.displayName || "Staff member";
    return {
      id: String(item.id || item._id || item.userId || `public-staff-${index}`),
      name: rawName,
      role: item.roleTitle || item.jobTitle || item.role || item.specialization || "Digital Services Specialist",
      specialty: item.specialty || item.specialization || item.department || "Digital assistance",
      group: /print|scan|photocopy/i.test(`${item.specialty || ""} ${item.specialization || ""} ${item.department || ""}`) ? "printing"
        : /document|pdf|upload/i.test(`${item.specialty || ""} ${item.specialization || ""} ${item.department || ""}`) ? "documents" : "forms",
      status: item.statusLabel || (isOnline ? "Online" : String(item.status || item.availability || "Unavailable")),
      statusTone: isOnline ? "online" : /busy|working|in progress/i.test(statusText) ? "busy" : "offline",
      image: (typeof item.profileImage === "string" ? item.profileImage : item.profileImage?.url || item.profileImage?.secure_url) || item.avatar || item.photoUrl || item.photo || "",
      alt: `Portrait of ${rawName}`,
      bio: item.bio || item.shortBio || "Available to support relevant digital service requests.",
      isLive: true,
    };
  });
}

function normalizePublicFeedback(payload) {
  return getApiList(payload, ["testimonials", "reviews", "feedback", "items", "results"]).map((item, index) => ({
    id: String(item.id || item._id || `public-review-${index}`),
    name: item.displayName || item.customerName || item.name || "Customer",
    context: item.serviceName || item.context || "Customer feedback",
    quote: item.comment || item.review || item.quote || item.message || "",
    focus: item.focus || item.serviceName || "Service experience",
    rating: getNumericValue(item, ["rating", "stars"]),
    verified: item.verified === true || item.isVerified === true,
    isLive: true,
  })).filter((item) => item.quote.trim());
}

const SERVICES = [
  {
    icon: "bi-file-earmark-text",
    title: "Online Forms",
    description:
      "Get guided assistance with online applications and form-filling workflows.",
    tone: "violet",
    tag: "Applications",
  },
  {
    icon: "bi-person-vcard",
    title: "PAN Card Assistance",
    description:
      "Get help understanding PAN application steps and the documents you may need.",
    tone: "blue",
    tag: "Documentation",
  },
  {
    icon: "bi-printer",
    title: "Print & Photocopy",
    description:
      "Arrange print, photocopy and scanning requests from one convenient place.",
    tone: "cyan",
    tag: "Print services",
  },
  {
    icon: "bi-laptop",
    title: "Digital Assistance",
    description:
      "Get support with common digital tasks and online service workflows.",
    tone: "orange",
    tag: "Digital help",
  },
  {
    icon: "bi-file-pdf",
    title: "Document Services",
    description:
      "Request help with PDFs, document formatting and file preparation.",
    tone: "pink",
    tag: "Files & PDFs",
  },
  {
    icon: "bi-briefcase",
    title: "Job Application Help",
    description:
      "Get assistance navigating job portals, registrations and applications.",
    tone: "green",
    tag: "Career support",
  },
];

const WORKSPACE_FEATURES = [
  {
    icon: "bi-kanban",
    title: "Request tracking",
    description:
      "See request status and review the progress of your service in your account.",
  },
  {
    icon: "bi-cloud-arrow-up",
    title: "Document uploads",
    description:
      "Submit requested documents and review feedback in the same workflow.",
  },
  {
    icon: "bi-chat-dots",
    title: "Request conversations",
    description:
      "Keep questions and updates connected to the relevant service request.",
  },
  {
    icon: "bi-file-earmark-check",
    title: "Digital deliverables",
    description:
      "Access available final files from your request workspace when they are ready.",
  },
];


const FEATURED_WORKFLOWS = [
  {
    id: "workbridge",
    eyebrow: "FULL-STACK PROJECT",
    title: "WorkBridge — Job & Service Portal",
    description:
      "A role-based portal concept for connecting customers, workers and contractors with structured job workflows.",
    image:
      "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1100&q=85",
    imageAlt: "Illustrative team collaborating around a laptop",
    icon: "bi-briefcase",
    tags: ["Node.js", "Express", "MongoDB", "EJS"],
    previewLabel: "Role-based workflow preview",
    previewSummary:
      "WorkBridge explores how users, contractors and workers can find work, review job details and follow an application through a clear workflow.",
    previewBullets: ["Role-aware dashboards", "Job posting and application flow", "MVC structure with Node.js and Express"],
    audience: "portfolio",
  },
  {
    id: "cyberdesk",
    eyebrow: "CURRENT PRODUCT",
    title: "CyberDesk — Digital Services Workspace",
    description:
      "A digital service portal for service discovery, customer requests, document handling and staff workflows.",
    image:
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1100&q=85",
    imageAlt: "Illustrative developer workspace with a laptop and code",
    icon: "bi-window-stack",
    tags: ["React", "Node.js", "Express", "MongoDB"],
    previewLabel: "Live product route",
    previewSummary:
      "CyberDesk brings service catalogue browsing, request tracking, document review and customer/staff workspaces into one connected product experience.",
    previewBullets: ["Customer service requests", "Staff work queues and document review", "Request conversations and controlled deliverables"],
    audience: "live",
    link: "/services",
    action: "Explore services",
  },
  {
    id: "frontend-lab",
    eyebrow: "FRONT-END PROJECTS",
    title: "JourneyHub — Travel Discovery App",
    description:
      "A travel-discovery project concept for browsing destinations and trip inspiration through a responsive, user-friendly interface.",
    image:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1100&q=85",
    imageAlt: "Illustrative digital workspace showing a laptop and notebook",
    icon: "bi-code-slash",
    tags: ["HTML", "CSS", "JavaScript", "Responsive UI"],
    previewLabel: "Travel app preview",
    previewSummary:
      "JourneyHub is presented as a travel-discovery project concept focused on destination browsing, trip inspiration and a responsive interface.",
    previewBullets: ["Destination discovery layout", "Responsive travel browsing", "Front-end interactions and reusable UI"],
    audience: "portfolio",
  },
];

const DEMO_PERSONAS = [
  {
    name: "Asha",
    role: "Sample customer",
    title: "Needs help with an online form",
    description:
      "A customer explores a service, submits the request and checks what documents or next steps are needed.",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&h=500&q=85",
    alt: "Illustrative portrait for a sample customer persona",
    tone: "lavender",
  },
  {
    name: "Rohan",
    role: "Sample staff member",
    title: "Manages an assigned request",
    description:
      "A staff member reviews the task, communicates with the customer and updates the request through its workflow.",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&h=500&q=85",
    alt: "Illustrative portrait for a sample staff persona",
    tone: "mint",
  },
  {
    name: "Meera",
    role: "Sample customer",
    title: "Needs a file prepared and delivered",
    description:
      "A customer uploads requested documents, follows review feedback and checks deliverables when they become available.",
    image:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=500&h=500&q=85",
    alt: "Illustrative portrait for another sample customer persona",
    tone: "peach",
  },
];

const DEMO_STAFF = [
  {
    id: "forms",
    name: "Priya S.",
    role: "Government Forms Specialist",
    specialty: "Forms & applications",
    group: "forms",
    status: "Online · demo",
    statusTone: "online",
    image: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=500&h=500&q=85",
    alt: "Illustrative professional portrait for a sample forms specialist",
    bio: "Example profile for guided application workflows and document checklists.",
  },
  {
    id: "print",
    name: "Aman V.",
    role: "Printing & Scanning Specialist",
    specialty: "Print, scan & photocopy",
    group: "printing",
    status: "Busy · demo",
    statusTone: "busy",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&h=500&q=85",
    alt: "Illustrative professional portrait for a sample printing specialist",
    bio: "Example profile for print-ready files, scans and document preparation.",
  },
  {
    id: "documents",
    name: "Meera K.",
    role: "Document Support Specialist",
    specialty: "PDFs & document uploads",
    group: "documents",
    status: "Online · demo",
    statusTone: "online",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&h=500&q=85",
    alt: "Illustrative professional portrait for a sample document specialist",
    bio: "Example profile for file checks, requested documents and feedback steps.",
  },
  {
    id: "digital",
    name: "Rahul M.",
    role: "Digital Assistance Specialist",
    specialty: "Digital tasks & registrations",
    group: "forms",
    status: "Busy · demo",
    statusTone: "busy",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=500&h=500&q=85",
    alt: "Illustrative professional portrait for a sample digital support specialist",
    bio: "Example profile for navigating common digital workflows and online registrations.",
  },
];

const SAMPLE_FEEDBACK = [
  {
    id: "feedback-1",
    name: "Asha R.",
    context: "Sample customer journey",
    quote: "The request view makes it easier to understand what I submitted and what the next step should be.",
    focus: "Request tracking",
    rating: 5,
  },
  {
    id: "feedback-2",
    name: "Rohan K.",
    context: "Sample customer journey",
    quote: "Keeping document uploads and review notes next to the request feels more organised than scattered messages.",
    focus: "Document workflow",
    rating: 5,
  },
  {
    id: "feedback-3",
    name: "Meera S.",
    context: "Sample staff workflow",
    quote: "A separate work queue helps the team focus on assigned tasks and see which action is needed next.",
    focus: "Staff workspace",
    rating: 5,
  },
];

const PUBLIC_METRICS = [
  { id: "ordersProcessed", field: "ordersProcessed", suffix: "", label: "Orders processed", note: "Live value from the public stats API", icon: "bi-clipboard2-check", tone: "violet" },
  { id: "activeStaff", field: "activeStaff", suffix: "", label: "Staff online", note: "Live availability from the public stats API", icon: "bi-people", tone: "cyan" },
  { id: "successRate", field: "successRate", suffix: "%", label: "Success rate", note: "Calculated by your backend", icon: "bi-graph-up-arrow", tone: "green" },
  { id: "satisfiedCustomers", field: "satisfiedCustomers", suffix: "", label: "Satisfied customers", note: "Live value from the public stats API", icon: "bi-emoji-smile", tone: "orange" },
];

const PRODUCT_JOURNEY = [
  {
    step: "01",
    phase: "Idea conception",
    title: "Define the everyday problem",
    detail:
      "Bring service discovery, customer requests and follow-up into a more organised digital experience.",
    icon: "bi-lightbulb",
  },
  {
    step: "02",
    phase: "MVP development",
    title: "Build the core platform",
    detail:
      "Create role-aware access, service listings, request records and the key screens needed to manage them.",
    icon: "bi-window-stack",
  },
  {
    step: "03",
    phase: "Workflow integration",
    title: "Connect customers and staff",
    detail:
      "Add request status changes, conversations, document submissions, review steps and deliverable handling.",
    icon: "bi-diagram-3",
  },
  {
    step: "04",
    phase: "Multi-role dashboards",
    title: "Give each role a clear workspace",
    detail:
      "Separate customer requests from staff work queues, document reviews and role-specific next actions.",
    icon: "bi-stars",
  },
  {
    step: "05",
    phase: "Testing & iteration",
    title: "Improve reliability before scale",
    detail:
      "Prioritise reliable flows, useful support paths and a consistent experience across customer and staff workspaces.",
    icon: "bi-arrow-repeat",
  },
];

const STEPS = [
  {
    number: "01",
    icon: "bi-person-plus",
    title: "Create your account",
    description:
      "Sign up or sign in to keep your service requests organized in one place.",
  },
  {
    number: "02",
    icon: "bi-grid",
    title: "Choose a service",
    description:
      "Explore available services, review the details and submit your request.",
  },
  {
    number: "03",
    icon: "bi-check2-circle",
    title: "Track your request",
    description:
      "Follow status updates, share documents and check messages from your workspace.",
  },
];

const FAQS = [
  {
    question: "How do I get started with CyberDesk?",
    answer:
      "Create an account or sign in, open the services page, choose an available service and submit a request with the required details.",
  },
  {
    question: "Can I track a submitted request?",
    answer:
      "Yes. Sign in and open My Requests or your dashboard to review the status and details of your requests.",
  },
  {
    question: "Can I upload documents after submitting a request?",
    answer:
      "For supported requests, you can open the request details and upload documents when the workflow allows it. Follow any instructions shown by the service team.",
  },
  {
    question: "Are all services available at all times?",
    answer:
      "Available services can vary. The Services page shows the services currently listed on the platform.",
  },
  {
    question: "Which dashboards are available to customers and staff?",
    answer:
      "Customers use the Customer Dashboard to manage their requests. Invited staff use the Staff Dashboard to handle assigned work. Administrative tools are kept separate from this public landing page.",
  },
  {
    question: "Are the people shown on this page real customers or employees?",
    answer:
      "No. The sample profiles are illustrative personas used to explain typical workflows; they are not testimonials or representations of actual registered accounts.",
  },
  {
    question: "Is CyberDesk an official government website?",
    answer:
      "CyberDesk is a service-support platform, not a government website. For official eligibility, submission rules or final decisions, always refer to the relevant official department or portal.",
  },
  {
    question: "How can I contact someone about a specific request?",
    answer:
      "Sign in and open the relevant request. When the workflow enables it, use the conversation attached to that request so the right context stays together.",
  },
];

const DASHBOARD_PATHS = {
  admin: "/admin",
  staff: "/staff/dashboard",
  customer: "/customer/dashboard",
};

function AnimatedMetric({ metric }) {
  const elementRef = useRef(null);
  const [count, setCount] = useState(null);

  useEffect(() => {
    const node = elementRef.current;
    if (metric.target === null || metric.target === undefined || !Number.isFinite(Number(metric.target))) {
      setCount(null);
      return undefined;
    }
    if (!node) return undefined;

    let frameId = 0;
    let observer;
    let started = false;

    const animate = () => {
      if (started) return;
      started = true;

      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        setCount(metric.target);
        return;
      }

      const startAt = performance.now();
      const duration = 1050;
      const step = (now) => {
        const progress = Math.min((now - startAt) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(metric.target * eased));
        if (progress < 1) frameId = window.requestAnimationFrame(step);
      };
      frameId = window.requestAnimationFrame(step);
    };

    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          animate();
          observer?.disconnect();
        }
      }, { threshold: 0.4 });
      observer.observe(node);
    } else {
      animate();
    }

    return () => {
      observer?.disconnect();
      window.cancelAnimationFrame(frameId);
    };
  }, [metric.target]);

  return (
    <article className={`cd-metric-card cd-metric-${metric.tone}`} ref={elementRef} data-reveal>
      <span className="cd-metric-icon"><i className={`bi ${metric.icon}`} aria-hidden="true" /></span>
      <strong className="cd-metric-value">{count === null ? "—" : `${count.toLocaleString()}${metric.suffix}`}</strong>
      <span className="cd-metric-label">{metric.label}</span>
      <small>{metric.note}</small>
    </article>
  );
}

function Home() {
  const { user, initializing } = useAuth();
  const homeRef = useRef(null);
  const [theme, setTheme] = useState("dark");
  const [staffFilter, setStaffFilter] = useState("all");
  const [activeProject, setActiveProject] = useState(null);
  const [liveStats, setLiveStats] = useState(null);
  const [staffData, setStaffData] = useState(null);
  const [feedbackData, setFeedbackData] = useState(null);
  const [apiState, setApiState] = useState({ stats: "idle", staff: "idle", feedback: "idle" });
  const [contactForm, setContactForm] = useState({ name: "", phone: "", service: "", message: "" });
  const [contactStatus, setContactStatus] = useState({ kind: "", message: "" });
  const [contactSubmitting, setContactSubmitting] = useState(false);

  const staffSource = staffData ?? DEMO_STAFF;
  const feedbackSource = feedbackData ?? SAMPLE_FEEDBACK;
  const filteredStaff = useMemo(() => (
    staffFilter === "all"
      ? staffSource
      : staffSource.filter((person) => person.group === staffFilter)
  ), [staffFilter, staffData]);

  // Pull only public, display-safe data. Polling is enabled only when an endpoint is configured.
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const loadPublicData = async () => {
      const tasks = [
        ["stats", API_ENDPOINTS.stats, async (payload) => setLiveStats(normalizePublicStats(payload))],
        ["staff", API_ENDPOINTS.staff, async (payload) => setStaffData(normalizePublicStaff(payload))],
        ["feedback", API_ENDPOINTS.feedback, async (payload) => setFeedbackData(normalizePublicFeedback(payload))],
      ];
      await Promise.all(tasks.map(async ([key, endpoint, apply]) => {
        if (!endpoint) {
          if (!disposed) setApiState((current) => ({ ...current, [key]: "not-configured" }));
          return;
        }
        if (!disposed) setApiState((current) => ({ ...current, [key]: "loading" }));
        try {
          const payload = await requestPublicJson(endpoint, controller.signal);
          if (!disposed) {
            await apply(payload);
            setApiState((current) => ({ ...current, [key]: "live" }));
          }
        } catch (error) {
          if (!disposed && error.name !== "AbortError") {
            setApiState((current) => ({ ...current, [key]: "unavailable" }));
            // Keep illustrative fallback content visibly labelled rather than misrepresenting it as live.
          }
        }
      }));
    };
    void loadPublicData();
    const interval = window.setInterval(() => { if (!disposed) void loadPublicData(); }, 60000);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const root = homeRef.current;
    if (!root || !("IntersectionObserver" in window)) return undefined;

    const revealTargets = root.querySelectorAll(
      ".cd-section-heading, .cd-service-card, .cd-step-card, .cd-workspace-card, .cd-project-card, .cd-dashboard-card, .cd-persona-card, .cd-founder-layout, .cd-timeline-item, .cd-contact-card, .cd-faq-item, .cd-staff-card, .cd-feedback-card"
    );
    revealTargets.forEach((element) => element.setAttribute("data-reveal", ""));
    root.classList.add("cd-motion-ready");

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });

    revealTargets.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [staffFilter, staffData, feedbackData]);

  useEffect(() => {
    if (!activeProject) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setActiveProject(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [activeProject]);

  const handleContactChange = (event) => {
    const { name, value } = event.target;
    setContactForm((current) => ({ ...current, [name]: value }));
    if (contactStatus.message) setContactStatus({ kind: "", message: "" });
  };

  const handleContactSubmit = async (event) => {
    event.preventDefault();
    const name = contactForm.name.trim();
    const phone = contactForm.phone.trim();
    const message = contactForm.message.trim();
    const phoneDigits = phone.replace(/[\s()-]/g, "");
    const validPhone = /^(?:\+91)?[6-9]\d{9}$/.test(phoneDigits);
    if (name.length < 2) return setContactStatus({ kind: "error", message: "Please enter your name (at least 2 characters)." });
    if (!validPhone) return setContactStatus({ kind: "error", message: "Enter a valid 10-digit Indian mobile number, optionally with +91." });
    if (!contactForm.service) return setContactStatus({ kind: "error", message: "Please choose a service inquiry." });
    if (message.length < 10) return setContactStatus({ kind: "error", message: "Please add a little more detail (at least 10 characters)." });
    if (!API_ENDPOINTS.contact) return setContactStatus({ kind: "error", message: "Contact submission is not connected yet. Configure VITE_HOME_CONTACT_ENDPOINT to enable sending this message." });

    setContactSubmitting(true);
    setContactStatus({ kind: "pending", message: "Sending your enquiry securely…" });
    try {
      await requestPublicJson(API_ENDPOINTS.contact, undefined, {
        method: "POST",
        body: { name, phone: phoneDigits, service: contactForm.service, message, source: "homepage" },
      });
      setContactForm({ name: "", phone: "", service: "", message: "" });
      setContactStatus({ kind: "success", message: "Your enquiry has been submitted. The team will follow up using the contact details you provided." });
    } catch (error) {
      setContactStatus({ kind: "error", message: error.message || "We could not submit your enquiry. Please try again." });
    } finally {
      setContactSubmitting(false);
    }
  };

  const dashboardPath = DASHBOARD_PATHS[user?.role];
  const mainActionPath = user ? dashboardPath || "/profile" : "/register";
  const trackActionPath = user?.role === "customer"
    ? "/my-requests"
    : user?.role === "staff"
      ? "/staff/dashboard"
      : user?.role === "admin"
        ? "/admin"
        : "/login";
  const trackActionLabel = user?.role === "staff"
    ? "Open My Work"
    : user?.role === "admin"
      ? "Open Workspace"
      : "Track Order";

  const mainActionLabel = user
    ? "Open your workspace"
    : "Create your free account";

  return (
    <main className={`cd-home cd-theme-${theme}`} data-theme={theme} ref={homeRef}>
      {/* HERO */}
      <section className="cd-hero" id="home">
        <div className="cd-hero-grid" aria-hidden="true" />
        <div className="cd-orb cd-orb-one" aria-hidden="true" />
        <div className="cd-orb cd-orb-two" aria-hidden="true" />

        <div className="cd-home-theme-control">
          <span><i className="bi bi-palette2" aria-hidden="true" /> Appearance</span>
          <button
            type="button"
            className="cd-theme-toggle"
            onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
            aria-pressed={theme === "dark"}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} landing page theme`}
          >
            <i className={`bi ${theme === "dark" ? "bi-moon-stars-fill" : "bi-sun-fill"}`} aria-hidden="true" />
            {theme === "dark" ? "Dark" : "Light"}
          </button>
        </div>

        <div className="cd-container cd-hero-layout">
          <div className="cd-hero-copy cd-animate-in">
            <div className="cd-eyebrow-pill">
              <span className="cd-eyebrow-spark">
                <i className="bi bi-stars" aria-hidden="true" />
              </span>
              CYBERDESK · DIGITAL CYBER CAFE
            </div>

            <h1>
              India's Smartest Digital Cyber Cafe
              <br />
              <span className="cd-gradient-text">& Automated Service Hub.</span>
            </h1>

            <p className="cd-hero-description">
              Get guided help with online forms, document processing, printing and government-form workflows—then track request status, staff updates and access-controlled digital deliverables where supported.
            </p>

            <div className="cd-hero-actions">
              <Link to="/services" className="cd-button cd-button-primary">
                Explore Services
                <i className="bi bi-arrow-up-right" aria-hidden="true" />
              </Link>
              {!initializing && (
                <Link to={trackActionPath} className="cd-button cd-button-glass">
                  {trackActionLabel}
                  <i className="bi bi-arrow-right" aria-hidden="true" />
                </Link>
              )}
            </div>

            <div className="cd-hero-points">
              <span>
                <i className="bi bi-check-circle-fill" aria-hidden="true" />
                Simple request flow
              </span>
              <span>
                <i className="bi bi-check-circle-fill" aria-hidden="true" />
                Clear status updates
              </span>
              <span>
                <i className="bi bi-check-circle-fill" aria-hidden="true" />
                One connected workspace
              </span>
            </div>
          </div>

          <div className="cd-hero-visual cd-animate-in cd-animate-delay" aria-label="Illustration of the CyberDesk workspace">
            <div className="cd-visual-aura" />

            <div className="cd-preview-window">
              <div className="cd-preview-topbar">
                <div className="cd-window-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="cd-preview-top-label">CYBERDESK WORKSPACE</span>
                <span className="cd-preview-live">
                  <span /> LIVE UI
                </span>
              </div>

              <div className="cd-preview-content">
                <div className="cd-preview-welcome">
                  <div>
                    <span className="cd-preview-kicker">YOUR DIGITAL DESK</span>
                    <h2>Everything in one place.</h2>
                    <p>Choose a task and keep things moving.</p>
                  </div>
                  <div className="cd-preview-user" aria-hidden="true">
                    <i className="bi bi-person-fill" />
                  </div>
                </div>

                <div className="cd-preview-search">
                  <i className="bi bi-search" aria-hidden="true" />
                  <span>What would you like to do?</span>
                  <i className="bi bi-sliders2" aria-hidden="true" />
                </div>

                <div className="cd-preview-services">
                  <div className="cd-mini-service cd-mini-violet">
                    <span><i className="bi bi-file-earmark-text" /></span>
                    <strong>Online forms</strong>
                    <small>Application help</small>
                  </div>
                  <div className="cd-mini-service cd-mini-blue">
                    <span><i className="bi bi-printer" /></span>
                    <strong>Print & scan</strong>
                    <small>Document services</small>
                  </div>
                  <div className="cd-mini-service cd-mini-green">
                    <span><i className="bi bi-folder2-open" /></span>
                    <strong>Documents</strong>
                    <small>File assistance</small>
                  </div>
                  <div className="cd-mini-service cd-mini-orange">
                    <span><i className="bi bi-briefcase" /></span>
                    <strong>Job support</strong>
                    <small>Application guidance</small>
                  </div>
                </div>

                <div className="cd-preview-request">
                  <div className="cd-preview-request-icon">
                    <i className="bi bi-clipboard-check" />
                  </div>
                  <div className="cd-preview-request-copy">
                    <strong>Request workspace</strong>
                    <span>Updates, documents and messages</span>
                  </div>
                  <span className="cd-preview-request-arrow">
                    <i className="bi bi-arrow-up-right" />
                  </span>
                </div>
              </div>
            </div>

            <div className="cd-float-card cd-float-card-top">
              <span className="cd-float-icon cd-float-icon-blue">
                <i className="bi bi-lightning-charge-fill" />
              </span>
              <span>
                <strong>Less back-and-forth</strong>
                <small>Keep requests organised</small>
              </span>
            </div>

            <div className="cd-float-card cd-float-card-bottom">
              <span className="cd-float-icon cd-float-icon-green">
                <i className="bi bi-check2-circle" />
              </span>
              <span>
                <strong>Progress at a glance</strong>
                <small>Follow request status</small>
              </span>
            </div>
          </div>
        </div>

        <div className="cd-container cd-hero-bottom">
          <span>BUILT AROUND YOUR EVERYDAY SERVICE TASKS</span>
          <div className="cd-bottom-line" />
          <a href="#services" className="cd-scroll-link">
            Discover the platform
            <i className="bi bi-arrow-down-right" aria-hidden="true" />
          </a>
        </div>
      </section>

      {/* ANIMATED CAPABILITY METRICS — not live order/traffic claims */}
      <section className="cd-metrics-section" aria-label="CyberDesk platform capability snapshot">
        <div className="cd-container">
          <div className="cd-metrics-heading">
            <span className="cd-section-eyebrow">LIVE PLATFORM SNAPSHOT</span>
            <p>Business totals are read from your public backend API. A dash means the metric is not currently available—no activity figures are fabricated.</p>
          </div>
          <div className="cd-metrics-grid cd-metrics-grid-four">
            {PUBLIC_METRICS.map((metric) => <AnimatedMetric key={metric.id} metric={{
              ...metric,
              target: liveStats?.[metric.field] ?? null,
              note: liveStats?.[metric.field] !== null && liveStats?.[metric.field] !== undefined
                ? "Updated from connected API"
                : API_ENDPOINTS.stats
                  ? apiState.stats === "loading" ? "Connecting to public stats API…" : "Metric not supplied by the backend"
                  : "Configure the public stats API to show live data",
            }} />)}
          </div>
          <p className={`cd-api-status cd-api-status-${apiState.stats}`} role="status">
            <span /> {apiState.stats === "live" ? "Stats API connected · refreshes automatically" : apiState.stats === "loading" ? "Connecting to stats API…" : "Live stats are waiting for backend endpoint configuration"}
          </p>
        </div>
      </section>

      {/* VALUE STRIP */}
      <section className="cd-value-strip" aria-label="CyberDesk benefits">
        <div className="cd-container cd-value-grid">
          <div className="cd-value-item">
            <span className="cd-value-icon"><i className="bi bi-grid-1x2" /></span>
            <span><strong>One workspace</strong><small>Services and requests together</small></span>
          </div>
          <div className="cd-value-item">
            <span className="cd-value-icon"><i className="bi bi-arrow-repeat" /></span>
            <span><strong>Track progress</strong><small>Know where your request stands</small></span>
          </div>
          <div className="cd-value-item">
            <span className="cd-value-icon"><i className="bi bi-chat-square-text" /></span>
            <span><strong>Stay connected</strong><small>Messages linked to requests</small></span>
          </div>
          <div className="cd-value-item">
            <span className="cd-value-icon"><i className="bi bi-file-earmark-check" /></span>
            <span><strong>File support</strong><small>Documents and deliverables</small></span>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="cd-section cd-services-section" id="services">
        <div className="cd-container">
          <div className="cd-section-heading cd-section-heading-centered">
            <span className="cd-section-eyebrow">EXPLORE OUR SERVICES</span>
            <h2>What do you need <span>help with today?</span></h2>
            <p>
              Explore the services listed on CyberDesk and choose the one that fits your task.
            </p>
          </div>

          <div className="cd-services-grid">
            {SERVICES.map((service, index) => (
              <article
                className={`cd-service-card cd-service-${service.tone}`}
                key={service.title}
                style={{ "--cd-card-index": index }}
              >
                <div className="cd-service-card-top">
                  <span className="cd-service-icon">
                    <i className={`bi ${service.icon}`} aria-hidden="true" />
                  </span>
                  <span className="cd-service-arrow" aria-hidden="true">
                    <i className="bi bi-arrow-up-right" />
                  </span>
                </div>
                <span className="cd-service-tag">{service.tag}</span>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <Link to="/services" className="cd-text-link">
                  Explore service options
                  <i className="bi bi-arrow-right" aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>

          <div className="cd-services-footer">
            <p>Looking for something specific?</p>
            <Link to="/services" className="cd-button cd-button-outline">
              View all available services
              <i className="bi bi-arrow-up-right" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="cd-section cd-process-section" id="how-it-works">
        <div className="cd-container">
          <div className="cd-process-layout">
            <div className="cd-process-intro">
              <span className="cd-section-eyebrow">A SIMPLE FLOW</span>
              <h2>From first click to <span>clear next steps.</span></h2>
              <p>
                No need to keep every detail in your head. Use your CyberDesk account to
                submit a request and return to its workspace when you need an update.
              </p>
              <Link to={user ? dashboardPath || "/profile" : "/register"} className="cd-button cd-button-primary">
                {user ? "Go to your dashboard" : "Start with CyberDesk"}
                <i className="bi bi-arrow-up-right" aria-hidden="true" />
              </Link>
              <div className="cd-process-note">
                <i className="bi bi-info-circle" aria-hidden="true" />
                Available steps depend on the service and request status.
              </div>
            </div>

            <div className="cd-steps-list">
              {STEPS.map((step, index) => (
                <article className="cd-step-card" key={step.number} style={{ "--cd-card-index": index }}>
                  <div className="cd-step-number">{step.number}</div>
                  <div className="cd-step-icon"><i className={`bi ${step.icon}`} aria-hidden="true" /></div>
                  <div className="cd-step-copy">
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                  {index < STEPS.length - 1 && <div className="cd-step-connector" aria-hidden="true" />}
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WORKSPACE FEATURES */}
      <section className="cd-section cd-workspace-section" id="workspace">
        <div className="cd-container">
          <div className="cd-workspace-heading">
            <div className="cd-section-heading">
              <span className="cd-section-eyebrow">MORE THAN A SERVICE LIST</span>
              <h2>Your request has a <span>home of its own.</span></h2>
              <p>
                CyberDesk brings key parts of the request workflow together, so you can
                find updates without jumping between unrelated pages.
              </p>
            </div>
            <Link to={user ? dashboardPath || "/profile" : "/register"} className="cd-button cd-button-outline">
              {user ? "Open workspace" : "Create an account"}
              <i className="bi bi-arrow-up-right" aria-hidden="true" />
            </Link>
          </div>

          <div className="cd-workspace-grid">
            {WORKSPACE_FEATURES.map((feature, index) => (
              <article className="cd-workspace-card" key={feature.title} style={{ "--cd-card-index": index }}>
                <div className="cd-workspace-icon"><i className={`bi ${feature.icon}`} aria-hidden="true" /></div>
                <div className="cd-workspace-card-index">0{index + 1}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <span className="cd-workspace-card-rule" />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* SHOWCASE BAND */}
      <section className="cd-showcase-section">
        <div className="cd-container">
          <div className="cd-showcase-card">
            <div className="cd-showcase-glow" aria-hidden="true" />
            <div className="cd-showcase-copy">
              <span className="cd-section-eyebrow cd-section-eyebrow-light">MADE FOR EVERYDAY TASKS</span>
              <h2>Less confusion.<br /><span>More clarity.</span></h2>
              <p>
                Keep service details, request status, document steps and conversations
                connected in one digital workspace.
              </p>
              <Link to={user ? dashboardPath || "/profile" : "/register"} className="cd-button cd-button-white">
                {user ? "Continue to CyberDesk" : "Get started today"}
                <i className="bi bi-arrow-up-right" aria-hidden="true" />
              </Link>
            </div>

            <div className="cd-showcase-art" aria-hidden="true">
              <div className="cd-art-ring cd-art-ring-one" />
              <div className="cd-art-ring cd-art-ring-two" />
              <div className="cd-art-orbit-dot cd-art-dot-one" />
              <div className="cd-art-orbit-dot cd-art-dot-two" />
              <div className="cd-art-panel cd-art-panel-main">
                <div className="cd-art-panel-header"><span /><span /><span /></div>
                <div className="cd-art-row"><span className="cd-art-row-icon"><i className="bi bi-file-earmark-text" /></span><span className="cd-art-row-lines"><i /><i /></span><span className="cd-art-check"><i className="bi bi-check2" /></span></div>
                <div className="cd-art-row"><span className="cd-art-row-icon cd-art-row-icon-purple"><i className="bi bi-chat-dots" /></span><span className="cd-art-row-lines"><i /><i /></span><span className="cd-art-dot-status" /></div>
                <div className="cd-art-row"><span className="cd-art-row-icon cd-art-row-icon-green"><i className="bi bi-folder2-open" /></span><span className="cd-art-row-lines"><i /><i /></span><span className="cd-art-check"><i className="bi bi-check2" /></span></div>
              </div>
              <div className="cd-art-float cd-art-float-left"><i className="bi bi-shield-check" /><span>Organised</span></div>
              <div className="cd-art-float cd-art-float-right"><i className="bi bi-arrow-repeat" /><span>Track progress</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="cd-section cd-about-section" id="about">
        <div className="cd-container cd-about-layout">
          <div className="cd-about-visual">
            <div className="cd-about-orb" />
            <div className="cd-about-main-card">
              <div className="cd-about-brand-icon"><i className="bi bi-pc-display-horizontal" /></div>
              <span className="cd-about-overline">WELCOME TO</span>
              <h3>Cyber<span>Desk</span></h3>
              <p>Your digital service workspace.</p>
              <div className="cd-about-card-line" />
              <div className="cd-about-card-bottom"><i className="bi bi-check-circle-fill" /> A clearer way to manage requests</div>
            </div>
            <div className="cd-about-mini-card cd-about-mini-one"><i className="bi bi-grid" /><span>Services</span></div>
            <div className="cd-about-mini-card cd-about-mini-two"><i className="bi bi-chat-left-text" /><span>Updates</span></div>
          </div>

          <div className="cd-about-copy">
            <span className="cd-section-eyebrow">ABOUT CYBERDESK</span>
            <h2>A practical digital desk for <span>real-world tasks.</span></h2>
            <p>
              CyberDesk is designed to make common digital service workflows easier to
              access and manage. Discover listed services, submit requests and return
              to a dedicated workspace for updates, documents and communication.
            </p>

            <div className="cd-about-points">
              <div><i className="bi bi-check2-circle" /><span><strong>Clear request journeys</strong><small>Understand the current status and next step.</small></span></div>
              <div><i className="bi bi-check2-circle" /><span><strong>Connected information</strong><small>Keep relevant files and messages close to the request.</small></span></div>
              <div><i className="bi bi-check2-circle" /><span><strong>Designed for simplicity</strong><small>A straightforward interface across desktop and mobile.</small></span></div>
            </div>

            <div className="cd-about-actions">
              <Link to="#founder" className="cd-text-link cd-text-link-large">
                Meet the builder behind CyberDesk
                <i className="bi bi-arrow-down-right" aria-hidden="true" />
              </Link>
              <Link to="/services" className="cd-text-link cd-text-link-large">
                Learn about available services
                <i className="bi bi-arrow-right" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* PORTFOLIO PROJECTS — preview action opens an in-page project modal */}
      <section className="cd-section cd-projects-section" id="projects">
        <div className="cd-container">
          <div className="cd-section-heading cd-section-heading-centered">
            <span className="cd-section-eyebrow">PROJECT SHOWCASE</span>
            <h2>Ideas turned into <span>working interfaces.</span></h2>
            <p>A mix of full-stack workflow projects and front-end experiments. Preview cards explain the scope; they are not claims of external client work.</p>
          </div>
          <div className="cd-project-grid">
            {FEATURED_WORKFLOWS.map((project, index) => (
              <article className="cd-project-card" key={project.id} style={{ "--cd-card-index": index }} data-reveal>
                <div className="cd-project-image-wrap">
                  <img src={project.image} alt={project.imageAlt} loading="lazy" />
                  <span className="cd-project-image-label">{project.eyebrow}</span>
                  <span className="cd-project-image-icon"><i className={`bi ${project.icon}`} aria-hidden="true" /></span>
                  <span className="cd-project-image-glass">PROJECT PREVIEW</span>
                </div>
                <div className="cd-project-card-body">
                  <div className="cd-project-tags">{project.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                  <h3>{project.title}</h3>
                  <p>{project.description}</p>
                  <button type="button" className="cd-text-link cd-project-preview-button" onClick={() => setActiveProject(project)}>
                    Preview project <i className="bi bi-arrow-up-right" aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
          <p className="cd-disclaimer-line"><i className="bi bi-info-circle" aria-hidden="true" /> Project preview screens are illustrative. External project links are only shown where a verified destination is available.</p>
        </div>
      </section>

      {/* CUSTOMER AND STAFF DASHBOARDS */}
      <section className="cd-section cd-dashboards-section" id="workspaces">
        <div className="cd-container">
          <div className="cd-workspace-heading cd-dashboard-intro">
            <div className="cd-section-heading">
              <span className="cd-section-eyebrow">YOUR ROLE, YOUR WORKSPACE</span>
              <h2>Two views. <span>One connected process.</span></h2>
              <p>Customers and invited staff see different tools for the work they need to do. Administrative tools are intentionally not featured here.</p>
            </div>
            <span className="cd-role-note"><i className="bi bi-shield-check" aria-hidden="true" /> Role-based access</span>
          </div>

          <div className="cd-dashboard-grid">
            <article className="cd-dashboard-card cd-dashboard-customer">
              <div className="cd-dashboard-card-top">
                <span className="cd-dashboard-role-icon"><i className="bi bi-person-workspace" aria-hidden="true" /></span>
                <span className="cd-dashboard-role-label">FOR CUSTOMERS</span>
              </div>
              <div className="cd-dashboard-mock cd-dashboard-mock-customer" aria-hidden="true">
                <div className="cd-mock-toolbar"><span /><span /><span /><b>My workspace</b></div>
                <div className="cd-mock-greeting"><span><i className="bi bi-sun" /> Customer overview</span><strong>Your requests, in one place</strong></div>
                <div className="cd-mock-stat-row"><span><small>Requests</small><b>Track</b></span><span><small>Documents</small><b>Upload</b></span><span><small>Updates</small><b>Review</b></span></div>
                <div className="cd-mock-request"><i className="bi bi-file-earmark-text" /><span><b>Service request</b><small>Status and next steps</small></span><em>In workspace</em></div>
              </div>
              <h3>Customer Dashboard</h3>
              <p>Explore services, submit requests, follow progress, upload supported documents and access deliverables when available.</p>
              <ul>
                <li><i className="bi bi-check2-circle" /> Service requests and booking history</li>
                <li><i className="bi bi-check2-circle" /> Document and payment status visibility</li>
                <li><i className="bi bi-check2-circle" /> Request-linked conversations and files</li>
              </ul>
              <Link to={user?.role === "customer" ? "/customer/dashboard" : user ? "/services" : "/register"} className="cd-button cd-button-primary">
                {user?.role === "customer" ? "Open customer dashboard" : user ? "Explore customer services" : "Create a customer account"}
                <i className="bi bi-arrow-up-right" aria-hidden="true" />
              </Link>
            </article>

            <article className="cd-dashboard-card cd-dashboard-staff">
              <div className="cd-dashboard-card-top">
                <span className="cd-dashboard-role-icon"><i className="bi bi-person-gear" aria-hidden="true" /></span>
                <span className="cd-dashboard-role-label">FOR INVITED STAFF</span>
              </div>
              <div className="cd-dashboard-mock cd-dashboard-mock-staff" aria-hidden="true">
                <div className="cd-mock-toolbar"><span /><span /><span /><b>Operations</b></div>
                <div className="cd-staff-mock-heading"><strong>My work queue</strong><small>Example layout</small></div>
                <div className="cd-staff-mock-row"><i className="bi bi-inbox" /><span><b>Available requests</b><small>Claim eligible work</small></span><em>01</em></div>
                <div className="cd-staff-mock-row"><i className="bi bi-file-earmark-check" /><span><b>Document review</b><small>Review submitted files</small></span><em>02</em></div>
                <div className="cd-staff-mock-row"><i className="bi bi-chat-dots" /><span><b>Request messages</b><small>Keep context connected</small></span><em>03</em></div>
              </div>
              <h3>Staff Dashboard</h3>
              <p>Work with eligible requests, manage assigned tasks, review documents and communicate with customers through the request workflow.</p>
              <ul>
                <li><i className="bi bi-check2-circle" /> Separate work queues and request status</li>
                <li><i className="bi bi-check2-circle" /> Document review and deliverable workflows</li>
                <li><i className="bi bi-check2-circle" /> Request-specific customer conversations</li>
              </ul>
              {user?.role === "staff" ? (
                <Link to="/staff/dashboard" className="cd-button cd-button-outline">
                  Open staff dashboard
                  <i className="bi bi-arrow-up-right" aria-hidden="true" />
                </Link>
              ) : user ? (
                <span className="cd-button cd-button-outline cd-button-disabled">
                  Staff access is invitation-based
                  <i className="bi bi-lock" aria-hidden="true" />
                </span>
              ) : (
                <Link to="/login" className="cd-button cd-button-outline">
                  Staff sign-in
                  <i className="bi bi-arrow-up-right" aria-hidden="true" />
                </Link>
              )}
              <span className="cd-staff-access-note"><i className="bi bi-envelope-check" aria-hidden="true" /> Staff access is invitation-based.</span>
            </article>
          </div>
        </div>
      </section>

      {/* SAMPLE USERS AND STAFF — CLEARLY LABELLED AS ILLUSTRATIVE */}
      <section className="cd-section cd-personas-section" id="people">
        <div className="cd-container">
          <div className="cd-section-heading cd-section-heading-centered">
            <span className="cd-section-eyebrow">A FEW EXAMPLE JOURNEYS</span>
            <h2>Designed for the people <span>doing the work.</span></h2>
            <p>These illustrative profiles explain how different people may use the platform. They are not real user accounts, staff profiles or testimonials.</p>
          </div>
          <div className="cd-persona-grid">
            {DEMO_PERSONAS.map((person, index) => (
              <article className={`cd-persona-card cd-persona-${person.tone}`} key={person.name} style={{ "--cd-card-index": index }}>
                <div className="cd-persona-topline"><span><i className="bi bi-person-badge" aria-hidden="true" /> DEMO PERSONA</span><i className="bi bi-stars" aria-hidden="true" /></div>
                <div className="cd-persona-profile">
                  <img src={person.image} alt={person.alt} loading="lazy" />
                  <div><h3>{person.name}</h3><span>{person.role}</span></div>
                </div>
                <h4>{person.title}</h4>
                <p>{person.description}</p>
                <span className="cd-persona-disclaimer">Illustrative example · not a real account</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* SAMPLE STAFF DIRECTORY — profiles and status are illustrative, not live */}
      <section className="cd-section cd-staff-directory-section" id="staff-directory">
        <div className="cd-container">
          <div className="cd-workspace-heading cd-staff-directory-heading">
            <div className="cd-section-heading">
              <span className="cd-section-eyebrow">MEET THE SUPPORT ROLES</span>
              <h2>Help for each step of <span>your digital task.</span></h2>
              <p>{staffData !== null ? "Staff profiles and availability are loaded from the connected public directory." : "Explore illustrative staff specialisations. Configure the public staff endpoint to show live directory records."}</p>
            </div>
            <span className="cd-role-note"><i className={`bi ${staffData !== null ? "bi-broadcast" : "bi-person-lines-fill"}`} aria-hidden="true" /> {staffData !== null ? "Live directory" : "Sample directory"}</span>
          </div>

          <div className="cd-staff-filter-bar" role="group" aria-label="Filter sample staff by speciality">
            {[
              { id: "all", label: "All specialties" },
              { id: "forms", label: "Forms & digital" },
              { id: "printing", label: "Print & scan" },
              { id: "documents", label: "Documents" },
            ].map((item) => (
              <button type="button" key={item.id} className={`cd-staff-filter ${staffFilter === item.id ? "is-active" : ""}`} aria-pressed={staffFilter === item.id} onClick={() => setStaffFilter(item.id)}>
                {item.label}
              </button>
            ))}
          </div>

          <div className="cd-staff-grid">
            {filteredStaff.map((person, index) => (
              <article className="cd-staff-card" key={person.id} data-reveal style={{ "--cd-card-index": index }}>
                <div className="cd-staff-photo-wrap">
                  {person.image ? <img src={person.image} alt={person.alt} loading="lazy" /> : <div className="cd-staff-avatar-fallback" aria-hidden="true">{person.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>}
                  <span className={`cd-staff-status cd-staff-status-${person.statusTone}`}><i aria-hidden="true" />{person.status}</span>
                  <span className="cd-staff-demo-label">{person.isLive ? "LIVE PROFILE" : "SAMPLE PROFILE"}</span>
                </div>
                <div className="cd-staff-card-body">
                  <span className="cd-staff-specialty">{person.specialty}</span>
                  <h3>{person.name}</h3>
                  <p className="cd-staff-role">{person.role}</p>
                  <p>{person.bio}</p>
                  {user?.role === "staff" ? (
                    <Link to="/staff/dashboard" className="cd-text-link">Open staff workspace <i className="bi bi-arrow-right" aria-hidden="true" /></Link>
                  ) : user?.role === "customer" ? (
                    <Link to="/my-requests" className="cd-text-link">View my requests <i className="bi bi-arrow-right" aria-hidden="true" /></Link>
                  ) : (
                    <Link to="/login" className="cd-text-link">Sign in for request support <i className="bi bi-arrow-right" aria-hidden="true" /></Link>
                  )}
                </div>
              </article>
            ))}
          </div>
          {staffData !== null && filteredStaff.length === 0 && <p className="cd-api-empty-state">No staff profiles match this filter right now.</p>}
          <p className="cd-staff-disclaimer"><i className="bi bi-info-circle" aria-hidden="true" /> {staffData !== null ? "Only fields returned by your public staff endpoint are displayed. Expose safe public profile fields only; never return private account data or direct personal contact details." : "Names, portraits and Online/Busy badges are illustrative demo data, not real staff records. Configure VITE_HOME_STAFF_ENDPOINT to connect a live public directory."}</p>
        </div>
      </section>

      {/* SAMPLE TESTIMONIAL CARDS — must be replaced with verified feedback before launch */}
      <section className="cd-section cd-feedback-section" id="stories">
        <div className="cd-container">
          <div className="cd-section-heading cd-section-heading-centered">
            <span className="cd-section-eyebrow">EXPERIENCE PREVIEW</span>
            <h2>Designed around clearer <span>service journeys.</span></h2>
            <p>{feedbackData !== null ? "Feedback is loaded from the connected public reviews endpoint. Display only genuine feedback with customer permission." : "These sample quotes demonstrate the layout. They are not real customer reviews or verified endorsements."}</p>
          </div>
          <div className="cd-feedback-grid">
            {feedbackSource.map((item, index) => (
              <article className="cd-feedback-card" key={item.id} data-reveal style={{ "--cd-card-index": index }}>
                <div className="cd-feedback-card-top">
                  <span className="cd-feedback-demo-badge"><i className="bi bi-chat-quote" aria-hidden="true" /> {item.isLive ? (item.verified ? "VERIFIED FEEDBACK" : "CONNECTED FEEDBACK") : "SAMPLE FEEDBACK"}</span>
                  {Number.isFinite(Number(item.rating)) && item.rating !== null && item.rating !== undefined ? <span className="cd-feedback-stars" aria-label={`${item.rating} out of 5 stars`}>{Array.from({ length: Math.min(5, Math.max(0, Math.round(Number(item.rating)))) }, (_, star) => <i className="bi bi-star-fill" key={star} aria-hidden="true" />)}</span> : null}
                </div>
                <blockquote>“{item.quote}”</blockquote>
                <div className="cd-feedback-author">
                  <span className="cd-feedback-avatar">{item.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
                  <span><strong>{item.name}</strong><small>{item.context}</small></span>
                  <span className="cd-feedback-focus">{item.focus}</span>
                </div>
              </article>
            ))}
          </div>
          {feedbackData !== null && feedbackSource.length === 0 && <p className="cd-api-empty-state">No public reviews are available yet.</p>}
          <p className="cd-feedback-disclaimer"><i className="bi bi-shield-check" aria-hidden="true" /> {feedbackData !== null ? "The connected endpoint supplies these review records. Confirm consent and moderation in the backend before publishing feedback publicly." : "Sample reviews are placeholders only. Configure VITE_HOME_FEEDBACK_ENDPOINT to connect real, consented feedback."}</p>
        </div>
      </section>

      {/* FOUNDER / DEVELOPER STORY */}
      <section className="cd-section cd-founder-section" id="founder">
        <div className="cd-container cd-founder-layout">
          <div className="cd-founder-visual">
            <div className="cd-founder-photo-frame">
              <img
                src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&h=1500&q=90"
                alt="Illustrative portrait placeholder; replace with an approved portrait of Er. Sachin Patel before publishing"
                loading="lazy"
              />
              <div className="cd-founder-image-caption"><i className="bi bi-code-slash" aria-hidden="true" /><span>Illustrative portrait · replace before launch</span></div>
            </div>
            <div className="cd-founder-monogram" aria-label="Founder initials SP">SP</div>
            <div className="cd-founder-visual-note"><i className="bi bi-lightbulb" aria-hidden="true" /><span><strong>Build with purpose</strong><small>Practical workflows over empty promises.</small></span></div>
          </div>
          <div className="cd-founder-copy">
            <span className="cd-section-eyebrow">THE BUILDER BEHIND THE PRODUCT</span>
            <h2>Er. Sachin Patel <span>— Founder & Developer.</span></h2>
            <p className="cd-founder-role">Full-Stack Developer & Founder</p>
            <p className="cd-founder-lead">I’m Sachin Patel, a Computer Science graduate building CyberDesk to make everyday digital service tasks clearer, more organised and easier to follow.</p>
            <p>My focus is on turning everyday service tasks into clearer digital journeys: a service can be discovered, a request can be followed, documents can be handled in context, and the customer and service team can see the next step more clearly.</p>
            <p>CyberDesk is an evolving product. The priority is to make the core workflows understandable, useful and reliable before making bigger promises.</p>
            <div className="cd-founder-focus-grid">
              <div><span><i className="bi bi-mortarboard" aria-hidden="true" /></span><strong>Computer Science</strong><small>B.Tech CSE · 2022–2026</small></div>
              <div><span><i className="bi bi-code-square" aria-hidden="true" /></span><strong>Product development</strong><small>React, Node.js, Express and MongoDB</small></div>
              <div><span><i className="bi bi-diagram-3" aria-hidden="true" /></span><strong>Workflow thinking</strong><small>Clear roles, states and next steps</small></div>
              <div><span><i className="bi bi-phone" aria-hidden="true" /></span><strong>Usable interfaces</strong><small>Responsive, role-aware experiences</small></div>
            </div>
            <blockquote className="cd-founder-quote">“Good software should make the next step clearer—not make people guess what to do.”</blockquote>
            <div className="cd-founder-stack" aria-label="Technology stack">
              {["MERN", "React", "Node.js", "Express", "MongoDB", "UI/UX"].map((technology) => <span key={technology}>{technology}</span>)}
            </div>
            <div className="cd-founder-actions">
              <a href="https://github.com/sachinpatel1432" target="_blank" rel="noreferrer" className="cd-button cd-button-outline"><i className="bi bi-github" aria-hidden="true" /> GitHub <i className="bi bi-arrow-up-right" aria-hidden="true" /></a>
              <a href="https://www.linkedin.com/in/sachinpatel1432/" target="_blank" rel="noreferrer" className="cd-button cd-button-outline"><i className="bi bi-linkedin" aria-hidden="true" /> LinkedIn <i className="bi bi-arrow-up-right" aria-hidden="true" /></a>
            </div>
            <p className="cd-founder-photo-note">Portrait shown is a stock placeholder, not a verified photo of the founder. Replace it with your own approved portrait before public launch.</p>
          </div>
        </div>
      </section>

      {/* PRODUCT JOURNEY / TIMELINE */}
      <section className="cd-section cd-journey-section" id="journey">
        <div className="cd-container">
          <div className="cd-workspace-heading cd-journey-heading">
            <div className="cd-section-heading">
              <span className="cd-section-eyebrow">THE PRODUCT JOURNEY</span>
              <h2>From a simple idea to <span>connected workflows.</span></h2>
              <p>A product timeline without invented launch dates or vanity metrics. These are the main stages of the build, not dated release announcements.</p>
            </div>
            <span className="cd-timeline-badge"><i className="bi bi-signpost-split" aria-hidden="true" /> Build in progress</span>
          </div>
          <div className="cd-timeline">
            {PRODUCT_JOURNEY.map((milestone, index) => (
              <article className="cd-timeline-item" key={milestone.step} style={{ "--cd-card-index": index }}>
                <div className="cd-timeline-marker"><span>{milestone.step}</span><i className={`bi ${milestone.icon}`} aria-hidden="true" /></div>
                <div className="cd-timeline-content">
                  <span className="cd-timeline-phase">{milestone.phase}</span>
                  <h3>{milestone.title}</h3>
                  <p>{milestone.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ROLE-SPECIFIC SUPPORT / CONTACT */}
      <section className="cd-section cd-contact-section" id="contact">
        <div className="cd-container">
          <div className="cd-contact-banner">
            <div className="cd-contact-banner-copy">
              <span className="cd-section-eyebrow cd-section-eyebrow-light">CONTACT & SUPPORT</span>
              <h2>Need help with a <span>specific request?</span></h2>
              <p>Use the right workspace for request-specific help, or send a new enquiry using the form below. Your message is submitted only when the contact API is configured and confirms success.</p>
            </div>
            <div className="cd-contact-banner-icon" aria-hidden="true"><i className="bi bi-headset" /></div>
          </div>
          <div className="cd-contact-grid">
            <article className="cd-contact-card">
              <span className="cd-contact-icon cd-contact-icon-customer"><i className="bi bi-person-lines-fill" aria-hidden="true" /></span>
              <span className="cd-contact-kicker">CUSTOMER SUPPORT</span>
              <h3>Booking, documents or delivery</h3>
              <p>Open My Service Requests to review status, check requested documents, and use the conversation when available.</p>
              <Link to={user?.role === "customer" ? "/my-requests" : "/login"} className="cd-text-link">{user?.role === "customer" ? "Open my requests" : "Sign in for request support"}<i className="bi bi-arrow-right" aria-hidden="true" /></Link>
            </article>
            <article className="cd-contact-card">
              <span className="cd-contact-icon cd-contact-icon-staff"><i className="bi bi-person-gear" aria-hidden="true" /></span>
              <span className="cd-contact-kicker">STAFF SUPPORT</span>
              <h3>Assigned work or document review</h3>
              <p>Invited staff can open their work queue and the conversation attached to the assigned request.</p>
              {user?.role === "staff" ? (
                <Link to="/staff/dashboard" className="cd-text-link">Open staff workspace<i className="bi bi-arrow-right" aria-hidden="true" /></Link>
              ) : user ? (
                <span className="cd-text-link cd-link-disabled">Staff access is invitation-based<i className="bi bi-lock" aria-hidden="true" /></span>
              ) : (
                <Link to="/login" className="cd-text-link">Staff sign-in<i className="bi bi-arrow-right" aria-hidden="true" /></Link>
              )}
            </article>
            <article className="cd-contact-card">
              <span className="cd-contact-icon cd-contact-icon-account"><i className="bi bi-shield-lock" aria-hidden="true" /></span>
              <span className="cd-contact-kicker">ACCOUNT ACCESS</span>
              <h3>Login, profile or security</h3>
              <p>Sign in to update profile details or open account security settings, including password and email options.</p>
              <Link to={user ? "/profile" : "/login"} className="cd-text-link">{user ? "Open my profile" : "Go to login"}<i className="bi bi-arrow-right" aria-hidden="true" /></Link>
            </article>
          </div>
          <div className="cd-contact-form-card">
            <div className="cd-contact-form-intro">
              <span className="cd-section-eyebrow">SEND AN ENQUIRY</span>
              <h3>Tell us what you need help with.</h3>
              <p>Complete the details below. We validate the form in your browser before sending it to your configured backend endpoint.</p>
            </div>
            <form className="cd-contact-form" onSubmit={handleContactSubmit} noValidate>
              <div className="cd-contact-form-grid">
                <label className="cd-form-field">
                  <span>Full name</span>
                  <input name="name" value={contactForm.name} onChange={handleContactChange} autoComplete="name" maxLength={100} required placeholder="Enter your name" />
                </label>
                <label className="cd-form-field">
                  <span>Mobile number</span>
                  <input name="phone" type="tel" value={contactForm.phone} onChange={handleContactChange} autoComplete="tel" inputMode="tel" maxLength={16} required placeholder="10-digit mobile number" />
                </label>
                <label className="cd-form-field cd-form-field-full">
                  <span>Service inquiry</span>
                  <select name="service" value={contactForm.service} onChange={handleContactChange} required>
                    <option value="">Choose a service</option>
                    {SERVICES.map((service) => <option value={service.title} key={service.title}>{service.title}</option>)}
                    <option value="Other inquiry">Other inquiry</option>
                  </select>
                </label>
                <label className="cd-form-field cd-form-field-full">
                  <span>How can we help?</span>
                  <textarea name="message" value={contactForm.message} onChange={handleContactChange} minLength={10} maxLength={1200} rows={5} required placeholder="Briefly describe the help you need (10–1200 characters)." />
                  <small className="cd-form-character-count">{contactForm.message.length}/1200</small>
                </label>
              </div>
              {contactStatus.message && <div className={`cd-contact-notice cd-contact-notice-${contactStatus.kind}`} role={contactStatus.kind === "error" ? "alert" : "status"}><i className={`bi ${contactStatus.kind === "success" ? "bi-check-circle-fill" : contactStatus.kind === "error" ? "bi-exclamation-circle-fill" : "bi-info-circle-fill"}`} aria-hidden="true" /> {contactStatus.message}</div>}
              <div className="cd-contact-submit-row">
                <button type="submit" className="cd-button cd-button-primary" disabled={contactSubmitting}>
                  {contactSubmitting ? "Sending…" : "Submit enquiry"}
                  <i className={`bi ${contactSubmitting ? "bi-arrow-repeat cd-spin" : "bi-arrow-up-right"}`} aria-hidden="true" />
                </button>
                <span><i className="bi bi-shield-lock" aria-hidden="true" /> Your form is sent to the configured backend only.</span>
              </div>
            </form>
          </div>
          <p className="cd-contact-safety"><i className="bi bi-shield-check" aria-hidden="true" /> Never share your password or one-time verification codes with anyone. Use official government portals for final submissions and decisions.</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="cd-section cd-faq-section" id="faq">
        <div className="cd-container cd-faq-layout">
          <div className="cd-section-heading">
            <span className="cd-section-eyebrow">GOOD TO KNOW</span>
            <h2>Questions, <span>answered.</span></h2>
            <p>
              A few useful details to help you get started with CyberDesk.
            </p>
            <div className="cd-faq-help-card">
              <span className="cd-faq-help-icon"><i className="bi bi-headset" /></span>
              <span><strong>Need a hand?</strong><small>Sign in to view the options available for your request.</small></span>
            </div>
          </div>

          <div className="cd-faq-list">
            {FAQS.map((faq, index) => (
              <details className="cd-faq-item" key={faq.question} open={index === 0}>
                <summary>
                  <span>{faq.question}</span>
                  <i className="bi bi-plus-lg" aria-hidden="true" />
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="cd-final-cta-section" id="final-cta">
        <div className="cd-container">
          <div className="cd-final-cta">
            <div className="cd-cta-shape cd-cta-shape-one" aria-hidden="true" />
            <div className="cd-cta-shape cd-cta-shape-two" aria-hidden="true" />
            <div className="cd-final-cta-content">
              <span className="cd-section-eyebrow cd-section-eyebrow-light">YOUR NEXT STEP STARTS HERE</span>
              <h2>Ready to make your digital work <span>simpler?</span></h2>
              <p>
                Explore available services, create a request and keep your next steps
                organised with CyberDesk.
              </p>
              <div className="cd-final-cta-actions">
                {!initializing && (
                  <Link to={mainActionPath} className="cd-button cd-button-white">
                    {mainActionLabel}
                    <i className="bi bi-arrow-up-right" aria-hidden="true" />
                  </Link>
                )}
                <Link to="/services" className="cd-button cd-button-cta-ghost">
                  Browse services
                  <i className="bi bi-arrow-right" aria-hidden="true" />
                </Link>
              </div>
              <div className="cd-cta-footnote"><i className="bi bi-info-circle" /> Service availability and processing steps may vary by request.</div>
            </div>
          </div>
        </div>
      </section>

      {activeProject && (
        <div className="cd-project-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveProject(null); }}>
          <section className="cd-project-modal" role="dialog" aria-modal="true" aria-labelledby="cd-project-modal-title">
            <button type="button" className="cd-project-modal-close" onClick={() => setActiveProject(null)} aria-label="Close project preview"><i className="bi bi-x-lg" aria-hidden="true" /></button>
            <div className="cd-project-modal-art"><i className={`bi ${activeProject.icon}`} aria-hidden="true" /><span>INTERACTIVE PROJECT PREVIEW</span></div>
            <span className="cd-section-eyebrow">{activeProject.eyebrow}</span>
            <h2 id="cd-project-modal-title">{activeProject.title}</h2>
            <p>{activeProject.previewSummary || activeProject.description}</p>
            <div className="cd-project-tags cd-project-modal-tags">{activeProject.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            <ul className="cd-project-modal-list">{(activeProject.previewBullets || []).map((item) => <li key={item}><i className="bi bi-check2-circle" aria-hidden="true" />{item}</li>)}</ul>
            <div className="cd-project-modal-actions">
              {activeProject.audience === "live" ? (
                <Link to={activeProject.link} className="cd-button cd-button-primary" onClick={() => setActiveProject(null)}>Open live service catalogue <i className="bi bi-arrow-up-right" aria-hidden="true" /></Link>
              ) : (
                <a href="https://github.com/sachinpatel1432" target="_blank" rel="noreferrer" className="cd-button cd-button-primary">Browse GitHub profile <i className="bi bi-arrow-up-right" aria-hidden="true" /></a>
              )}
              <button type="button" className="cd-button cd-button-glass cd-project-modal-cancel" onClick={() => setActiveProject(null)}>Close preview</button>
            </div>
            <p className="cd-project-modal-note"><i className="bi bi-info-circle" aria-hidden="true" /> This is a portfolio preview, not an external deployment or third-party client case study.</p>
          </section>
        </div>
      )}
    </main>
  );
}

export default Home;
