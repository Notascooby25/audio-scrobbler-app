import { useMemo, useState } from "react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function GigCadenceHeatmap({ matrix = null }) {
  const years = matrix?.years || [];
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(() =>
    years.length > 0 ? years[0] : currentYear
  );

  const dailyCounts = matrix?.daily_counts || {};

  // Build grid data for selected year: 12 months x days
  const yearStats = useMemo(() => {
    let yearTotal = 0;
    let busiestMonth = "";
    let maxMonthCount = 0;

    const monthsData = MONTHS.map((mName, mIdx) => {
      const monthNum = mIdx + 1;
      const daysInMonth = new Date(selectedYear, monthNum, 0).getDate();
      let monthGigs = 0;

      const days = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${selectedYear}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const count = dailyCounts[dateKey] || 0;
        if (count > 0) {
          monthGigs += count;
          yearTotal += count;
        }
        days.push({ day, count, dateKey });
      }

      if (monthGigs > maxMonthCount) {
        maxMonthCount = monthGigs;
        busiestMonth = mName;
      }

      return {
        monthName: mName,
        monthNum,
        totalGigs: monthGigs,
        days,
      };
    });

    return {
      yearTotal,
      busiestMonth,
      monthsData,
    };
  }, [selectedYear, dailyCounts]);

  if (!matrix || years.length === 0) {
    return (
      <div className="chart-panel">
        <div className="panel-header">
          <h2>Annual Gig Cadence</h2>
        </div>
        <p className="notice" style={{ marginTop: "10px" }}>
          Log concerts to see your seasonal live music attendance rhythm.
        </p>
      </div>
    );
  }

  const getDayLevel = (count) => {
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (count === 2) return 2;
    return 3;
  };

  return (
    <div className="chart-panel">
      <div
        className="panel-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "10px",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Annual Gig Cadence</h2>
          <span style={{ fontSize: "12px", color: "var(--color-muted)" }}>
            Seasonal live concert rhythm
          </span>
        </div>

        {/* Year Selector Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label
            htmlFor="cadence-year-select"
            style={{ fontSize: "12px", color: "var(--color-muted)" }}
          >
            Year:
          </label>
          <select
            id="cadence-year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{
              padding: "4px 8px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              color: "var(--color-ink)",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {years.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "16px",
          marginBottom: "16px",
          fontSize: "12px",
          color: "var(--color-muted)",
        }}
      >
        <span>
          <strong style={{ color: "var(--color-ink)" }}>{yearStats.yearTotal}</strong> concerts in{" "}
          {selectedYear}
        </span>
        {yearStats.busiestMonth && (
          <span>
            Busiest month:{" "}
            <strong style={{ color: "var(--color-ink)" }}>{yearStats.busiestMonth}</strong>
          </span>
        )}
      </div>

      {/* 12-Month Matrix Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
          gap: "12px",
        }}
      >
        {yearStats.monthsData.map((m) => (
          <div
            key={m.monthName}
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: "var(--radius-sm)",
              padding: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "6px",
              }}
            >
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-ink)" }}>
                {m.monthName}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: m.totalGigs > 0 ? "var(--color-primary)" : "var(--color-muted)",
                  fontWeight: m.totalGigs > 0 ? 700 : 400,
                }}
              >
                {m.totalGigs > 0 ? `${m.totalGigs} gig${m.totalGigs === 1 ? "" : "s"}` : "—"}
              </span>
            </div>

            {/* Day Dots Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: "3px",
              }}
            >
              {m.days.map((d) => {
                const lvl = getDayLevel(d.count);
                let bg = "var(--color-surface-subtle, rgba(0, 0, 0, 0.04))";
                let borderColor = "transparent";
                if (lvl === 1) bg = "rgba(0, 102, 255, 0.45)";
                if (lvl === 2) bg = "rgba(0, 102, 255, 0.75)";
                if (lvl >= 3) {
                  bg = "var(--color-primary, #0066ff)";
                  borderColor = "var(--color-primary)";
                }

                return (
                  <div
                    key={d.dateKey}
                    title={`${d.dateKey}: ${d.count} concert${d.count === 1 ? "" : "s"}`}
                    style={{
                      aspectRatio: "1/1",
                      borderRadius: "2px",
                      background: bg,
                      border: `1px solid ${borderColor}`,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "6px",
          marginTop: "12px",
          fontSize: "11px",
          color: "var(--color-muted)",
        }}
      >
        <span>Fewer</span>
        <span
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "2px",
            background: "rgba(0, 0, 0, 0.04)",
          }}
        />
        <span
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "2px",
            background: "rgba(0, 102, 255, 0.45)",
          }}
        />
        <span
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "2px",
            background: "rgba(0, 102, 255, 0.75)",
          }}
        />
        <span
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "2px",
            background: "var(--color-primary, #0066ff)",
          }}
        />
        <span>More</span>
      </div>
    </div>
  );
}
