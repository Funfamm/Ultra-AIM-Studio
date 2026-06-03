"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import "./work-form.css";

type WorkType =
  | "SHORT_FILM" | "FULL_FILM" | "SERIES" | "EPISODE" | "TRAILER"
  | "COMMERCIAL" | "BRANDING" | "CAMPAIGN" | "CASE_STUDY";

type WorkStatus = "DRAFT" | "IN_PRODUCTION" | "UPCOMING" | "PUBLISHED" | "PRIVATE";

const TYPE_LABELS: Record<WorkType, string> = {
  SHORT_FILM: "Short Film",
  FULL_FILM:  "Full Film",
  SERIES:     "Series",
  EPISODE:    "Episode",
  TRAILER:    "Trailer",
  COMMERCIAL: "Commercial",
  BRANDING:   "Branding",
  CAMPAIGN:   "Campaign",
  CASE_STUDY: "Case Study",
};

type WorkData = {
  type: WorkType; status: WorkStatus; title: string;
  description: string | null;
  posterUrl: string | null; heroMobileUrl: string | null;
  heroDesktopUrl: string | null; thumbnailUrl: string | null;
  videoUrl: string | null; trailerUrl: string | null; teaserUrl: string | null;
  year: number | null; duration: number | null; director: string | null; genres: string[];
  clientName: string | null; industry: string | null; projectGoal: string | null;
  deliverables: string | null; caseStudy: string | null; galleryUrls: string[];
  requiresAuth: boolean; requiresLoginToViewTrailer: boolean;
  featured: boolean; showOnHome: boolean; commentsEnabled: boolean; order: number;
  parentId: string | null; episodeNumber: number | null; seasonNumber: number | null;
  introStart: number | null; introEnd: number | null; creditsStart: number | null;
  contentRating: string | null; contentDescriptors: string[];
};

type Props = {
  work: WorkData | null;
  workTitle?: string;
  action: (formData: FormData) => Promise<void>;
  seriesList: { id: string; title: string }[];
  error?: string;
  /** Pre-select type for new works (e.g. "EPISODE" from Add Episode link) */
  defaultType?: WorkType;
  /** Pre-select parent series for new episode */
  defaultParentId?: string;
};

const CLIENT_TYPES: WorkType[] = ["COMMERCIAL", "BRANDING", "CAMPAIGN", "CASE_STUDY"];

const GENRES = [
  "Drama", "Action", "Horror", "Thriller", "Documentary",
  "Comedy", "Romance", "Family", "Faith", "Mystery",
  "Survival", "Commercial", "Branding", "Campaign",
];

export default function WorkForm({ work, workTitle, action, seriesList, error, defaultType, defaultParentId }: Props) {
  const [type, setType] = useState<WorkType>(work?.type ?? defaultType ?? "SHORT_FILM");

  const showFilmMeta      = ["SHORT_FILM", "FULL_FILM", "SERIES", "TRAILER"].includes(type);
  const showDuration      = !["SERIES", ...CLIENT_TYPES].includes(type);
  const showDirector      = ["SHORT_FILM", "FULL_FILM", "SERIES"].includes(type);
  const showTrailerUrl    = ["SHORT_FILM", "FULL_FILM", "SERIES"].includes(type);
  const showVideoUrl      = type !== "SERIES";
  const showTeaserUrl     = type === "COMMERCIAL";
  const isEpisode         = type === "EPISODE";
  const isClientType      = CLIENT_TYPES.includes(type);
  const showDeliverables  = ["BRANDING", "CAMPAIGN", "CASE_STUDY"].includes(type);
  const showCaseStudy     = ["BRANDING", "CAMPAIGN", "CASE_STUDY"].includes(type);
  const showGallery       = ["BRANDING", "CAMPAIGN", "CASE_STUDY"].includes(type);
  // Series sets intro timings + content advisory; episodes inherit — hide both for EPISODE type
  const showPlayerTimings  = ["SERIES", "FULL_FILM", "SHORT_FILM"].includes(type);
  const showContentAdvisory = !isEpisode;

  const videoLabel =
    type === "TRAILER"  ? "Trailer Video URL" :
    type === "EPISODE"  ? "Episode Video URL" :
    type === "COMMERCIAL" ? "Commercial Video URL" :
    "Main Video URL";

  return (
    <div className="admin-form-page">
      <Link href="/admin/works" className="admin-back">
        <ChevronLeft size={15} /> All Works
      </Link>
      <h1 className="admin-page-title">
        {work ? `Edit: ${workTitle}` : "Add Work"}
      </h1>

      {error && <div className="form-error">{error}</div>}

      <form action={action} className="work-form">

        {/* Type + Status */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Work Type *</label>
            <select
              name="type"
              className="form-input"
              value={type}
              onChange={(e) => setType(e.target.value as WorkType)}
              required
            >
              {(Object.entries(TYPE_LABELS) as [WorkType, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select name="status" className="form-input" defaultValue={work?.status ?? "DRAFT"}>
              <option value="DRAFT">Draft</option>
              <option value="IN_PRODUCTION">In Production (public, no full film)</option>
              <option value="UPCOMING">Upcoming / Coming Soon (public)</option>
              <option value="PUBLISHED">Published</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>
        </div>

        {/* Episode parent + numbering */}
        {isEpisode && (
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Parent Series *</label>
              <select name="parentId" className="form-input" defaultValue={work?.parentId ?? defaultParentId ?? ""} required>
                <option value="">Select a series…</option>
                {seriesList.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Season</label>
              <input type="number" name="seasonNumber" className="form-input"
                defaultValue={work?.seasonNumber ?? 1} min={1} />
            </div>
            <div className="form-group">
              <label className="form-label">Episode Number *</label>
              <input type="number" name="episodeNumber" className="form-input"
                defaultValue={work?.episodeNumber ?? ""} min={1} required />
            </div>
          </div>
        )}

        {/* Title */}
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input type="text" name="title" className="form-input"
            defaultValue={work?.title ?? ""} required placeholder="Work title" />
        </div>

        {/* Description */}
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea name="description" className="form-textarea" rows={3}
            defaultValue={work?.description ?? ""} placeholder="Short description…" />
        </div>

        {/* Genres — hidden for episodes (inherited from parent series) */}
        {!isEpisode && (
          <div className="form-group">
            <label className="form-label">Genres</label>
            <div className="form-check-grid">
              {GENRES.map((g) => (
                <label key={g} className="form-check">
                  <input
                    type="checkbox"
                    name="genres"
                    value={g}
                    defaultChecked={work?.genres?.includes(g) ?? false}
                  />
                  <span>{g}</span>
                </label>
              ))}
            </div>
            <span className="form-hint">Select all that apply.</span>
          </div>
        )}

        {/* Film metadata */}
        {showFilmMeta && (
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Year</label>
              <input type="number" name="year" className="form-input"
                defaultValue={work?.year ?? ""} placeholder="2025" min={1900} max={2099} />
            </div>
            {showDuration && (
              <div className="form-group">
                <label className="form-label">Duration (min)</label>
                <input type="number" name="duration" className="form-input"
                  defaultValue={work?.duration ?? ""} placeholder="90" min={1} />
              </div>
            )}
            {showDirector && (
              <div className="form-group">
                <label className="form-label">Director</label>
                <input type="text" name="director" className="form-input"
                  defaultValue={work?.director ?? ""} placeholder="Director name" />
              </div>
            )}
          </div>
        )}

        {/* Episode duration (separate row) */}
        {isEpisode && (
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Duration (min)</label>
              <input type="number" name="duration" className="form-input"
                defaultValue={work?.duration ?? ""} placeholder="45" min={1} />
            </div>
          </div>
        )}

        {/* Client fields */}
        {isClientType && (
          <>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Client / Brand Name</label>
                <input type="text" name="clientName" className="form-input"
                  defaultValue={work?.clientName ?? ""} placeholder="Brand name" />
              </div>
              <div className="form-group">
                <label className="form-label">Industry</label>
                <input type="text" name="industry" className="form-input"
                  defaultValue={work?.industry ?? ""} placeholder="Fashion, Tech, FMCG…" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Project Goal</label>
              <input type="text" name="projectGoal" className="form-input"
                defaultValue={work?.projectGoal ?? ""} placeholder="Campaign objective or brief…" />
            </div>
          </>
        )}

        {/* ── Images — two main fields, advanced overrides collapsed ── */}
        {!isEpisode && (
          <>
            <div className="form-group">
              <label className="form-label">Mobile Image URL</label>
              <input type="url" name="heroMobileUrl" className="form-input"
                defaultValue={work?.heroMobileUrl ?? ""} placeholder="https://…" />
              <span className="form-hint">Recommended 9:16 portrait. Used for mobile hero sections, cards, and posters.</span>
            </div>
            <div className="form-group">
              <label className="form-label">Desktop Image URL</label>
              <input type="url" name="heroDesktopUrl" className="form-input"
                defaultValue={work?.heroDesktopUrl ?? ""} placeholder="https://…" />
              <span className="form-hint">Recommended 16:9 or wider cinematic. Used for desktop hero sections and wide previews.</span>
            </div>
          </>
        )}
        {isEpisode && (
          <div className="form-group">
            <label className="form-label">Episode Image URL</label>
            <input type="url" name="heroMobileUrl" className="form-input"
              defaultValue={work?.heroMobileUrl ?? ""} placeholder="https://…" />
            <span className="form-hint">Thumbnail or still for this episode. Falls back to series images if empty.</span>
          </div>
        )}

        {/* Advanced image overrides (collapsed by default) */}
        <details style={{ marginTop: "0.25rem" }}>
          <summary style={{
            fontFamily: "var(--font-body)", fontSize: "0.75rem", fontWeight: 600,
            color: "var(--color-brand-muted)", cursor: "pointer", letterSpacing: "0.04em",
            listStyle: "none", userSelect: "none",
          }}>
            Advanced image overrides ▸
          </summary>
          <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div className="form-group">
              <label className="form-label">Card / Poster override</label>
              <input type="url" name="posterUrl" className="form-input"
                defaultValue={work?.posterUrl ?? ""} placeholder="https://…" />
              <span className="form-hint">Overrides the portrait card/poster. Defaults to Mobile Image if empty.</span>
            </div>
            <div className="form-group">
              <label className="form-label">Thumbnail override</label>
              <input type="url" name="thumbnailUrl" className="form-input"
                defaultValue={work?.thumbnailUrl ?? ""} placeholder="https://…" />
              <span className="form-hint">Overrides episode row thumbnail. Defaults to Desktop Image if empty.</span>
            </div>
          </div>
        </details>

        {/* Trailer URL */}
        {showTrailerUrl && (
          <div className="form-group">
            <label className="form-label">Trailer URL</label>
            <input type="url" name="trailerUrl" className="form-input"
              defaultValue={work?.trailerUrl ?? ""} placeholder="YouTube, Vimeo, or .mp4 URL" />
          </div>
        )}

        {/* Main video URL */}
        {showVideoUrl && (
          <div className="form-group">
            <label className="form-label">{videoLabel}</label>
            <input type="url" name="videoUrl" className="form-input"
              defaultValue={work?.videoUrl ?? ""} placeholder="YouTube, Vimeo, or .mp4 URL" />
          </div>
        )}

        {/* Teaser (commercial only) */}
        {showTeaserUrl && (
          <div className="form-group">
            <label className="form-label">Teaser URL (optional)</label>
            <input type="url" name="teaserUrl" className="form-input"
              defaultValue={work?.teaserUrl ?? ""} placeholder="Short teaser video URL" />
          </div>
        )}

        {/* Deliverables */}
        {showDeliverables && (
          <div className="form-group">
            <label className="form-label">Deliverables</label>
            <textarea name="deliverables" className="form-textarea" rows={3}
              defaultValue={work?.deliverables ?? ""}
              placeholder="Brand identity, Social campaign, TV spot…" />
          </div>
        )}

        {/* Case study */}
        {showCaseStudy && (
          <div className="form-group">
            <label className="form-label">Case Study</label>
            <textarea name="caseStudy" className="form-textarea" rows={6}
              defaultValue={work?.caseStudy ?? ""} placeholder="Full case study description…" />
          </div>
        )}

        {/* Gallery URLs */}
        {showGallery && (
          <div className="form-group">
            <label className="form-label">Gallery Image URLs (one per line)</label>
            <textarea name="galleryUrls" className="form-textarea" rows={4}
              defaultValue={work?.galleryUrls.join("\n") ?? ""}
              placeholder={"https://cdn.example.com/img1.jpg\nhttps://cdn.example.com/img2.jpg"} />
          </div>
        )}

        {/* Display controls — hidden for episodes (parent series controls these) */}
        {!isEpisode && (
          <>
            <div className="form-divider" />
            <div className="form-row form-row--checks">
              <label className="form-check">
                <input type="hidden" name="featured" value="false" />
                <input type="checkbox" name="featured" value="true"
                  defaultChecked={work?.featured ?? false} />
                <span>Featured</span>
              </label>
              <label className="form-check">
                <input type="hidden" name="showOnHome" value="false" />
                <input type="checkbox" name="showOnHome" value="true"
                  defaultChecked={work?.showOnHome ?? false} />
                <span>Show on Home page</span>
              </label>
              <label className="form-check">
                <input type="hidden" name="commentsEnabled" value="false" />
                <input type="checkbox" name="commentsEnabled" value="true"
                  defaultChecked={work?.commentsEnabled ?? true} />
                <span>Enable viewer comments</span>
              </label>
            </div>
          </>
        )}

        {/* Access control — type-specific */}
        <div className="form-divider" />

        {isEpisode ? (
          /* Episodes inherit from parent Series — no editable lock */
          <div className="form-episode-access-note">
            <span className="form-hint">
              🔒 Episode access is controlled by the parent series. Set login requirements on the series itself.
            </span>
          </div>
        ) : (
          <div className="form-row form-row--checks">
            {/* Main content lock — label varies by type */}
            <label className="form-check">
              <input type="hidden" name="requiresAuth" value="false" />
              <input type="checkbox" name="requiresAuth" value="true"
                defaultChecked={work?.requiresAuth ?? false} />
              <span>
                {type === "SERIES"
                  ? "Requires login to watch series & episodes"
                  : "Requires login to watch"}
              </span>
            </label>

            {/* Trailer lock — only for types that have a trailerUrl */}
            {showTrailerUrl && (
              <label className="form-check">
                <input type="hidden" name="requiresLoginToViewTrailer" value="false" />
                <input type="checkbox" name="requiresLoginToViewTrailer" value="true"
                  defaultChecked={work?.requiresLoginToViewTrailer ?? false} />
                <span>Requires login to watch trailer</span>
              </label>
            )}
          </div>
        )}

        {/* ── Episode Player Timing Override ─────────────────── */}
        {/* Content rating/descriptors are series-level. Intro/credits can be overridden per episode. */}
        {isEpisode && (
          <>
            <div className="form-divider" />
            <div className="form-section-title">Player Timings</div>
            <span className="form-hint" style={{ display: "block", marginBottom: "0.75rem" }}>
              Override the series intro/credits timing for this specific episode. Leave blank to use the Series settings (e.g. for a different season intro length).
            </span>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Intro Start (s)</label>
                <input type="number" name="introStart" className="form-input"
                  defaultValue={work?.introStart ?? ""} min={0} placeholder="Series default" />
              </div>
              <div className="form-group">
                <label className="form-label">Intro End (s)</label>
                <input type="number" name="introEnd" className="form-input"
                  defaultValue={work?.introEnd ?? ""} min={0} placeholder="Series default" />
              </div>
              <div className="form-group">
                <label className="form-label">Credits Start (s)</label>
                <input type="number" name="creditsStart" className="form-input"
                  defaultValue={work?.creditsStart ?? ""} min={0} placeholder="Series default" />
              </div>
            </div>
            <div className="form-episode-access-note">
              <span className="form-hint">
                Content rating and content descriptors are controlled by the parent Series.
              </span>
            </div>
          </>
        )}

        {showContentAdvisory && (
          <>
            <div className="form-divider" />
            <div className="form-section-title">Content Advisory</div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Content Rating</label>
                <select name="contentRating" className="form-input" defaultValue={work?.contentRating ?? ""}>
                  <option value="">Not Rated / Not Set</option>
                  <option value="G">G — General Audiences</option>
                  <option value="PG">PG — Parental Guidance</option>
                  <option value="PG-13">PG-13 — Parents Strongly Cautioned</option>
                  <option value="R">R — Restricted</option>
                  <option value="NC-17">NC-17 — Adults Only</option>
                  <option value="TV-G">TV-G — All Ages</option>
                  <option value="TV-PG">TV-PG — Parental Guidance</option>
                  <option value="TV-14">TV-14 — Parents Strongly Cautioned</option>
                  <option value="TV-MA">TV-MA — Mature Audiences</option>
                  <option value="NR">NR — Not Rated</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Content Descriptors</label>
              <div className="form-check-grid">
                {[
                  ["VIOLENCE",         "Violence"],
                  ["STRONG_LANGUAGE",  "Strong Language"],
                  ["MILD_LANGUAGE",    "Mild Language"],
                  ["NUDITY",           "Nudity"],
                  ["SEXUAL_CONTENT",   "Sexual Content"],
                  ["DRUG_USE",         "Drug Use"],
                  ["ALCOHOL",          "Alcohol Use"],
                  ["SMOKING",          "Smoking"],
                  ["FRIGHTENING",      "Frightening Scenes"],
                  ["THEMATIC_ELEMENTS","Thematic Elements"],
                ].map(([val, label]) => (
                  <label key={val} className="form-check">
                    <input
                      type="checkbox"
                      name="contentDescriptors"
                      value={val}
                      defaultChecked={work?.contentDescriptors?.includes(val) ?? false}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <span className="form-hint">Checked items appear in the content warning shown to viewers before they watch.</span>
            </div>

            {/* ── Player Timings (Series + standalone films) ── */}
            {showPlayerTimings && (
              <>
                <div className="form-divider" />
                <div className="form-section-title">Player Timings</div>
                <span className="form-hint" style={{ display: "block", marginBottom: "0.75rem" }}>
                  All values in seconds. Leave blank to disable. For Series, these apply to every episode.
                </span>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Intro Start (s)</label>
                    <input type="number" name="introStart" className="form-input"
                      defaultValue={work?.introStart ?? ""} min={0} placeholder="e.g. 30" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Intro End (s) — Skip Intro seeks here</label>
                    <input type="number" name="introEnd" className="form-input"
                      defaultValue={work?.introEnd ?? ""} min={0} placeholder="e.g. 105" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Credits Start (s)</label>
                    <input type="number" name="creditsStart" className="form-input"
                      defaultValue={work?.creditsStart ?? ""} min={0} placeholder="e.g. 2520" />
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Sort Order — hidden for episodes (order is season/episode number) */}
        {!isEpisode && (
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Sort Order</label>
              <input type="number" name="order" className="form-input"
                defaultValue={work?.order ?? 0} min={0} />
            </div>
          </div>
        )}

        <div className="form-actions">
          <Link href="/admin/works" className="form-cancel">Cancel</Link>
          <button type="submit" className="form-submit">
            {work ? "Save Changes" : "Add Work"}
          </button>
        </div>
      </form>

    </div>
  );
}
