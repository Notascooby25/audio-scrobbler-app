import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("Library List Row Density per DESIGN.md", () => {
  const stylesPath = path.resolve(__dirname, "styles.css");
  const stylesContent = fs.readFileSync(stylesPath, "utf-8");

  it("compresses list row height to 48px with 4px top/bottom and 12px left/right padding", () => {
    expect(stylesContent).toMatch(
      /\.library-rank-row,\s*\.library-scrobble-row\s*\{[^}]*height:\s*48px/
    );
    expect(stylesContent).toMatch(
      /\.library-rank-row,\s*\.library-scrobble-row\s*\{[^}]*padding:\s*4px 12px/
    );
    expect(stylesContent).toMatch(
      /\.library-rank-row,\s*\.library-scrobble-row\s*\{[^}]*gap:\s*10px/
    );
    expect(stylesContent).toMatch(
      /\.library-rank-row,\s*\.library-scrobble-row\s*\{[^}]*border-top:\s*0\.5px solid var\(--color-border\)/
    );
  });

  it("styles artwork to 38x38px with 4px border-radius", () => {
    expect(stylesContent).toMatch(/\.library-row-artwork\s*\{[^}]*width:\s*38px/);
    expect(stylesContent).toMatch(/\.library-row-artwork\s*\{[^}]*height:\s*38px/);
    expect(stylesContent).toMatch(/\.library-row-artwork\s*\{[^}]*border-radius:\s*4px/);
  });

  it("styles title as 14px bold (var(--color-ink), 600) and subtitle as 11.5px label (var(--color-muted))", () => {
    expect(stylesContent).toMatch(/\.library-row-copy strong\s*\{[^}]*font-size:\s*14px/);
    expect(stylesContent).toMatch(/\.library-row-copy strong\s*\{[^}]*font-weight:\s*600/);
    expect(stylesContent).toMatch(/\.library-row-copy strong\s*\{[^}]*color:\s*var\(--color-ink\)/);
    expect(stylesContent).toMatch(/\.library-row-copy small\s*\{[^}]*font-size:\s*11\.5px/);
    expect(stylesContent).toMatch(
      /\.library-row-copy small\s*\{[^}]*color:\s*var\(--color-muted\)/
    );
  });

  it("styles count bar with accent bar background, 11.5px, 600, and scrobble time right-aligned with 12px, 500, var(--color-muted)", () => {
    expect(stylesContent).toMatch(/\.library-count-bar\s*\{[^}]*font-size:\s*11\.5px/);
    expect(stylesContent).toMatch(/\.library-count-bar\s*\{[^}]*font-weight:\s*600/);
    expect(stylesContent).toMatch(
      /\.library-count-bar\s*\{[^}]*background:\s*var\(--color-accent-bar\)/
    );
    expect(stylesContent).toMatch(/\.library-count-bar\s*\{[^}]*color:\s*var\(--color-ink\)/);
    expect(stylesContent).toMatch(/\.library-scrobble-row time\s*\{[^}]*font-size:\s*12px/);
    expect(stylesContent).toMatch(/\.library-scrobble-row time\s*\{[^}]*font-weight:\s*500/);
    expect(stylesContent).toMatch(
      /\.library-scrobble-row time\s*\{[^}]*color:\s*var\(--color-muted\)/
    );
    expect(stylesContent).toMatch(/\.library-scrobble-row time\s*\{[^}]*text-align:\s*right/);
  });

  it("does not hide library-select-toggle or bulk-select-control on mobile and provides sticky bulk action bar", () => {
    const mobileMediaBlock =
      stylesContent.match(
        /@media\s*\(max-width:\s*760px\)\s*\{([\s\S]*?)(?=\n@media\s*\(max-width:\s*480px|$)/
      )?.[1] || "";
    expect(mobileMediaBlock).not.toMatch(/\.library-select-toggle\s*\{[^}]*display:\s*none/);
    expect(mobileMediaBlock).not.toMatch(/\.bulk-select-control\s*\{[^}]*display:\s*none/);
    expect(mobileMediaBlock).toMatch(/\.bulk-action-bar\s*\{[^}]*position:\s*sticky/);
    expect(mobileMediaBlock).toMatch(/\.bulk-action-bar\s*button\s*\{[^}]*min-height:\s*44px/);
  });

  it("enforces touch target sizes of at least 44px on mobile controls", () => {
    const mobileMediaBlock =
      stylesContent.match(
        /@media\s*\(max-width:\s*760px\)\s*\{([\s\S]*?)(?=\n@media\s*\(max-width:\s*480px|$)/
      )?.[1] || "";
    expect(mobileMediaBlock).toMatch(/\.entry-menu-toggle\s*\{[^}]*min-width:\s*44px/);
    expect(mobileMediaBlock).toMatch(/\.entry-menu-toggle\s*\{[^}]*min-height:\s*44px/);
    expect(mobileMediaBlock).toMatch(/\.compare-toggle-btn\s*\{[^}]*min-height:\s*44px/);
    expect(mobileMediaBlock).toMatch(/\.segmented-tabs\s+button\s*\{[^}]*min-height:\s*44px/);
    expect(mobileMediaBlock).toMatch(/\.calendar-preset-chip\s*\{[^}]*min-height:\s*44px/);
    expect(mobileMediaBlock).toMatch(/\.calendar-day-btn\s*\{[^}]*min-height:\s*44px/);
  });

  it("preserves Reports category grid 2-row layout with single-line ellipsis and max-width bar track", () => {
    expect(stylesContent).toMatch(
      /\.report-category-grid\s+\.library-rank-row\s*\{[^}]*display:\s*grid/
    );
    expect(stylesContent).toMatch(
      /\.report-category-grid\s+\.library-rank-row\s*\{[^}]*grid-template-areas:\s*"media copy"\s*"media actions"/
    );
    expect(stylesContent).toMatch(
      /\.report-category-grid\s+\.library-rank-row\s*\{[^}]*min-height:\s*52px/
    );
    expect(stylesContent).toMatch(
      /\.report-category-grid\s+\.library-row-copy\s+strong\s*\{[^}]*white-space:\s*nowrap/
    );
    expect(stylesContent).toMatch(
      /\.report-category-grid\s+\.library-row-copy\s+strong\s*\{[^}]*text-overflow:\s*ellipsis/
    );
    expect(stylesContent).toMatch(
      /\.report-category-grid\s+\.library-bar-track\s*\{[^}]*max-width:\s*180px/
    );
  });
});
