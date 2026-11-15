// SustainIQ Bengaluru | Author: Vanshika Sharma
import { METRICS } from "../../shared/constants.js";

export default function Dashboard({ wards, counts, onExplore, onReport }) {
  const average = (
    wards.reduce((sum, ward) => sum + ward.index, 0) / wards.length
  ).toFixed(1);
  const total =
    counts && Object.values(counts).reduce((sum, value) => sum + value, 0);
  const ranked = [...wards].sort((a, b) => b.index - a.index);
  return (
    <>
      <section className="stats-grid" aria-label="Summary">
        <article className="stat-card featured">
          <span>City index</span>
          <strong>
            {average}
            <small>/100</small>
          </strong>
          <p>Mean across {wards.length} wards</p>
        </article>
        <article className="stat-card">
          <span>Neighbourhoods in focus</span>
          <strong>{wards.length.toString().padStart(2, "0")}</strong>
          <p>Illustrative ward profiles</p>
        </article>
        <article className="stat-card">
          <span>Open citizen reports</span>
          <strong>{counts ? total - counts.Resolved : "\u2014"}</strong>
          <p>Submitted, in review or in progress</p>
        </article>
        <article className="stat-card">
          <span>Resolved reports</span>
          <strong>{counts ? counts.Resolved : "\u2014"}</strong>
          <p>Marked resolved by an app administrator</p>
        </article>
      </section>
      <div className="dashboard-grid">
        <section className="panel ranking-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">NEIGHBOURHOOD SNAPSHOT</p>
              <h2>Ward performance</h2>
            </div>
            <button className="text-button" onClick={onExplore}>
              Explore wards ↗
            </button>
          </div>
          <p className="muted">
            Higher scores indicate stronger illustrative performance.
          </p>
          <div className="ranking">
            {ranked.map((ward, index) => (
              <div className="rank-row" key={ward.id}>
                <span className="rank-number">0{index + 1}</span>
                <div className="rank-name">
                  <strong>{ward.name}</strong>
                  <small>{ward.zone}</small>
                </div>
                <div className="bar-track">
                  <div style={{ width: `${ward.index}%` }} />
                </div>
                <strong className="score">{ward.index.toFixed(1)}</strong>
              </div>
            ))}
          </div>
          <div className="legend">
            <span className="legend-dot" /> Sustainability index · scores out of
            100
          </div>
        </section>
        <section className="community-card">
          <span className="small-tag">COMMUNITY MATTERS</span>
          <div className="community-art" aria-hidden="true">
            ♧
          </div>
          <h2>
            See an issue?
            <br />
            Make it visible.
          </h2>
          <p>
            Flag waste, water, air, green space or road concerns. Keep the
            report ID to follow updates.
          </p>
          <button className="button light" onClick={onReport}>
            Submit a citizen report <span>↗</span>
          </button>
          <small>Reports stay within this student project.</small>
        </section>
      </div>
      <section className="panel method-panel">
        <div>
          <p className="eyebrow">BEHIND THE NUMBER</p>
          <h2>A transparent index</h2>
          <p>
            Weighted scores minus 0.2 × the standard deviation across
            indicators. The penalty reflects uneven performance; this is an
            educational formula, not an official rating.
          </p>
        </div>
        <div className="metric-weights">
          {METRICS.map((metric) => (
            <div key={metric.key}>
              <strong>{metric.weight * 100}%</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
