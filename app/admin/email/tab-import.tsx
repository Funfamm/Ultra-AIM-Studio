import { bulkImportSuppression } from "@/lib/actions/email-admin";

interface Props {
  imported?: number;
  skipped?:  number;
  error?:    string;
}

export default function TabImport({ imported, skipped, error }: Props) {
  return (
    <>
      {/* ── Result banner ─────────────────────────── */}
      {imported !== undefined && (
        <section className="email-section">
          <p className="email-test-ok">
            ✓ Imported {imported} new suppression{imported !== 1 ? "s" : ""}.
            {skipped ? ` ${skipped} already active and skipped.` : ""}
          </p>
        </section>
      )}
      {error && (
        <section className="email-section">
          <p className="email-test-err">⚠ {error}</p>
        </section>
      )}

      {/* ── Bulk import form ──────────────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">Bulk suppression import</h2>
        <p className="email-hint">
          Paste email addresses below — one per line, or comma/semicolon-separated.
          Addresses already actively suppressed are skipped automatically.
        </p>
        <form
          action={bulkImportSuppression}
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <textarea
            name="emails"
            required
            placeholder={"user1@example.com\nuser2@example.com\nuser3@example.com"}
            className="email-sup-input email-import-textarea"
          />
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <select name="reason" className="email-sup-input email-sup-input--reason">
              <option value="manual">manual</option>
              <option value="hard_bounce">hard_bounce</option>
              <option value="complaint">complaint</option>
              <option value="unsubscribe">unsubscribe</option>
            </select>
            <button type="submit" className="email-sup-btn">Import</button>
          </div>
        </form>
      </section>

      {/* ── Notes ────────────────────────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">Import notes</h2>
        <ul className="email-routing-list" style={{ padding: 0 }}>
          <li>Duplicates within the pasted list are deduplicated before import.</li>
          <li>Addresses already in the active suppression list are skipped (not overwritten).</li>
          <li>Previously lifted (inactive) suppressions are re-activated with the new reason.</li>
          <li>All imports are attributed to source &ldquo;admin&rdquo; in the audit record.</li>
        </ul>
      </section>
    </>
  );
}
