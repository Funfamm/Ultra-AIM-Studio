"use client";
import { useState } from "react";
import {
  Plus, Pencil, Trash2, Eye, EyeOff, AlertTriangle, ChevronLeft,
} from "lucide-react";

type MediaType    = "IMAGE" | "VIDEO";
type DeviceTarget = "DESKTOP" | "MOBILE" | "BOTH";

interface MediaItem {
  id:           string;
  page:         string;
  mediaType:    MediaType;
  deviceTarget: DeviceTarget;
  imageUrl:     string;
  videoUrl:     string;
  posterUrl:    string;
  altText:      string;
  title:        string;
  sortOrder:    number;
  active:       boolean;
  createdAt:    string;
}

interface FormState {
  page:         string;
  mediaType:    MediaType;
  deviceTarget: DeviceTarget;
  imageUrl:     string;
  videoUrl:     string;
  posterUrl:    string;
  altText:      string;
  title:        string;
  sortOrder:    number;
  active:       boolean;
}

const PAGE_OPTIONS = [
  "home", "works", "about", "watch",
  "casting", "scripts", "training", "upcoming",
];

const BLANK: FormState = {
  page: "home", mediaType: "IMAGE", deviceTarget: "BOTH",
  imageUrl: "", videoUrl: "", posterUrl: "", altText: "", title: "",
  sortOrder: 0, active: true,
};

function itemToForm(item: MediaItem): FormState {
  return {
    page: item.page, mediaType: item.mediaType, deviceTarget: item.deviceTarget,
    imageUrl: item.imageUrl, videoUrl: item.videoUrl, posterUrl: item.posterUrl,
    altText: item.altText, title: item.title, sortOrder: item.sortOrder, active: item.active,
  };
}

export default function MediaClient({ initialItems }: { initialItems: MediaItem[] }) {
  const [items,         setItems]         = useState<MediaItem[]>(initialItems);
  const [pageFilter,    setPageFilter]    = useState("all");
  const [typeFilter,    setTypeFilter]    = useState("all");
  const [view,          setView]          = useState<"list" | "form">("list");
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [form,          setForm]          = useState<FormState>(BLANK);
  const [error,         setError]         = useState<string | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [confirmDelId,  setConfirmDelId]  = useState<string | null>(null);

  /* ── Derived ── */
  const filtered = items.filter((item) => {
    if (pageFilter !== "all" && item.page !== pageFilter) return false;
    if (typeFilter !== "all" && item.mediaType !== typeFilter) return false;
    return true;
  });

  const warnings = items.filter(
    (i) =>
      i.active &&
      i.mediaType === "VIDEO" &&
      (i.deviceTarget === "MOBILE" || i.deviceTarget === "BOTH") &&
      !i.posterUrl,
  );

  /* ── Navigation ── */
  function openAdd() {
    setForm(BLANK); setEditingId(null); setError(null); setView("form");
  }
  function openEdit(item: MediaItem) {
    setForm(itemToForm(item)); setEditingId(item.id); setError(null); setView("form");
  }
  function closeForm() {
    setView("list"); setEditingId(null); setError(null);
  }

  /* ── Form field setter ── */
  function setF<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  /* ── API helpers ── */
  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const body = editingId ? { ...form, id: editingId } : form;
      const res  = await fetch("/api/admin/media", {
        method:  editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        setError(j.error ?? "Save failed");
        return;
      }
      const saved = await res.json() as MediaItem;
      setItems((prev) =>
        editingId ? prev.map((i) => (i.id === editingId ? saved : i)) : [saved, ...prev],
      );
      closeForm();
    } catch {
      setError("Network error — check your connection");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(item: MediaItem) {
    const res = await fetch("/api/admin/media", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...item, active: !item.active }),
    });
    if (res.ok) {
      const updated = await res.json() as MediaItem;
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/media?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setConfirmDelId(null);
    }
  }

  /* ── Form view ── */
  const showVideoWarning =
    form.mediaType === "VIDEO" &&
    (form.deviceTarget === "MOBILE" || form.deviceTarget === "BOTH");

  if (view === "form") {
    return (
      <div className="mm-form-panel">
        <div className="mm-form-header">
          <button className="mm-back-btn" onClick={closeForm}>
            <ChevronLeft size={14} /> Back
          </button>
          <h2 className="mm-form-title">{editingId ? "Edit Media Item" : "Add Media Item"}</h2>
        </div>

        {error && <p className="mm-error">{error}</p>}

        {showVideoWarning && (
          <div className="mm-safety-warn">
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            Mobile video should only be used with a fast-loading poster and tested on a real device. Weak connections will use the poster fallback later.
          </div>
        )}

        <div className="mm-fields">
          {/* Title / Page */}
          <div className="mm-field-row--2col">
            <div className="mm-field">
              <label className="mm-label">Admin Title</label>
              <input
                className="mm-input"
                placeholder="e.g. Home cinematic background"
                value={form.title}
                onChange={(e) => setF("title", e.target.value)}
              />
            </div>
            <div className="mm-field">
              <label className="mm-label">Page <span className="mm-req">*</span></label>
              <select className="mm-select" value={form.page} onChange={(e) => setF("page", e.target.value)}>
                {PAGE_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Media Type / Device Target */}
          <div className="mm-field-row--2col">
            <div className="mm-field">
              <label className="mm-label">Media Type <span className="mm-req">*</span></label>
              <select
                className="mm-select"
                value={form.mediaType}
                onChange={(e) => setF("mediaType", e.target.value as MediaType)}
              >
                <option value="IMAGE">Image</option>
                <option value="VIDEO">Video</option>
              </select>
            </div>
            <div className="mm-field">
              <label className="mm-label">Device Target <span className="mm-req">*</span></label>
              <select
                className="mm-select"
                value={form.deviceTarget}
                onChange={(e) => setF("deviceTarget", e.target.value as DeviceTarget)}
              >
                <option value="BOTH">Both</option>
                <option value="DESKTOP">Desktop only</option>
                <option value="MOBILE">Mobile only</option>
              </select>
            </div>
          </div>

          {/* Image URL */}
          <div className="mm-field">
            <label className="mm-label">
              Image URL {form.mediaType === "IMAGE" && <span className="mm-req">*</span>}
            </label>
            <div className="mm-input-row">
              <input
                className="mm-input"
                type="url"
                placeholder="https://..."
                value={form.imageUrl}
                onChange={(e) => setF("imageUrl", e.target.value)}
              />
              {form.mediaType === "IMAGE" && form.imageUrl && (
                <img
                  className="mm-preview-img"
                  src={form.imageUrl}
                  alt="preview"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  onLoad={(e)  => { (e.target as HTMLImageElement).style.display = "block"; }}
                />
              )}
            </div>
          </div>

          {/* Video URL (VIDEO only) */}
          {form.mediaType === "VIDEO" && (
            <div className="mm-field">
              <label className="mm-label">Video URL <span className="mm-req">*</span></label>
              <input
                className="mm-input"
                type="url"
                placeholder="https://..."
                value={form.videoUrl}
                onChange={(e) => setF("videoUrl", e.target.value)}
              />
            </div>
          )}

          {/* Poster URL */}
          <div className="mm-field">
            <label className="mm-label">
              Poster / Fallback URL {form.mediaType === "VIDEO" && <span className="mm-req">*</span>}
            </label>
            <div className="mm-input-row">
              <input
                className="mm-input"
                type="url"
                placeholder="https://... (image shown while video loads, or on weak connection)"
                value={form.posterUrl}
                onChange={(e) => setF("posterUrl", e.target.value)}
              />
              {form.posterUrl && (
                <img
                  className="mm-preview-img"
                  src={form.posterUrl}
                  alt="poster preview"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  onLoad={(e)  => { (e.target as HTMLImageElement).style.display = "block"; }}
                />
              )}
            </div>
          </div>

          {/* Alt Text */}
          <div className="mm-field">
            <label className="mm-label">Alt Text</label>
            <input
              className="mm-input"
              placeholder="Describe the image for accessibility"
              value={form.altText}
              onChange={(e) => setF("altText", e.target.value)}
            />
          </div>

          {/* Sort Order / Active */}
          <div className="mm-field-row--2col">
            <div className="mm-field">
              <label className="mm-label">Sort Order</label>
              <input
                className="mm-input mm-input--num"
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(e) => setF("sortOrder", Math.max(0, parseInt(e.target.value, 10) || 0))}
              />
            </div>
            <div className="mm-field mm-field--toggle">
              <label className="mm-label">Active</label>
              <button
                type="button"
                className={`mm-toggle${form.active ? " mm-toggle--on" : ""}`}
                onClick={() => setF("active", !form.active)}
              >
                {form.active ? "Active" : "Inactive"}
              </button>
            </div>
          </div>
        </div>

        <div className="mm-form-actions">
          <button className="mm-btn-cancel" onClick={closeForm}>Cancel</button>
          <button className="mm-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : editingId ? "Update Media" : "Save Media"}
          </button>
        </div>
      </div>
    );
  }

  /* ── List view ── */
  return (
    <div className="mm-list">
      {/* Controls */}
      <div className="mm-list-controls">
        <div className="mm-filters">
          <div className="mm-filter-group">
            {["all", ...PAGE_OPTIONS].map((p) => (
              <button
                key={p}
                className={`mm-pill${pageFilter === p ? " mm-pill--active" : ""}`}
                onClick={() => setPageFilter(p)}
              >
                {p === "all" ? "All Pages" : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <div className="mm-filter-group">
            {(["all", "IMAGE", "VIDEO"] as const).map((t) => (
              <button
                key={t}
                className={`mm-pill${typeFilter === t ? " mm-pill--active" : ""}`}
                onClick={() => setTypeFilter(t)}
              >
                {t === "all" ? "All Types" : t === "IMAGE" ? "Image" : "Video"}
              </button>
            ))}
          </div>
        </div>
        <button className="mm-add-btn" onClick={openAdd}>
          <Plus size={14} /> Add Media
        </button>
      </div>

      {/* 4G safety warnings */}
      {warnings.length > 0 && (
        <div className="mm-warn-panel">
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            {warnings.length} active video item{warnings.length > 1 ? "s are" : " is"} assigned to
            mobile or both targets without a poster fallback. Edit{" "}
            {warnings.length > 1 ? "them" : "it"} to add a poster URL.
          </span>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="mm-empty">
          {items.length === 0
            ? "No media items yet. Add one to get started."
            : "No items match the current filter."}
        </div>
      ) : (
        <div className="mm-table-wrap">
          <table className="mm-table">
            <thead>
              <tr>
                <th>Preview</th>
                <th>Title / Page</th>
                <th>Type</th>
                <th>Target</th>
                <th>Order</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  {/* Thumbnail */}
                  <td>
                    <div className="mm-thumb">
                      {item.imageUrl || item.posterUrl ? (
                        <img
                          className="mm-thumb-img"
                          src={item.imageUrl || item.posterUrl}
                          alt=""
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <span className="mm-thumb-ph">—</span>
                      )}
                    </div>
                  </td>

                  {/* Title / Page */}
                  <td>
                    <div className="mm-cell-stack">
                      <span className="mm-cell-title">{item.title || "—"}</span>
                      <span className="mm-cell-sub">{item.page}</span>
                    </div>
                  </td>

                  {/* Type badge */}
                  <td>
                    <span className={`mm-badge mm-badge--${item.mediaType.toLowerCase()}`}>
                      {item.mediaType === "IMAGE" ? "Image" : "Video"}
                    </span>
                  </td>

                  {/* Target badge */}
                  <td>
                    <span className="mm-badge mm-badge--target">
                      {item.deviceTarget === "BOTH"
                        ? "Both"
                        : item.deviceTarget === "DESKTOP"
                        ? "Desktop"
                        : "Mobile"}
                    </span>
                  </td>

                  {/* Sort order */}
                  <td className="mm-cell-num">{item.sortOrder}</td>

                  {/* Active status */}
                  <td>
                    <span className={`mm-status mm-status--${item.active ? "active" : "off"}`}>
                      {item.active ? "Active" : "Off"}
                    </span>
                  </td>

                  {/* Actions */}
                  <td>
                    <div className="mm-actions">
                      <button
                        className="mm-btn-edit"
                        title="Edit"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        className={`mm-btn-toggle${item.active ? " mm-btn-toggle--on" : ""}`}
                        title={item.active ? "Deactivate" : "Activate"}
                        onClick={() => handleToggleActive(item)}
                      >
                        {item.active ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                      {confirmDelId === item.id ? (
                        <span className="mm-confirm-del">
                          Delete?
                          <button
                            className="mm-btn-confirm-yes"
                            onClick={() => handleDelete(item.id)}
                          >
                            Yes
                          </button>
                          <button
                            className="mm-btn-confirm-no"
                            onClick={() => setConfirmDelId(null)}
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          className="mm-btn-delete"
                          title="Delete"
                          onClick={() => setConfirmDelId(item.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
