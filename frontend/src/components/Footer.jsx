import { useState } from "react";
import { CHANGELOG } from "../changelogData";
import WhatsNewModal from "./WhatsNewModal";

export default function Footer() {
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);
  const currentVersion = CHANGELOG[0]?.version || "0.9.5";

  return (
    <footer className="app-footer" data-testid="app-footer">
      <div className="app-footer-content">
        <div className="app-footer-brand">
          <span>Audio Scrobbler App</span>
        </div>
        <div className="app-footer-links">
          <button
            type="button"
            className="app-footer-link app-footer-version-btn"
            onClick={() => setIsWhatsNewOpen(true)}
            aria-haspopup="dialog"
          >
            v{currentVersion} • What's new
          </button>
        </div>
      </div>
      <WhatsNewModal isOpen={isWhatsNewOpen} onClose={() => setIsWhatsNewOpen(false)} />
    </footer>
  );
}
