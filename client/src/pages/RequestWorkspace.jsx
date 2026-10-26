import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getErrorMessage } from "../services/api";
import PushNotificationSettings from "../components/PushNotificationSettings";
import {
  getRequestMessages,
  sendRequestMessage,
  markRequestMessagesRead,
  getRequestActivity,
} from "../services/requestConversationService";

const formatDateTime = (value) => {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const getDisplayName = (person) => {
  if (!person) return "Unknown user";

  if (typeof person === "string") return person;

  return (
    person.fullName ||
    person.name ||
    person.email ||
    person.username ||
    "User"
  );
};

const getRoleLabel = (role) => {
  const labels = {
    customer: "Customer",
    staff: "Staff",
    admin: "Admin",
  };

  return labels[role] || role || "Member";
};

const getErrorText = (error) => {
  return getErrorMessage(error);
};

export default function RequestWorkspace() {
  const { requestId } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [activity, setActivity] = useState([]);
  const [request, setRequest] = useState(null);
  const [messageText, setMessageText] = useState("");

  const [activeTab, setActiveTab] = useState("chat");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const requestNumber = useMemo(() => {
    return request?.requestNumber || request?._id || requestId;
  }, [request, requestId]);

  const messagesEndRef = useRef(null);
  const lastMessageCountRef = useRef(0);

  // Keep the newest message in view when a message is added, not on every poll.
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
    lastMessageCountRef.current = messages.length;
  }, [messages.length]);

  const loadWorkspace = useCallback(
    async ({ showLoader = true } = {}) => {
      if (!requestId) {
        setError("Request ID is missing.");
        setLoading(false);
        return;
      }

      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");
      setNotice("");

      try {
        const results = await Promise.allSettled([
          getRequestMessages(requestId, {
            page: 1,
            limit: 50,
          }),
          getRequestActivity(requestId),
        ]);

        const messagesResult = results[0];
        const activityResult = results[1];

        let succeeded = false;

        if (messagesResult.status === "fulfilled") {
          const response = messagesResult.value;

          setMessages(
            Array.isArray(response?.messages) ? response.messages : []
          );

          setRequest((previous) => ({
            ...(previous || {}),
            ...(response?.request || {}),
          }));

          succeeded = true;

          try {
            await markRequestMessagesRead(requestId);
          } catch (readError) {
            // The conversation remains usable if marking messages read fails.
            console.warn("Unable to mark messages as read:", readError);
          }
        }

        if (activityResult.status === "fulfilled") {
          const response = activityResult.value;

          setActivity(
            Array.isArray(response?.activity) ? response.activity : []
          );

          setRequest((previous) => ({
            ...(previous || {}),
            ...(response?.request || {}),
          }));

          succeeded = true;
        }

        if (!succeeded) {
          const messagesError = messagesResult.reason;

          setError(getErrorText(messagesError));
        } else if (
          messagesResult.status === "rejected" &&
          activityResult.status === "fulfilled"
        ) {
          setError(
            "Activity loaded, but messages could not be loaded. Refresh to try again."
          );
        } else if (
          activityResult.status === "rejected" &&
          messagesResult.status === "fulfilled"
        ) {
          setError(
            "Messages loaded, but activity could not be loaded. Refresh to try again."
          );
        }
      } catch (loadError) {
        setError(getErrorText(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [requestId]
  );

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  // Near-live updates: refresh messages and activity every 3 seconds.
  // Pauses while the browser tab is hidden to avoid unnecessary requests.
  const isSyncingRef = useRef(false);

  useEffect(() => {
    let isActive = true;

    const syncWorkspaceInBackground = async () => {
      if (
        !isActive ||
        document.visibilityState !== "visible" ||
        isSyncingRef.current
      ) {
        return;
      }

      isSyncingRef.current = true;

      try {
        const [messagesResult, activityResult] = await Promise.allSettled([
          getRequestMessages(requestId, { page: 1, limit: 50 }),
          getRequestActivity(requestId),
        ]);

        if (!isActive) return;

        if (messagesResult.status === "fulfilled") {
          const response = messagesResult.value;

          setMessages(
            Array.isArray(response?.messages) ? response.messages : []
          );

          if (response?.request) {
            setRequest((previous) => ({
              ...(previous || {}),
              ...response.request,
            }));
          }

          if (activeTab === "chat" && Number(response?.unreadCount) > 0) {
            markRequestMessagesRead(requestId).catch((readError) => {
              console.warn("Unable to mark messages as read:", readError);
            });
          }
        }

        if (activityResult.status === "fulfilled") {
          const response = activityResult.value;

          setActivity(
            Array.isArray(response?.activity) ? response.activity : []
          );

          if (response?.request) {
            setRequest((previous) => ({
              ...(previous || {}),
              ...response.request,
            }));
          }
        }
      } catch (syncError) {
        // Keep the current UI usable; the next interval will retry.
        console.warn("Background workspace sync failed:", syncError);
      } finally {
        isSyncingRef.current = false;
      }
    };

    const intervalId = window.setInterval(syncWorkspaceInBackground, 3000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncWorkspaceInBackground();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", syncWorkspaceInBackground);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      window.removeEventListener("focus", syncWorkspaceInBackground);
    };
  }, [requestId, activeTab]);

  const handleSendMessage = async (event) => {
    event.preventDefault();

    const trimmedMessage = messageText.trim();

    if (!trimmedMessage) {
      setNotice("Please enter a message.");
      return;
    }

    if (trimmedMessage.length > 2000) {
      setNotice("Message cannot exceed 2000 characters.");
      return;
    }

    setSending(true);
    setError("");
    setNotice("");

    try {
      await sendRequestMessage(requestId, trimmedMessage);

      setMessageText("");
      setNotice("Message sent successfully.");

      await loadWorkspace({ showLoader: false });
    } catch (sendError) {
      setError(getErrorText(sendError));
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = async () => {
    await loadWorkspace({ showLoader: false });
  };

  const handleMessageKeyDown = (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const renderMessage = (item, index) => {
    const sender = item.sender;
    const senderName = getDisplayName(sender);
    const rawRole = item.senderRole || sender?.role || "member";
    const senderRole = getRoleLabel(rawRole);
    const roleKey = String(rawRole).toLowerCase();
    // Customer/support sides stay consistent across both users' views.
    const isSupportMessage = roleKey === "staff" || roleKey === "admin";
    const initials = senderName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";

    return (
      <div
        className={`cw-message-row ${isSupportMessage ? "cw-message-support" : "cw-message-customer"}`}
        key={item._id || item.id || `${item.createdAt}-${index}`}
      >
        {!isSupportMessage && (
          <div className="cw-avatar cw-avatar-customer" aria-hidden="true">
            {initials}
          </div>
        )}

        <div className="cw-message-stack">
          <div className={`cw-message-meta ${isSupportMessage ? "cw-meta-right" : ""}`}>
            <span className="cw-sender-name">{senderName}</span>
            <span className={`cw-role-chip ${isSupportMessage ? "cw-role-support" : "cw-role-customer"}`}>
              {senderRole}
            </span>
          </div>

          <div className={`cw-bubble ${isSupportMessage ? "cw-bubble-support" : "cw-bubble-customer"}`}>
            <div className="cw-message-text">{item.message || ""}</div>
            <div className={`cw-message-time ${isSupportMessage ? "cw-time-light" : ""}`}>
              {formatDateTime(item.createdAt)}
              {item.editedAt ? " · edited" : ""}
            </div>
          </div>
        </div>

        {isSupportMessage && (
          <div className="cw-avatar cw-avatar-support" aria-hidden="true">
            {initials}
          </div>
        )}
      </div>
    );
  };

  const renderActivity = (item, index) => {
    const actor =
      item.actor ||
      item.updatedBy ||
      item.staff ||
      item.performedBy;

    return (
      <div
        className="d-flex gap-3 pb-4"
        key={item.id || item._id || `${item.timestamp}-${index}`}
      >
        <div className="flex-shrink-0">
          <span
            className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary-subtle text-primary fw-bold"
            style={{ width: 38, height: 38 }}
          >
            •
          </span>
        </div>

        <div className="flex-grow-1 border-bottom pb-3">
          <div className="fw-semibold text-dark">
            {item.title || item.type || "Request activity"}
          </div>

          {item.description && (
            <p className="text-secondary mb-2 mt-1">
              {item.description}
            </p>
          )}

          {item.status && (
            <span className="badge text-bg-light border me-2">
              {String(item.status).replaceAll("_", " ")}
            </span>
          )}

          {actor && (
            <small className="text-secondary d-block mt-2">
              By: {getDisplayName(actor)}
            </small>
          )}

          <small className="text-secondary d-block mt-2">
            {formatDateTime(item.timestamp || item.createdAt)}
          </small>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <main className="cw-page cw-page-loading py-4">
        <div className="cw-loading-card text-center">
          <div className="spinner-border text-primary" role="status" aria-label="Loading conversation" />
          <p className="text-secondary mt-3 mb-0">Loading your conversation...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="cw-page py-4 py-lg-5">
      <style>{`
        .cw-page { --cw-ink:#162033; --cw-muted:#718096; --cw-line:#e5eaf2; --cw-blue:#315efb; color:var(--cw-ink); width:min(calc(100% - 24px), 530px); margin-inline:auto; }
        .cw-page-loading { max-width:560px; }
        .cw-page .cw-back { border:1px solid var(--cw-line); background:#fff; border-radius:11px; padding:8px 11px; font-weight:700; color:#46536a; font-size:.82rem; white-space:nowrap; }
        .cw-page .cw-back:hover { background:#f7f9fc; }
        .cw-refresh-button { font-size:.78rem; padding:8px 11px; white-space:nowrap; }
        .cw-refresh-button:disabled { opacity:.7; }
        .cw-topbar { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; max-width:470px; margin:0 auto 14px; }
        .cw-eyebrow { color:#536b9c; font-size:.66rem; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
        .cw-title { font-size:clamp(1.2rem,2.3vw,1.55rem); font-weight:850; letter-spacing:-.035em; margin:5px 0 3px; }
        .cw-subtitle { color:var(--cw-muted); margin:0; font-size:.8rem; line-height:1.4; }
        .cw-shell { width:100%; max-width:470px; height:min(68vh, 650px); min-height:490px; margin:0 auto; display:flex; flex-direction:column; border:1px solid #e4e9f2; border-radius:24px; background:#fff; box-shadow:0 22px 58px rgba(28,47,85,.13), 0 3px 12px rgba(28,47,85,.04); overflow:hidden; }
        .cw-conversation-header { display:flex; align-items:center; gap:11px; padding:14px 17px; background:radial-gradient(circle at 100% 0%,rgba(81,119,255,.35),transparent 42%),linear-gradient(120deg,#14213b,#263f70); color:#fff; flex:0 0 auto; }
        .cw-header-icon { height:40px; width:40px; flex:0 0 40px; display:grid; place-items:center; border-radius:14px; background:rgba(255,255,255,.13); border:1px solid rgba(255,255,255,.12); font-size:1.2rem; }
        .cw-header-name { font-size:.9rem; font-weight:800; margin:0 0 3px; }
        .cw-live-line { display:flex; align-items:center; gap:7px; color:#d5e2ff; font-size:.72rem; margin:0; }
        .cw-live-dot { width:7px; height:7px; border-radius:50%; display:inline-block; background:#51dfa1; box-shadow:0 0 0 4px rgba(81,223,161,.13); }
        .cw-header-side { margin-left:auto; text-align:right; }
        .cw-request-id { color:#d5e2ff; font-size:.65rem; margin-bottom:5px; white-space:nowrap; }
        .cw-status-pill { display:inline-flex; padding:4px 8px; border-radius:99px; background:rgba(255,255,255,.12); color:#fff; font-size:.68rem; font-weight:750; text-transform:capitalize; }
        .cw-tabs-wrap { display:flex; gap:6px; padding:9px 13px; border-bottom:1px solid var(--cw-line); background:#fff; flex:0 0 auto; }
        .cw-tab { display:inline-flex; align-items:center; gap:7px; border:0; border-radius:10px; padding:8px 11px; color:#69758a; background:transparent; font-weight:750; font-size:.78rem; transition:background .18s,color .18s; }
        .cw-tab-active { background:#edf2ff; color:#315efb; }
        .cw-count { border-radius:99px; padding:2px 7px; background:rgba(49,94,251,.09); font-size:.73rem; }
        .cw-chat-area { background:linear-gradient(180deg,#f7f9fd,#f3f6fb); padding:15px 14px 5px; flex:1 1 auto; height:auto; min-height:0; overflow-y:auto; overscroll-behavior:contain; scroll-behavior:smooth; }
        .cw-chat-date { display:flex; justify-content:center; margin:2px 0 22px; }
        .cw-chat-date span { color:#77839a; background:#e9eef7; border-radius:99px; padding:5px 11px; font-size:.72rem; font-weight:700; }
        .cw-message-row { display:flex; align-items:flex-end; gap:8px; margin-bottom:15px; animation:cw-rise .18s ease-out; }
        .cw-message-customer { justify-content:flex-start; }
        .cw-message-support { justify-content:flex-end; }
        .cw-avatar { width:29px; height:29px; border-radius:10px; flex:0 0 29px; display:grid; place-items:center; font-size:.65rem; font-weight:850; }
        .cw-avatar-customer { background:#dfe7f6; color:#3a4c70; }
        .cw-avatar-support { background:#315efb; color:#fff; }
        .cw-message-stack { max-width:min(82%,450px); min-width:0; }
        .cw-message-meta { display:flex; align-items:center; gap:7px; flex-wrap:wrap; margin:0 0 6px 3px; }
        .cw-meta-right { justify-content:flex-end; margin:0 3px 6px 0; }
        .cw-sender-name { color:#46536a; font-size:.7rem; font-weight:800; }
        .cw-role-chip { border-radius:99px; padding:2px 7px; font-size:.65rem; font-weight:750; }
        .cw-role-customer { color:#576985; background:#e5ebf5; }
        .cw-role-support { color:#315efb; background:#e4eaff; }
        .cw-bubble { padding:9px 11px 7px; border-radius:15px; box-shadow:0 3px 10px rgba(33,49,79,.045); overflow-wrap:anywhere; }
        .cw-bubble-customer { background:#fff; border:1px solid #e6ebf3; border-bottom-left-radius:5px; color:#273449; }
        .cw-bubble-support { background:linear-gradient(135deg,#3564fa,#2852e4); color:#fff; border-bottom-right-radius:5px; }
        .cw-message-text { white-space:pre-wrap; font-size:.82rem; line-height:1.5; }
        .cw-message-time { margin-top:5px; text-align:right; color:#8792a6; font-size:.61rem; }
        .cw-time-light { color:rgba(255,255,255,.76); }
        .cw-empty-chat { display:flex; min-height:210px; align-items:center; justify-content:center; text-align:center; padding:20px 10px; }
        .cw-empty-icon { display:grid; place-items:center; width:52px; height:52px; border-radius:17px; background:#e8eeff; color:#315efb; font-size:1.45rem; margin:0 auto 12px; }
        .cw-composer-wrap { padding:11px 13px 12px; background:#fff; border-top:1px solid var(--cw-line); flex:0 0 auto; }
        .cw-composer { display:flex; align-items:flex-end; gap:8px; border:1px solid #dfe5ef; background:#f9fbfe; border-radius:15px; padding:7px 8px 7px 12px; transition:border-color .15s,box-shadow .15s; }
        .cw-composer:focus-within { border-color:#99afff; box-shadow:0 0 0 4px rgba(49,94,251,.08); }
        .cw-textarea { border:0!important; box-shadow:none!important; background:transparent!important; resize:none; min-height:38px; max-height:90px; padding:8px 0!important; color:#243047; font-size:.83rem; }
        .cw-send { flex:0 0 auto; height:38px; border:0; border-radius:12px; padding:0 13px; background:linear-gradient(135deg,#4773ff,#3155e9); color:white; font-size:.78rem; font-weight:800; box-shadow:0 5px 12px rgba(49,94,251,.2); transition:transform .18s,box-shadow .18s; }
        .cw-send:hover:not(:disabled) { background:#254ce0; transform:translateY(-1px); }
        .cw-send:disabled { opacity:.55; box-shadow:none; }
        .cw-composer-foot { display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap; color:#8a95a8; font-size:.64rem; margin:6px 3px 0; }
        .cw-activity-area { padding:17px 16px; background:#fff; flex:1 1 auto; min-height:0; overflow-y:auto; }
        .cw-activity-heading { font-weight:800; margin:0 0 5px; }
        .cw-activity-event { display:flex; gap:11px; padding:11px 0; }
        .cw-activity-icon { width:36px; height:36px; flex:0 0 36px; display:grid; place-items:center; border-radius:12px; background:#edf2ff; color:#315efb; font-weight:800; }
        .cw-activity-body { flex:1; min-width:0; border-bottom:1px solid #edf0f5; padding:0 0 15px; }
        .cw-notice { border-radius:12px; }
        .cw-loading-card { max-width:430px; margin:48px auto; padding:35px 18px; background:white; border:1px solid #e7ebf3; border-radius:22px; box-shadow:0 18px 50px rgba(28,47,85,.08); }
        @keyframes cw-rise { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width:576px) { .cw-page { width:calc(100% - 18px); padding-top:.65rem!important; } .cw-topbar { align-items:flex-start; gap:8px; margin-bottom:10px; } .cw-topbar > div { min-width:0; } .cw-topbar .d-flex.align-items-start { gap:8px!important; } .cw-page .cw-back { padding:7px 8px; font-size:.75rem; } .cw-title { font-size:1.15rem; } .cw-subtitle { max-width:270px; font-size:.73rem; } .cw-shell { height:min(70dvh, 610px); min-height:430px; border-radius:20px; } .cw-conversation-header { padding:12px; gap:9px; } .cw-header-icon { width:36px; height:36px; flex-basis:36px; border-radius:12px; } .cw-header-name { font-size:.82rem; } .cw-live-line { font-size:.65rem; } .cw-header-side { margin-left:auto; text-align:right; width:auto; } .cw-request-id { font-size:.58rem; } .cw-status-pill { font-size:.62rem; } .cw-message-stack { max-width:85%; } .cw-chat-area { padding:12px 10px 4px; } .cw-send { width:38px; padding:0; font-size:0; } .cw-send i { font-size:1rem; } .cw-tabs-wrap { padding:8px 10px; } .cw-tab { padding:8px 10px; font-size:.75rem; } .cw-composer-wrap { padding:9px 10px 10px; } .cw-composer-foot { font-size:.59rem; } }
        @media (max-width:360px) { .cw-live-line { max-width:170px; } .cw-header-side { max-width:105px; overflow:hidden; } .cw-request-id { overflow:hidden; text-overflow:ellipsis; } .cw-composer-foot span:first-child { max-width:58%; } }
      `}</style>

      <div className="cw-topbar">
        <div className="d-flex align-items-start gap-3">
          <button type="button" className="cw-back" onClick={() => navigate(-1)}>
            <i className="bi bi-arrow-left me-2" aria-hidden="true" />Back
          </button>
          <div>
            <div className="cw-eyebrow">CyberDesk · Help Center</div>
            <h1 className="cw-title">Request conversation</h1>
            <p className="cw-subtitle">Discuss this service request with the other participant.</p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-light border rounded-3 fw-semibold cw-refresh-button"
          onClick={handleRefresh}
          disabled={refreshing || sending}
        >
          <i className={`bi ${refreshing ? "bi-arrow-repeat" : "bi-arrow-clockwise"} me-2`} aria-hidden="true" />
          {refreshing ? "Syncing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger cw-notice d-flex justify-content-between gap-3" role="alert">
          <span>{error}</span>
          <button type="button" className="btn-close" aria-label="Dismiss error" onClick={() => setError("")} />
        </div>
      )}
      {notice && (
        <div className="alert alert-info cw-notice d-flex justify-content-between gap-3" role="status">
          <span>{notice}</span>
          <button type="button" className="btn-close" aria-label="Dismiss notice" onClick={() => setNotice("")} />
        </div>
      )}

      {/* Enable browser push so new request messages can notify you even when this tab is closed. */}
      <PushNotificationSettings />

      <section className="cw-shell" aria-label="Request conversation workspace">
        <header className="cw-conversation-header">
          <div className="cw-header-icon"><i className="bi bi-chat-square-text" aria-hidden="true" /></div>
          <div>
            <p className="cw-header-name">Service Request Support</p>
            <p className="cw-live-line"><span className="cw-live-dot" /> Updates automatically every few seconds</p>
          </div>
          <div className="cw-header-side">
            <div className="cw-request-id">REQUEST · {requestNumber}</div>
            {request?.status && <span className="cw-status-pill">{String(request.status).replaceAll("_", " ")}</span>}
          </div>
        </header>

        <nav className="cw-tabs-wrap" aria-label="Request workspace sections">
          <button type="button" className={`cw-tab ${activeTab === "chat" ? "cw-tab-active" : ""}`} onClick={() => setActiveTab("chat")}>
            <i className="bi bi-chat-dots" aria-hidden="true" /> Conversation <span className="cw-count">{messages.length}</span>
          </button>
          <button type="button" className={`cw-tab ${activeTab === "activity" ? "cw-tab-active" : ""}`} onClick={() => setActiveTab("activity")}>
            <i className="bi bi-clock-history" aria-hidden="true" /> Activity <span className="cw-count">{activity.length}</span>
          </button>
        </nav>

        {activeTab === "chat" && (
          <>
            <div className="cw-chat-area" role="log" aria-label="Conversation messages" aria-live="polite">
              <div className="cw-chat-date"><span>Request #{requestNumber}</span></div>
              {messages.length === 0 ? (
                <div className="cw-empty-chat">
                  <div>
                    <div className="cw-empty-icon"><i className="bi bi-chat-heart" aria-hidden="true" /></div>
                    <h2 className="h5 fw-bold">Start the conversation</h2>
                    <p className="text-secondary mb-0">Send a message about this request. Your replies will appear here.</p>
                  </div>
                </div>
              ) : (
                messages.map(renderMessage)
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="cw-composer-wrap">
              <form onSubmit={handleSendMessage}>
                <label htmlFor="requestMessage" className="visually-hidden">Write a message</label>
                <div className="cw-composer">
                  <textarea
                    id="requestMessage"
                    className="form-control cw-textarea"
                    rows={2}
                    maxLength={2000}
                    placeholder="Write your message…"
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    onKeyDown={handleMessageKeyDown}
                    disabled={sending}
                    required
                  />
                  <button type="submit" className="cw-send" disabled={sending || !messageText.trim()} aria-label="Send message">
                    {sending ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : <><i className="bi bi-send-fill me-sm-2" aria-hidden="true" />Send</>}
                  </button>
                </div>
                <div className="cw-composer-foot">
                  <span><i className="bi bi-shield-check me-1" aria-hidden="true" />Keep messages related to this request.</span>
                  <span>{messageText.length}/2000 · Ctrl/⌘ + Enter to send</span>
                </div>
              </form>
            </div>
          </>
        )}

        {activeTab === "activity" && (
          <div className="cw-activity-area">
            <h2 className="cw-activity-heading h5">Request activity</h2>
            <p className="text-secondary small mb-3">A timeline of changes and updates for this request.</p>
            {activity.length === 0 ? (
              <div className="cw-empty-chat">
                <div>
                  <div className="cw-empty-icon"><i className="bi bi-clock-history" aria-hidden="true" /></div>
                  <h3 className="h6 fw-bold">Nothing to show yet</h3>
                  <p className="text-secondary mb-0">New request updates will appear here.</p>
                </div>
              </div>
            ) : (
              activity.map((item, index) => {
                const actor = item.actor || item.updatedBy || item.staff || item.performedBy;
                return (
                  <div className="cw-activity-event" key={item.id || item._id || `${item.timestamp}-${index}`}>
                    <div className="cw-activity-icon"><i className="bi bi-check2" aria-hidden="true" /></div>
                    <div className="cw-activity-body">
                      <div className="fw-bold">{item.title || item.type || "Request activity"}</div>
                      {item.description && <p className="text-secondary mt-1 mb-2">{item.description}</p>}
                      {item.status && <span className="badge text-bg-light border me-2">{String(item.status).replaceAll("_", " ")}</span>}
                      {actor && <div className="small text-secondary mt-2">By {getDisplayName(actor)}</div>}
                      <div className="small text-secondary mt-2">{formatDateTime(item.timestamp || item.createdAt)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>
      <p className="text-secondary small mt-3 mb-0"><i className="bi bi-info-circle me-1" aria-hidden="true" />This conversation is linked to the selected service request.</p>
    </main>
  );
}
