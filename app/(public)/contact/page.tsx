"use client";

import "./contact.css";

// Metadata moved to layout.tsx

export default function ContactPage() {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const subject = formData.get("subject") as string;
    const body = `Name: ${formData.get("name")}\nEmail: ${formData.get("email")}\n\nMessage:\n${formData.get("message")}`;
    
    const mailtoLink = `mailto:hello@impactaistudio.com?subject=Contact Form: ${subject || "General Inquiry"}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  };

  return (
    <main className="contact-page">
      <div className="container-app">

        <div className="contact-header">
          <span className="contact-eyebrow">— Get in Touch</span>
          <h1 className="contact-title">Get in Touch</h1>
          <p className="contact-subtitle">
            For partnerships, press, casting, or just to say hi.
          </p>
          <p className="contact-intro">
            We read every message. We can&apos;t always reply immediately,
            but if your message matters &mdash; we&apos;ll see it.
          </p>
        </div>

        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="cf-name" className="form-label">Name</label>
              <input
                id="cf-name"
                type="text"
                name="name"
                className="form-input"
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="cf-email" className="form-label">Email</label>
              <input
                id="cf-email"
                type="email"
                name="email"
                className="form-input"
                placeholder="your@email.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="cf-subject" className="form-label">What&apos;s this about?</label>
            <select id="cf-subject" name="subject" className="form-select">
              <option value="">Select a topic…</option>
              <option value="general">General</option>
              <option value="press">Press</option>
              <option value="partnerships">Partnerships</option>
              <option value="casting">Casting</option>
              <option value="support">Support</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="cf-message" className="form-label">Message</label>
            <textarea
              id="cf-message"
              name="message"
              className="form-textarea"
              rows={6}
              placeholder="Your message…"
            />
          </div>

          <div className="form-footer">
            <button type="submit" className="form-submit">Send Message</button>
            <p className="form-note">
              For urgent matters, email us directly:{" "}
              <a href="mailto:hello@impactaistudio.com" className="form-note-link">
                hello@impactaistudio.com
              </a>
              <br />
              We typically respond within 48 hours.
            </p>
          </div>
        </form>

      </div>

    </main>
  );
}
