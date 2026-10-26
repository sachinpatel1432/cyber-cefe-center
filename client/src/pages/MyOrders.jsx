import { Link } from "react-router-dom";
import "../styles/my-orders.css";

export default function MyOrders() {
  return (
    <section className="customer-overview cd-orders-panel" aria-labelledby="cd-orders-title">
      <div className="overview-section-heading cd-orders-heading">
        <div>
          <span className="cd-orders-eyebrow">CUSTOMER WORKSPACE</span>
          <h2 id="cd-orders-title">My Orders</h2>
          <p>Keep track of service bookings, documents and delivery progress.</p>
        </div>
        <Link to="/my-requests" className="cd-orders-heading-link">
          View requests <i className="bi bi-arrow-up-right" aria-hidden="true" />
        </Link>
      </div>

      <div className="cd-orders-empty-state">
        <div className="cd-orders-illustration" aria-hidden="true">
          <span className="cd-orders-orbit cd-orders-orbit-one" />
          <span className="cd-orders-orbit cd-orders-orbit-two" />
          <div className="cd-orders-document"><i className="bi bi-clipboard2-check" /></div>
          <span className="cd-orders-spark cd-orders-spark-one"><i className="bi bi-check-lg" /></span>
          <span className="cd-orders-spark cd-orders-spark-two"><i className="bi bi-stars" /></span>
        </div>
        <span className="cd-orders-status-pill"><i className="bi bi-info-circle" /> Booking workspace</span>
        <h3>Your service requests, all in one place</h3>
        <p>Open My Service Requests to view booking status, upload documents, review staff feedback and access available digital deliverables.</p>
        <div className="cd-orders-actions">
          <Link to="/my-requests" className="cd-orders-primary"><i className="bi bi-clipboard-check" /> Open My Service Requests</Link>
          <Link to="/services" className="cd-orders-secondary"><i className="bi bi-grid" /> Explore services</Link>
        </div>
        <div className="cd-orders-feature-row">
          <span><i className="bi bi-check2-circle" /> Track status</span>
          <span><i className="bi bi-file-earmark-arrow-up" /> Upload documents</span>
          <span><i className="bi bi-download" /> Access deliverables</span>
        </div>
      </div>
    </section>
  );
}
