import { Link } from "react-router-dom";
import "../styles/not-found.css";

export default function NotFound() {
  return (
    <main className="cd-not-found">
      <div className="cd-not-found-grid" aria-hidden="true" />
      <section className="cd-not-found-content">
        <Link to="/" className="cd-not-found-brand"><span className="cd-not-found-mark"><i className="bi bi-pc-display-horizontal" /></span><span>Cyber<span>Desk</span></span></Link>
        <div className="cd-not-found-visual" aria-hidden="true">
          <span className="cd-not-found-orbit cd-not-found-orbit-a" />
          <span className="cd-not-found-orbit cd-not-found-orbit-b" />
          <span className="cd-not-found-number">404</span>
          <span className="cd-not-found-floating cd-float-one"><i className="bi bi-file-earmark" /></span>
          <span className="cd-not-found-floating cd-float-two"><i className="bi bi-search" /></span>
          <span className="cd-not-found-floating cd-float-three"><i className="bi bi-compass" /></span>
        </div>
        <span className="cd-not-found-eyebrow">PAGE NOT FOUND</span>
        <h1>This page took a wrong turn.</h1>
        <p>The link may be outdated, the page may have moved, or the address may contain a typo.</p>
        <div className="cd-not-found-actions">
          <Link to="/" className="cd-not-found-primary"><i className="bi bi-house-door" /> Back to home</Link>
          <Link to="/services" className="cd-not-found-secondary"><i className="bi bi-grid" /> Browse services</Link>
        </div>
        <div className="cd-not-found-help"><i className="bi bi-lightbulb" /> Try opening a page from the main navigation.</div>
        <footer>© {new Date().getFullYear()} CyberDesk <span>·</span> Digital services made simpler</footer>
      </section>
    </main>
  );
}
