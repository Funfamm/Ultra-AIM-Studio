"use client";

import { useState, useTransition } from "react";
import {
  suspendUser,
  unsuspendUser,
  bulkSuspend,
  bulkUnsuspend,
  deactivateUser,
  restoreUser,
  purgeUser,
} from "@/lib/actions/users-admin";
import { UserRoleForm } from "./user-role-form";
import { UserResetBtn } from "./user-reset-btn";

export type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  hasPassword: boolean;
  loginMethod: "google" | "email" | "multi";
  status: string;      // "ACTIVE" | "SUSPENDED" | "DEACTIVATED"
  suspendedAt: string | null;
  lastLoginAt: string | null;
  lastLoginProvider: string | null;
  deviceCount: number;
  savedWorksCount: number;
  progressCount: number;
  createdAt: string;
  isSelf: boolean;
};

interface Props {
  users: UserRow[];
  isFiltered: boolean;
  sessionRole: string;
}

export function UsersTable({ users, isFiltered, sessionRole }: Props) {
  const isSuperAdmin = sessionRole === "SUPER_ADMIN";
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [error, setError]         = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Purge modal state ─────────────────────────────────────────
  const [purgeTarget, setPurgeTarget] = useState<string | null>(null);
  const [purgePhrase, setPurgePhrase] = useState("");
  const [purgeError, setPurgeError]   = useState<string | null>(null);

  // ── Selection helpers ──────────────────────────────────────
  const selectable = users.filter((u) => !u.isSelf);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() { setSelected(new Set(selectable.map((u) => u.id))); }
  function clearSelection() { setSelected(new Set()); }

  const allSelected = selectable.length > 0 && selected.size === selectable.length;

  // ── Bulk action eligibility ────────────────────────────────
  const selectedUsers     = users.filter((u) => selected.has(u.id));
  const suspendableCount  = selectedUsers.filter((u) => u.status === "ACTIVE" && !u.isSelf).length;
  const unsuspendableCount = selectedUsers.filter((u) => u.status === "SUSPENDED").length;

  // ── Single actions ─────────────────────────────────────────
  function handleSuspend(userId: string) {
    setError(null);
    startTransition(async () => {
      const res = await suspendUser(userId);
      if (!res.ok) setError(res.error ?? "Failed to suspend user.");
    });
  }

  function handleUnsuspend(userId: string) {
    setError(null);
    startTransition(async () => {
      const res = await unsuspendUser(userId);
      if (!res.ok) setError(res.error ?? "Failed to unsuspend user.");
    });
  }

  function handleDeactivate(userId: string) {
    setError(null);
    startTransition(async () => {
      const res = await deactivateUser(userId);
      if (!res.ok) setError(res.error ?? "Failed to deactivate user.");
    });
  }

  function handleRestore(userId: string) {
    setError(null);
    startTransition(async () => {
      const res = await restoreUser(userId);
      if (!res.ok) setError(res.error ?? "Failed to restore user.");
    });
  }

  function openPurge(userId: string) {
    setPurgeTarget(userId);
    setPurgePhrase("");
    setPurgeError(null);
  }

  function closePurge() {
    setPurgeTarget(null);
    setPurgePhrase("");
    setPurgeError(null);
  }

  function handlePurge() {
    if (!purgeTarget) return;
    setPurgeError(null);
    startTransition(async () => {
      const res = await purgeUser(purgeTarget, purgePhrase);
      if (res.ok) {
        closePurge();
      } else {
        setPurgeError(res.error ?? "Purge failed.");
      }
    });
  }

  // ── Bulk actions ──────────────────────────────────────────
  function handleBulkSuspend() {
    setError(null);
    const ids = selectedUsers.filter((u) => u.status === "ACTIVE" && !u.isSelf).map((u) => u.id);
    startTransition(async () => {
      await bulkSuspend(ids);
      clearSelection();
    });
  }

  function handleBulkUnsuspend() {
    setError(null);
    const ids = selectedUsers.filter((u) => u.status === "SUSPENDED").map((u) => u.id);
    startTransition(async () => {
      await bulkUnsuspend(ids);
      clearSelection();
    });
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      {/* Purge modal */}
      {purgeTarget && (
        <div className="purge-overlay" onClick={(e) => { if (e.target === e.currentTarget) closePurge(); }}>
          <div className="purge-modal" role="dialog" aria-modal="true" aria-label="Purge user confirmation">
            <h3 className="purge-modal-title">Purge Permanently</h3>
            <p className="purge-modal-body">
              This will permanently delete this user and <strong>all connected records</strong> —
              profile, sessions, OAuth links, watch progress, saved list, likes, notifications,
              preferences, login history, Notify Me signups, and queued emails.
              Analytics are anonymised (not deleted). Audit logs are preserved for accountability.
            </p>
            <p className="purge-modal-body" style={{ marginTop: "0.5rem" }}>
              <strong>This cannot be undone.</strong> If the same person re-registers, they will be
              treated as a brand-new user and receive a fresh welcome email.
            </p>
            <label className="purge-modal-label">
              Type <code className="purge-code">PURGE</code> to confirm:
            </label>
            <input
              type="text"
              value={purgePhrase}
              onChange={(e) => setPurgePhrase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && purgePhrase === "PURGE" && handlePurge()}
              placeholder="PURGE"
              className="purge-modal-input"
              autoFocus
            />
            {purgeError && <p className="purge-modal-error">{purgeError}</p>}
            <div className="purge-modal-actions">
              <button onClick={closePurge} className="purge-cancel-btn" disabled={isPending}>
                Cancel
              </button>
              <button
                onClick={handlePurge}
                disabled={purgePhrase !== "PURGE" || isPending}
                className="purge-confirm-btn"
              >
                {isPending ? "Purging…" : "Purge Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="ubulk-error" role="alert">
          {error}
          <button onClick={() => setError(null)} className="ubulk-error-close">✕</button>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="ubulk-bar">
          <span className="ubulk-count">{selected.size} selected</span>
          <button onClick={clearSelection} className="ubulk-btn ubulk-btn--ghost" disabled={isPending}>
            Clear
          </button>
          {suspendableCount > 0 && (
            <button onClick={handleBulkSuspend} disabled={isPending} className="ubulk-btn ubulk-btn--warn">
              Suspend {suspendableCount}
            </button>
          )}
          {unsuspendableCount > 0 && (
            <button onClick={handleBulkUnsuspend} disabled={isPending} className="ubulk-btn">
              Unsuspend {unsuspendableCount}
            </button>
          )}
          {isPending && <span className="ubulk-spinner" />}
        </div>
      )}

      {/* Table */}
      <div
        className={`admin-table-wrap${isPending ? " utable--pending" : ""}`}
        style={{ marginTop: selected.size > 0 ? "0" : "0.75rem" }}
      >
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 36, paddingRight: 0 }}>
                <input
                  type="checkbox"
                  className="ubulk-checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = selected.size > 0 && !allSelected;
                  }}
                  onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                  aria-label="Select all"
                />
              </th>
              <th>User</th>
              <th>Role</th>
              <th>Via</th>
              <th>Status</th>
              <th>Last Login</th>
              <th style={{ textAlign: "center" }}>Devices</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className={[
                  u.isSelf ? "urow--self" : "",
                  u.status === "SUSPENDED"   ? "urow--suspended"   : "",
                  u.status === "DEACTIVATED" ? "urow--deactivated" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {/* Checkbox */}
                <td style={{ paddingRight: 0 }}>
                  <input
                    type="checkbox"
                    className="ubulk-checkbox"
                    checked={selected.has(u.id)}
                    disabled={u.isSelf}
                    onChange={() => toggle(u.id)}
                    aria-label={`Select ${u.email}`}
                  />
                </td>

                {/* Name + Email */}
                <td>
                  <div className="ucell-name">
                    {u.name ?? <span className="ucell-anon">No name</span>}
                    {u.isSelf && <span className="uself-tag">you</span>}
                  </div>
                  <div className="ucell-email">{u.email}</div>
                </td>

                {/* Role */}
                <td>
                  {isSuperAdmin ? (
                    <UserRoleForm userId={u.id} currentRole={u.role} isSelf={u.isSelf} />
                  ) : (
                    <span className={`role-badge role-badge--${u.role === "SUPER_ADMIN" ? "super" : u.role === "ADMIN" ? "admin" : "user"}`}>
                      {u.role === "SUPER_ADMIN" ? "Super Admin" : u.role === "ADMIN" ? "Admin" : "Member"}
                    </span>
                  )}
                </td>

                {/* Login method */}
                <td>
                  <span className={`uvia-badge uvia-badge--${u.loginMethod}`}>
                    {u.loginMethod === "google" ? "Google" : u.loginMethod === "email" ? "Email" : "Multi"}
                  </span>
                </td>

                {/* Status */}
                <td>
                  {u.status === "SUSPENDED" ? (
                    <span
                      className="ustatus-badge ustatus-badge--suspended"
                      title={u.suspendedAt ? `Suspended ${new Date(u.suspendedAt).toLocaleDateString()}` : "Suspended"}
                    >
                      Suspended
                    </span>
                  ) : u.status === "DEACTIVATED" ? (
                    <span className="ustatus-badge ustatus-badge--deactivated">Deactivated</span>
                  ) : (
                    <span className="ustatus-badge ustatus-badge--active">Active</span>
                  )}
                </td>

                {/* Last login */}
                <td className="ucell-date">
                  {u.lastLoginAt ? (
                    <>
                      {new Date(u.lastLoginAt).toLocaleDateString("en-GB", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                      {u.lastLoginProvider && (
                        <div className="ucell-login-via">{u.lastLoginProvider}</div>
                      )}
                    </>
                  ) : (
                    <span className="ucell-never">Never</span>
                  )}
                </td>

                {/* Device count */}
                <td style={{ textAlign: "center" }}>
                  <span className="ucell-count">{u.deviceCount}</span>
                </td>

                {/* Joined */}
                <td className="ucell-date">
                  {new Date(u.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </td>

                {/* Actions */}
                <td>
                  <div className="action-btns">
                    {u.hasPassword && <UserResetBtn userId={u.id} />}

                    {/* Suspend / Unsuspend */}
                    {!u.isSelf && u.status === "ACTIVE" && (
                      <button
                        onClick={() => handleSuspend(u.id)}
                        disabled={isPending}
                        className="action-btn action-btn--danger"
                        title="Suspend user"
                        style={{ fontSize: "1rem", lineHeight: 1 }}
                      >
                        ⊘
                      </button>
                    )}
                    {!u.isSelf && u.status === "SUSPENDED" && (
                      <button
                        onClick={() => handleUnsuspend(u.id)}
                        disabled={isPending}
                        className="action-btn"
                        title="Unsuspend user"
                        style={{ fontSize: "0.8rem", lineHeight: 1 }}
                      >
                        ↺
                      </button>
                    )}

                    {/* Deactivate / Restore */}
                    {!u.isSelf && (u.status === "ACTIVE" || u.status === "SUSPENDED") && (
                      <button
                        onClick={() => handleDeactivate(u.id)}
                        disabled={isPending}
                        className="action-btn action-btn--deactivate"
                        title="Delete account but keep records (reversible)"
                      >
                        —
                      </button>
                    )}
                    {!u.isSelf && u.status === "DEACTIVATED" && (
                      <button
                        onClick={() => handleRestore(u.id)}
                        disabled={isPending}
                        className="action-btn action-btn--restore"
                        title="Restore deactivated account"
                      >
                        ↑
                      </button>
                    )}

                    {/* Purge (hard delete) — available for all non-self */}
                    {!u.isSelf && (
                      <button
                        onClick={() => openPurge(u.id)}
                        disabled={isPending}
                        className="action-btn action-btn--purge"
                        title="Purge permanently — deletes all user records (irreversible)"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {users.length === 0 && (
              <tr>
                <td colSpan={9} className="table-empty">
                  {isFiltered ? "No users match your filters." : "No users yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
