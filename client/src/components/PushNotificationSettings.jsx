import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  disablePushNotifications,
  enablePushNotifications,
  getPushNotificationStatus,
} from "../services/pushNotificationService";

export default function PushNotificationSettings() {
  const [supported, setSupported] = useState(true);

  const [enabled, setEnabled] = useState(false);

  const [permission, setPermission] = useState("default");

  const [busy, setBusy] = useState(false);

  const [feedback, setFeedback] = useState("");

  const [isError, setIsError] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await getPushNotificationStatus();

      setSupported(status.supported);
      setEnabled(status.enabled);
      setPermission(status.permission);
    } catch {
      setSupported(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleToggle = async () => {
    setBusy(true);
    setFeedback("");
    setIsError(false);

    try {
      if (enabled) {
        await disablePushNotifications();

        setEnabled(false);

        setFeedback(
          "Push notifications disabled on this browser."
        );
      } else {
        await enablePushNotifications();

        setEnabled(true);
        setPermission("granted");

        setFeedback(
          "Notifications enabled. New request messages can reach this browser while the website tab is closed."
        );
      }
    } catch (error) {
      setIsError(true);

      setFeedback(
        error?.response?.data?.message ||
          error?.message ||
          "Notification settings could not be updated."
      );

      await refreshStatus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card border-0 shadow-sm mb-4">
      <div className="card-body d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-2">
            <span
              className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary-subtle text-primary"
              style={{
                width: 42,
                height: 42,
              }}
              aria-hidden="true"
            >
              <i className="bi bi-bell fs-5" />
            </span>

            <h2 className="h6 fw-bold mb-0">
              Chat Push Notifications
            </h2>
          </div>

          <p className="text-secondary small mb-0">
            Get a browser notification when someone sends a
            message about your request, even when this website
            tab is closed.
          </p>

          {!supported && (
            <p className="text-danger small mt-2 mb-0">
              This browser or connection does not support push
              notifications. Use a supported browser over HTTPS
              or localhost during development.
            </p>
          )}

          {supported && permission === "denied" && (
            <p className="text-warning small mt-2 mb-0">
              Notifications are blocked in browser settings.
              Allow them for this site before enabling push.
            </p>
          )}

          {feedback && (
            <p
              className={`${
                isError ? "text-danger" : "text-success"
              } small mt-2 mb-0`}
              role="status"
            >
              {feedback}
            </p>
          )}
        </div>

        <button
          type="button"
          className={`btn ${
            enabled
              ? "btn-outline-danger"
              : "btn-primary"
          } flex-shrink-0`}
          onClick={handleToggle}
          disabled={!supported || busy}
        >
          {busy
            ? "Please wait..."
            : enabled
              ? "Disable Notifications"
              : "Enable Notifications"}
        </button>
      </div>
    </section>
  );
}