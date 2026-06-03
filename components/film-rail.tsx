import Link from "next/link";
import { ChevronRight } from "lucide-react";
import FilmCard from "./film-card";

export type RailFilm = {
  id: string;
  slug: string;
  title: string;
  posterUrl?: string | null;
  genre?: string | null;
  requiresAuth?: boolean;
  watchHref?: string;
};

type FilmRailProps = {
  title: string;
  label?: string;
  href?: string;
  films: RailFilm[];
  priority?: boolean;
  isLoggedIn?: boolean;
};

export default function FilmRail({
  title,
  label,
  href,
  films,
  priority = false,
  isLoggedIn = false,
}: FilmRailProps) {
  if (films.length === 0) return null;

  return (
    <section className="rail-section">
      <div className="container-app">
        <div className="rail-header">
          <div>
            {label && (
              <span className="rail-eyebrow">{label}</span>
            )}
            <div className="rail-title-row">
              <h2 className="rail-title">{title}</h2>
              {href && (
                <Link href={href} className="rail-view-all">
                  View all <ChevronRight size={14} />
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="rail-track">
          {films.map((film, i) => (
            <div key={film.id} className="rail-card">
              <FilmCard {...film} priority={priority && i < 4} isLoggedIn={isLoggedIn} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
