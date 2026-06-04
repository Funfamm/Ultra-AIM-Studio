import Link from "next/link";
import "./footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container-app">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="footer-logo">AIM<span>Studio</span></span>
            <p className="footer-tagline">
              Cinema about sacrifice, regret, and the people we refuse to look away from.
            </p>
          </div>
          <nav className="footer-links">
            <Link href="/works">Works</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/login">Sign In</Link>
          </nav>
        </div>
        <div className="footer-bottom">
          <span className="footer-motto">DON&apos;T LOOK AWAY.</span>
          <span className="footer-copy">© {new Date().getFullYear()} AIM Studio · All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
