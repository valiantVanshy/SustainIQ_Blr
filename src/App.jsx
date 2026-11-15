// SustainIQ Bengaluru | Author: Vanshika Sharma
import { useEffect, useState } from "react";
import { wards } from "../shared/wards.js";
import Dashboard from "./components/Dashboard.jsx";
import WardExplorer from "./components/WardExplorer.jsx";
import CitizenReports from "./components/CitizenReports.jsx";
import { api } from "./api.js";

const tabs = ["Dashboard", "Ward explorer", "Citizen reports"];

export default function App() {
  const [tab, setTab] = useState(tabs[0]);
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api("/reports?limit=1", { signal: controller.signal })
      .then((data) => {
        setCounts(data.counts);
        setError("");
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });
    return () => controller.abort();
  }, [revision, tab]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setTab(tabs[0]);
          }}
        >
          <span className="brand-mark">S</span>
          <span>
            SustainIQ<small>BENGALURU</small>
          </span>
        </a>
        <p className="nav-label">CITY WORKSPACE</p>
        <nav aria-label="Main navigation">
          {tabs.map((name, i) => (
            <button
              key={name}
              className={tab === name ? "nav-item active" : "nav-item"}
              aria-current={tab === name ? "page" : undefined}
              onClick={() => setTab(name)}
            >
              <span aria-hidden="true">
                {["\u25eb", "\u2315", "\u25a4"][i]}
              </span>
              {name}
            </button>
          ))}
        </nav>
        <footer>
          Built for Bengaluru
          <br />
          <span>React · Node.js · SQLite</span>
        </footer>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Bengaluru <span className="muted">/ {tab}</span>
          </span>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">SUSTAINABILITY, MADE UNDERSTANDABLE</p>
              <h1>
                {tab === "Dashboard"
                  ? "Our city. A shared responsibility."
                  : tab === "Ward explorer"
                    ? "Understand your neighbourhood."
                    : "Small reports. Visible progress."}
              </h1>
              <p>
                {tab === "Dashboard"
                  ? "A snapshot of ward performance and community reporting."
                  : tab === "Ward explorer"
                    ? "Search neighbourhoods and compare the same four indicators."
                    : "Report a local issue and track its status using your report ID."}
              </p>
            </div>
            <span className="city-label">
              12.97° N<br />
              77.59° E
            </span>
          </div>
          {error && (
            <div className="error" role="alert">
              Report statistics unavailable: {error}
            </div>
          )}
          {tab === "Dashboard" && (
            <Dashboard
              wards={wards}
              counts={counts}
              onExplore={() => setTab(tabs[1])}
              onReport={() => setTab(tabs[2])}
            />
          )}
          {tab === "Ward explorer" && <WardExplorer wards={wards} />}
          {tab === "Citizen reports" && (
            <CitizenReports
              wards={wards}
              onChange={() => setRevision((value) => value + 1)}
            />
          )}
          <footer className="page-footer">SustainIQ Bengaluru</footer>
        </div>
      </main>
    </div>
  );
}
