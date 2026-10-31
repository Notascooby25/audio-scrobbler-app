import { useState } from "react";

export default function BlockedItemsSection({
  blocks = [],
  error = "",
  onUnblock = () => {},
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmDialog, setConfirmDialog] = useState(null); // { ids: [...], label: "..." }
  const [isBusy, setIsBusy] = useState(false);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === blocks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(blocks.map((b) => b.id)));
    }
  };

  const handlePromptSingle = (block) => {
    setConfirmDialog({
      ids: [block.id],
      label: `unblock ${block.entity_type} "${block.name}"`,
    });
  };

  const handlePromptBatch = () => {
    if (selectedIds.size === 0) return;
    setConfirmDialog({
      ids: Array.from(selectedIds),
      label: `unblock ${selectedIds.size} selected item(s)`,
    });
  };

  const executeConfirmedUnblock = async () => {
    if (!confirmDialog || isBusy) return;
    setIsBusy(true);
    try {
      await onUnblock(confirmDialog.ids);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        confirmDialog.ids.forEach((id) => next.delete(id));
        return next;
      });
      setConfirmDialog(null);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "8px",
        background: "var(--color-surface)",
        padding: "16px",
        marginBottom: "1.5rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: "1rem", margin: 0, color: "var(--color-ink)" }}>Blocked items</h3>
          <p style={{ fontSize: "12px", color: "var(--color-muted)", margin: "4px 0 0 0" }}>
            Artists, albums, and tracks excluded from stats, scrobbles, and recommendations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          style={{
            fontSize: "12px",
            fontWeight: 600,
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid var(--color-border)",
            background: expanded ? "var(--color-primary)" : "var(--color-surface)",
            color: expanded ? "#FFFFFF" : "var(--color-ink)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>Blocked items ({blocks.length})</span>
          <span>{expanded ? "▲" : "▼"}</span>
        </button>
      </div>

      {error && (
        <p className="notice notice-error" role="alert" style={{ marginTop: "12px" }}>
          {error}
        </p>
      )}

      {expanded && (
        <div style={{ marginTop: "16px", borderTop: "1px solid var(--color-border)", paddingTop: "14px" }}>
          {blocks.length === 0 ? (
            <p className="panel-meta" style={{ margin: 0 }}>
              Nothing is currently blocked. Use the action menu on library scrobbles to block items.
            </p>
          ) : (
            <>
              {/* Batch selection header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                  fontSize: "12px",
                }}
              >
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--color-primary)",
                    cursor: "pointer",
                    padding: 0,
                    fontWeight: 600,
                  }}
                >
                  {selectedIds.size === blocks.length ? "Deselect all" : "Select all"}
                </button>

                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handlePromptBatch}
                    style={{
                      background: "var(--color-danger, #E11D48)",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: "6px",
                      padding: "6px 12px",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Unblock selected ({selectedIds.size})
                  </button>
                )}
              </div>

              {/* Items List */}
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                {blocks.map((b) => {
                  const isChecked = selectedIds.has(b.id);
                  return (
                    <li
                      key={b.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        border: "1px solid var(--color-border)",
                        background: isChecked ? "var(--color-surface-hover, var(--color-canvas))" : "var(--color-surface)",
                        gap: "12px",
                      }}
                    >
                      <label style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0, cursor: "pointer", margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(b.id)}
                          style={{ cursor: "pointer" }}
                        />
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "var(--color-border)",
                            color: "var(--color-muted)",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {b.entity_type}
                        </span>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "var(--color-ink)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {b.name}
                        </span>
                      </label>

                      <button
                        type="button"
                        onClick={() => handlePromptSingle(b)}
                        style={{
                          background: "transparent",
                          border: "1px solid var(--color-border)",
                          color: "var(--color-ink)",
                          borderRadius: "4px",
                          padding: "4px 8px",
                          fontSize: "11px",
                          cursor: "pointer",
                          fontWeight: 500,
                        }}
                      >
                        Unblock
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "var(--color-surface)",
              color: "var(--color-ink)",
              borderRadius: "10px",
              padding: "20px",
              maxWidth: "400px",
              width: "100%",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h4 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>Confirm Unblock</h4>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "var(--color-muted)", lineHeight: 1.4 }}>
              Are you sure you want to {confirmDialog.label}? They will reappear in your library and stats calculations.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setConfirmDialog(null)}
                style={{
                  background: "transparent",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-ink)",
                  padding: "8px 14px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={executeConfirmedUnblock}
                style={{
                  background: "var(--color-primary)",
                  border: "none",
                  color: "#FFFFFF",
                  padding: "8px 14px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: isBusy ? "not-allowed" : "pointer",
                  opacity: isBusy ? 0.7 : 1,
                }}
              >
                {isBusy ? "Unblocking..." : "Confirm Unblock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
