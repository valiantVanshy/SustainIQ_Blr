// SustainIQ Bengaluru | Author: Vanshika Sharma
import { useEffect, useState } from "react";
import { CATEGORIES, STATUSES } from "../../shared/constants.js";
import { api } from "../api.js";

const formatDate = (value) =>
  new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const badgeClass = (status) =>
  `status status-${status.toLowerCase().replaceAll(" ", "-")}`;

export default function CitizenReports({ wards, onChange }) {
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ wardId: "", status: "" });
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [lookup, setLookup] = useState("");
  const [tracked, setTracked] = useState(null);
  const [trackingError, setTrackingError] = useState("");
  const [deletingId, setDeletingId] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      ...filters,
      limit: "10",
      offset: String(page * 10),
    });
    api(`/reports?${params}`, { signal: controller.signal })
      .then((data) => {
        setReports(data.reports);
        setTotal(data.total);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [filters, page, revision]);
  function refresh() {
    setRevision((value) => value + 1);
    onChange();
  }
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { report } = await api("/reports", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      setMessage(`Report submitted. Save your report ID: ${report.id}`);
      setLookup(report.id);
      setTracked(report);
      form.reset();
      setPage(0);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function track(id) {
    setTrackingError("");
    setTracked(null);
    try {
      const { report } = await api(`/reports/${encodeURIComponent(id.trim())}`);
      setTracked(report);
      setLookup(report.id);
    } catch (err) {
      setTrackingError(err.message);
    }
  }
  async function deleteReport(report) {
    if (deletingId) return;
    if (
      !window.confirm("Permanently delete this report and its status history?")
    )
      return;
    setDeletingId(report.id);
    setError("");
    setTrackingError("");
    setMessage("");
    try {
      await api(`/reports/${report.id}`, {
        method: "DELETE",
      });
      setTracked((current) => (current?.id === report.id ? null : current));
      setLookup((current) => (current.trim() === report.id ? "" : current));
      setMessage("Report deleted.");
      setPage(0);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId("");
    }
  }
  function filter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(0);
  }
  return (
    <>
      {message && (
        <div className="success" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="reports-grid">
        <section className="panel">
          <p className="eyebrow">A PLACE TO START</p>
          <h2>Submit a citizen report</h2>
          <p className="muted">
            Reports are public within this app. Do not include personal
            information. This service does not contact authorities.
          </p>
          <form onSubmit={submit} className="stack-form">
            <label>
              Ward
              <select name="wardId" required defaultValue="">
                <option value="" disabled>
                  Select a ward
                </option>
                {wards.map((ward) => (
                  <option key={ward.id} value={ward.id}>
                    {ward.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select name="category" required defaultValue="">
                <option value="" disabled>
                  Choose a category
                </option>
                {CATEGORIES.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Location or landmark
              <input
                name="location"
                required
                minLength={3}
                maxLength={120}
                placeholder="e.g. near the community park"
              />
            </label>
            <label>
              What needs attention?
              <textarea
                name="description"
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                placeholder="Describe the issue clearly (10–2,000 characters)."
              />
            </label>
            <button className="button" disabled={busy}>
              {busy ? "Submitting…" : "Submit report ↗"}
            </button>
          </form>
        </section>
        <section className="panel tracking-panel">
          <p className="eyebrow">FOLLOW THE PROGRESS</p>
          <h2>Track a report</h2>
          <form
            className="lookup-form"
            onSubmit={(event) => {
              event.preventDefault();
              track(lookup);
            }}
          >
            <label>
              Report ID
              <input
                value={lookup}
                onChange={(event) => setLookup(event.target.value)}
                required
                maxLength={36}
                placeholder="Paste the ID from your submission"
              />
            </label>
            <button className="button secondary">Find report</button>
          </form>
          {trackingError && (
            <div className="error" role="alert">
              {trackingError}
            </div>
          )}
          {!tracked && (
            <p className="empty">
              Enter an ID or open a report from the list below.
            </p>
          )}
          {tracked && (
            <div className="tracked-report">
              <span className={badgeClass(tracked.status)}>
                {tracked.status}
              </span>
              <h3>
                {wards.find((ward) => ward.id === tracked.wardId)?.name} ·{" "}
                {tracked.category}
              </h3>
              <p>
                <strong>{tracked.location}</strong>
              </p>
              <p className="description">{tracked.description}</p>
              <small className="report-id">{tracked.id}</small>
              <ol className="timeline">
                {tracked.history.map((event, i) => (
                  <li key={i}>
                    <strong>{event.status}</strong>
                    <small>{formatDate(event.createdAt)}</small>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className="button danger"
                disabled={!!deletingId}
                onClick={() => deleteReport(tracked)}
              >
                {deletingId === tracked.id ? "Deleting..." : "Delete report"}
              </button>
            </div>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">COMMUNITY LOG</p>
            <h2>
              Citizen reports <span className="muted">({total})</span>
            </h2>
          </div>
          <button className="text-button" onClick={refresh}>
            Refresh ↻
          </button>
        </div>
        <div className="filters">
          <label>
            Ward
            <select
              value={filters.wardId}
              onChange={(event) => filter("wardId", event.target.value)}
            >
              <option value="">All wards</option>
              {wards.map((ward) => (
                <option key={ward.id} value={ward.id}>
                  {ward.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={filters.status}
              onChange={(event) => filter("status", event.target.value)}
            >
              <option value="">All statuses</option>
              {STATUSES.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        {loading ? (
          <p role="status">Loading reports…</p>
        ) : !reports.length ? (
          <p className="empty">
            No reports found. Submit an issue or adjust the filters.
          </p>
        ) : (
          <div className="report-list">
            {reports.map((report) => (
              <article key={report.id} className="report-row">
                <div>
                  <span className={badgeClass(report.status)}>
                    {report.status}
                  </span>
                  <h3>
                    {report.category} ·{" "}
                    {wards.find((ward) => ward.id === report.wardId)?.name}
                  </h3>
                  <p>{report.location}</p>
                  <small>{formatDate(report.createdAt)}</small>
                </div>
                <div className="report-actions">
                  <button
                    className="button secondary"
                    disabled={!!deletingId}
                    onClick={() => track(report.id)}
                  >
                    View & track ↗
                  </button>
                  <button
                    type="button"
                    className="button danger"
                    disabled={!!deletingId}
                    onClick={() => deleteReport(report)}
                  >
                    {deletingId === report.id ? "Deleting..." : "Delete report"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="pagination">
          <button
            className="button secondary"
            disabled={page === 0 || loading}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>
          <span>Page {page + 1}</span>
          <button
            className="button secondary"
            disabled={(page + 1) * 10 >= total || loading}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      </section>
    </>
  );
}
