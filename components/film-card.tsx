import Link from "next/link";
import Image from "next/image";
import { Lock, Play } from "lucide-react";
import "./film-card.css";

const TYPE_LABEL: Record<string, string> = {
  SHORT_FILM: "Short",
  FULL_FILM: "Film",
  SERIES: "Series",
  EPISODE: "Episode",
  TRAILER: "Trailer",
  COMMERCIAL: "Commercial",
  BRANDING: "Branding",
  CAMPAIGN: "Campaign",
  CASE_STUDY: "Case Study",
};

const STATUS_LABELS: Record<string, string> = {
  UPCOMING:      "Coming Soon",
  IN_PRODUCTION: "In Production",
};

type FilmCardProps = {
  slug: string;
  title: string;
  posterUrl?: string | null;
  heroMobileUrl?: string | null;
  genre?: string | null;
  requiresAuth?: boolean;
  isLoggedIn?: boolean;
  type?: string;
  status?: string;
  priority?: boolean;
  watchHref?: string;
};

export default function FilmCard({
  slug,
  title,
  posterUrl,
  heroMobileUrl,
  genre,
  requiresAuth,
  isLoggedIn = false,
  type,
  status,
  priority = false,
  watchHref,
}: FilmCardProps) {
  // Prefer heroMobileUrl (9:16 portrait) for cards; fall back to posterUrl
  const cardImage = heroMobileUrl ?? posterUrl;
  const isUpcoming = status === "UPCOMING" || status === "IN_PRODUCTION";
  return (
    <Link
      href={watchHref ?? `/works/${slug}`}
      aria-label={`View ${watchHref ? "film" : "details for"} ${title}`}
      className="fc"
      style={{ touchAction: "manipulation" }}
    >
      {/* Poster — image IS the card */}
      <div className="fc-poster">
        {cardImage ? (
          <Image
            src={cardImage}
            alt={title}
            fill
            sizes="(max-width: 640px) calc(50vw - 1.5rem), (max-width: 768px) 160px, (max-width: 1024px) 180px, 220px"
            className="object-cover"
            quality={85}
            priority={priority}
          />
        ) : (
          <div className="fc-placeholder" aria-hidden="true">
            {title.charAt(0)}
          </div>
        )}

        {/* Gradient */}
        <div className="fc-gradient" aria-hidden="true" />

        {/* Play overlay — appears on desktop hover */}
        <div className="fc-play-overlay" aria-hidden="true">
          <div className="fc-play-circle">
            <Play size={16} fill="currentColor" style={{ color: "var(--color-brand-white)", marginLeft: 2 }} />
          </div>
        </div>

        {/* Genre + title */}
        <div className="fc-info">
          {genre && (
            <span className="fc-genre">{genre}</span>
          )}
          <h3 className="fc-title">{title}</h3>
        </div>

        {/* Type badge — top-left */}
        {type && TYPE_LABEL[type] && (
          <div className="fc-type-badge">
            <span>{TYPE_LABEL[type]}</span>
          </div>
        )}

        {/* Status badge — top-right for upcoming/in-production */}
        {isUpcoming && status && STATUS_LABELS[status] ? (
          <div className="fc-status-badge">
            <span>{STATUS_LABELS[status]}</span>
          </div>
        ) : (
          /* Lock badge — top-right (guests only, published content) */
          requiresAuth && !isLoggedIn && (
            <div className="fc-lock-badge" aria-label="Members only">
              <Lock size={11} aria-hidden="true" />
            </div>
          )
        )}
      </div>
    </Link>
  );
}
