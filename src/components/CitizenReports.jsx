import { useState } from "react";
import { METRICS } from "../../shared/constants.js";

export default function WardExplorer({ wards }) {
  const [query, setQuery] = useState("");
  const [zone, setZone] = useState("");
  const [selected, setSelected] = useState([wards[0].id, wards[2].id]);
  const visible = wards.filter(
    (ward) =>
      `${ward.name} ${ward.id} ${ward.zone}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()) &&
      (!zone || ward.zone === zone),
  );
  function toggle(id) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id].slice(-3),
    );
  }
  const compared = wards.filter((ward) => selected.includes(ward.id));
  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <h2>Find a ward</h2>
          <span className="muted">
            {visible.length} of {wards.length} wards
          </span>
        </div>
        <div className="filters">
          <label>
            Search by name, ID or zone
            <input
              type="search"
              placeholder="Try Bellandur…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            Zone
            <select
              value={zone}
              onChange={(event) => setZone(event.target.value)}
            >
              <option value="">All zones</option>
              {[...new Set(wards.map((ward) => ward.zone))].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="ward-grid">
          {visible.map((ward) => (
            <article className="ward-card" key={ward.id}>
              <div>
                <span className="eyebrow">{ward.zone}</span>
                <h3>{ward.name}</h3>
                <small>{ward.id}</small>
              </div>
              <div className="ward-score">
                {ward.index}
                <small>index / 100</small>
              </div>
              <button
                className={
                  selected.includes(ward.id)
                    ? "button secondary selected"
                    : "button secondary"
                }
                aria-pressed={selected.includes(ward.id)}
                onClick={() => toggle(ward.id)}
              >
                {selected.includes(ward.id)
                  ? "\u2713 In comparison"
                  : "+ Compare ward"}
              </button>
            </article>
          ))}
        </div>
        {!visible.length && (
          <p className="empty">No wards match. Try another name or zone.</p>
        )}
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SIDE BY SIDE</p>
            <h2>Compare indicators</h2>
          </div>
          <span className="muted">Choose up to 3 wards</span>
        </div>
        <p className="muted">
          Selecting a fourth replaces the earliest selection. All indicators are
          scores out of 100.
        </p>
        {compared.length ? (
          <div className="table-scroll">
            <table>
              <caption className="sr-only">
                Ward sustainability comparison
              </caption>
              <thead>
                <tr>
                  <th scope="col">Indicator</th>
                  {compared.map((ward) => (
                    <th scope="col" key={ward.id}>
                      {ward.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((metric) => (
                  <tr key={metric.key}>
                    <th scope="row">
                      {metric.label} <small>({metric.weight * 100}%)</small>
                    </th>
                    {compared.map((ward) => (
                      <td key={ward.id}>
                        <span className="table-value">
                          {ward.scores[metric.key]}
                        </span>
                        <div className="mini-bar">
                          <span
                            style={{ width: `${ward.scores[metric.key]}%` }}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="total-row">
                  <th scope="row">Sustainability index</th>
                  {compared.map((ward) => (
                    <td key={ward.id}>{ward.index}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">Select a ward above to start comparing.</p>
        )}
      </section>
    </>
  );
}
