import Link from "next/link";
import type { Metadata } from "next";
import "./about.css";

export const metadata: Metadata = {
  title: "About — AIM Studio",
  description: "Cinema for the moments we can't take back. Why AIM Studio exists.",
};

export default function AboutPage() {
  return (
    <main className="ab">

      {/* ── 1. Hero ─────────────────────────────────────── */}
      <section className="ab-hero">
        <div className="container-app ab-hero-inner">
          <span className="ab-eyebrow">Who We Are</span>
          <h1 className="ab-hero-title">
            We make films about<br />
            <em className="ab-hero-accent">what we almost lost.</em>
          </h1>
          <p className="ab-hero-desc">
            AIM Studio tells stories about sacrifice, regret, memory, and the people who refuse to look away.
          </p>
          <p className="ab-hero-secondary">AI is the tool. The feeling is the reason.</p>
        </div>
      </section>

      {/* ── 2. Manifesto Card ──────────────────────────── */}
      <section className="ab-manifesto-sect">
        <div className="container-app">
          <div className="ab-manifesto-card">
            <div className="ab-manifesto-bar" aria-hidden="true" />
            <div className="ab-manifesto-inner">
              <span className="ab-manifesto-deco" aria-hidden="true">&ldquo;</span>
              <p className="ab-manifesto-p">
                The technology has caught up to imagination. The barriers between idea
                and execution are falling. The question is no longer &ldquo;who gets to
                make films?&rdquo; &mdash; it&apos;s &ldquo;what stories will we choose to tell?&rdquo;
              </p>
              <p className="ab-manifesto-p">
                AIM Studio is the answer. We&apos;re building the platform where
                AI-native filmmakers create, where audiences discover work that
                wouldn&apos;t have existed otherwise, and where the next generation of
                storytellers gets their start.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Vision ──────────────────────────────────── */}
      <section className="ab-vision-sect">
        <div className="container-app">
          <div className="ab-vision-layout">
            <div className="ab-vision-left">
              <span className="ab-eyebrow">&mdash; The Vision</span>
              <h2 className="ab-h2">
                Cinema for the moments<br />
                we can&apos;t take back.
              </h2>
            </div>
            <div className="ab-vision-right">
              <p className="ab-body-p">
                This isn&apos;t about replacing traditional cinema. It&apos;s about expanding
                what cinema can be. Every story too small for Hollywood, too personal for
                a studio, too honest for a committee &mdash; that&apos;s where we start.
              </p>
              <p className="ab-body-p ab-body-p--gap">
                We make films that wouldn&apos;t have existed otherwise. That&apos;s not a
                marketing line. That&apos;s a standard we hold ourselves to every time we
                begin a new project.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Three Pillars — numbered editorial list ── */}
      <section className="ab-pillars-sect">
        <div className="container-app">
          <span className="ab-eyebrow">&mdash; Three Principles</span>
          <ol className="ab-pillar-list">
            <li className="ab-pillar-item">
              <span className="ab-pillar-num" aria-hidden="true">01</span>
              <div className="ab-pillar-content">
                <h3 className="ab-pillar-title">Stories That Matter</h3>
                <p className="ab-pillar-body">
                  Every film we make has to matter &mdash; to someone, somewhere.
                  We don&apos;t make content. We make cinema. The difference is intent.
                </p>
              </div>
            </li>
            <li className="ab-pillar-item">
              <span className="ab-pillar-num" aria-hidden="true">02</span>
              <div className="ab-pillar-content">
                <h3 className="ab-pillar-title">No Story Too Small</h3>
                <p className="ab-pillar-body">
                  The personal is universal. The micro is the macro. If the story is
                  true, it belongs on screen &mdash; no matter the budget or the scale.
                </p>
              </div>
            </li>
            <li className="ab-pillar-item">
              <span className="ab-pillar-num" aria-hidden="true">03</span>
              <div className="ab-pillar-content">
                <h3 className="ab-pillar-title">Every Frame, On Purpose</h3>
                <p className="ab-pillar-body">
                  No wasted shots. No filler. Every creative decision serves the story
                  and nothing else. Craft is the only standard we accept.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* ── 5. Mission & Story ─────────────────────────── */}
      <section className="ab-mission-sect">
        <div className="container-app ab-mission-grid">
          <div className="ab-mission-col">
            <span className="ab-eyebrow">&mdash; Our Mission</span>
            <h2 className="ab-h2 ab-h2--sm">Why we exist.</h2>
            <p className="ab-body-p">
              Hollywood spends 100 million dollars to make one film.
              We can make ten with the same vision and a fraction of the cost.
            </p>
            <p className="ab-body-p ab-body-p--gap">
              We don&apos;t make films for our audience. We make them with our audience.
              From casting to scripts to feedback &mdash; your voice shapes what we make next.
            </p>
          </div>
          <div className="ab-mission-divider" aria-hidden="true" />
          <div className="ab-mission-col">
            <span className="ab-eyebrow">&mdash; Our Story</span>
            <h2 className="ab-h2 ab-h2--sm">Where it started.</h2>
            <p className="ab-body-p">
              AIM Studio was built by a filmmaker tired of waiting for permission.
              The tools existed. The audience existed. The only question was what to make.
            </p>
            <p className="ab-body-p ab-body-p--gap">
              Free to watch. Available globally. The barriers to seeing great films
              should not exist &mdash; and with AIM Studio, they don&apos;t.
            </p>
          </div>
        </div>
      </section>

      {/* ── 6. Philosophy Quote ────────────────────────── */}
      <section className="ab-quote-sect">
        <div className="container-app ab-quote-wrap">
          <span className="ab-quote-deco" aria-hidden="true">&ldquo;</span>
          <blockquote className="ab-blockquote">
            I started AIM Studio because I was tired of waiting for permission.
            The tools exist now. The audience exists now.
            The only question left is: what do we make?
          </blockquote>
          <p className="ab-quote-attr">&mdash; Founder, AIM Studio</p>
        </div>
      </section>

      {/* ── 7. Journey Timeline ────────────────────────── */}
      <section className="ab-journey-sect">
        <div className="container-app">
          <span className="ab-eyebrow">&mdash; The Journey</span>
          <h2 className="ab-h2 ab-h2--sm">How we got here.</h2>
          <ol className="ab-timeline">
            <li className="ab-tl-item">
              <span className="ab-tl-year">2024</span>
              <div className="ab-tl-content">
                <h3 className="ab-tl-title">The Vision</h3>
                <p className="ab-tl-body">
                  A filmmaker with a dream and no permission. The tools existed.
                  The question was what to do with them.
                </p>
              </div>
            </li>
            <li className="ab-tl-item">
              <span className="ab-tl-year">2025</span>
              <div className="ab-tl-content">
                <h3 className="ab-tl-title">First Showcases</h3>
                <p className="ab-tl-body">
                  The first films premiered. Real stories. Real audience.
                  No Hollywood gate required.
                </p>
              </div>
            </li>
            <li className="ab-tl-item ab-tl-item--last">
              <span className="ab-tl-year">2026</span>
              <div className="ab-tl-content">
                <h3 className="ab-tl-title">The Platform</h3>
                <p className="ab-tl-body">
                  AIM Studio opens as a platform &mdash; built for creators,
                  open to audiences, available worldwide.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* ── 8. Core Values — manifesto rows ────────────── */}
      <section className="ab-values-sect">
        <div className="container-app">
          <span className="ab-eyebrow">&mdash; What We Stand For</span>
          <div className="ab-values-list">
            <div className="ab-value-row ab-value-row--first">
              <h3 className="ab-value-label">Stories That Matter</h3>
              <p className="ab-value-desc">
                Every film has to matter &mdash; to someone, somewhere. We don&apos;t chase
                trends or build for algorithms. We build work that endures long after
                the moment that created it.
              </p>
            </div>
            <div className="ab-value-row">
              <h3 className="ab-value-label">No Story Too Small</h3>
              <p className="ab-value-desc">
                The personal is universal. We have never turned away a true story for
                being too small, too quiet, or too niche. Too small is exactly where
                the real things live.
              </p>
            </div>
            <div className="ab-value-row">
              <h3 className="ab-value-label">Every Frame, On Purpose</h3>
              <p className="ab-value-desc">
                Craft is the commitment. No wasted shots, no filler content, no
                shortcuts that betray the story. Every creative decision is deliberate.
                Every frame is earned.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. CTA ─────────────────────────────────────── */}
      <section className="ab-cta-sect">
        <div className="container-app ab-cta-inner">
          <span className="ab-eyebrow">&mdash; Be Part of It</span>
          <h2 className="ab-cta-title">Be Part of<br className="ab-cta-br" /> Something Big</h2>
          <p className="ab-cta-desc">
            Watch for free. Share what moves you.<br className="ab-cta-br" />
            Help shape what we make next.<br />
            The audience is the studio now.
          </p>
          <div className="ab-cta-row">
            <Link href="/register" className="ab-btn-primary">Join the Community</Link>
            <Link href="/works" className="ab-btn-ghost">Browse Our Work</Link>
          </div>
        </div>
      </section>


    </main>
  );
}
