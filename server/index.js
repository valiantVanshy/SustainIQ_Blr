// SustainIQ Bengaluru | Author: Vanshika Sharma
import { createServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./database.js";
import { wards } from "../shared/wards.js";
import { CATEGORIES, STATUSES } from "../shared/constants.js";

const db = openDatabase(process.env.DB_PATH || "./data/reports.sqlite");
const adminToken = process.env.ADMIN_TOKEN || "";
const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "127.0.0.1";
if (!Number.isInteger(port) || port < 0 || port > 65535)
  throw new Error("PORT must be an integer from 0 to 65535.");

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}
function textField(value, label, min, max) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  ) {
    throw new HttpError(400, `${label} must be ${min}-${max} characters.`);
  }
  return value.trim();
}
async function body(req) {
  if (
    req.headers["content-type"]?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    throw new HttpError(415, "Use Content-Type: application/json.");
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 16384) {
      req.resume();
      throw new HttpError(413, "Request body exceeds 16 KB.");
    }
    chunks.push(chunk);
  }
  let value;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpError(400, "Expected a JSON object.");
  return value;
}
function exactFields(value, allowed) {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new HttpError(400, "Request contains unsupported fields.");
}
function authorize(req) {
  if (!adminToken)
    throw new HttpError(
      503,
      "Administrator updates are disabled. Configure ADMIN_TOKEN on the server.",
    );
  const received = Buffer.from(req.headers.authorization || "");
  const expected = Buffer.from(`Bearer ${adminToken}`);
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  )
    throw new HttpError(401, "A valid administrator token is required.");
}
function getReport(id) {
  const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(id);
  if (!report) throw new HttpError(404, "Report not found.");
  return {
    ...report,
    history: db
      .prepare(
        "SELECT status, createdAt FROM report_events WHERE reportId = ? ORDER BY sequence",
      )
      .all(id),
  };
}
function transaction(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

async function handleApi(req, res, url) {
  const path = url.pathname;
  if (path === "/api/health" && req.method === "GET") {
    db.prepare("SELECT 1").get();
    return json(res, 200, {
      status: "ok",
      dataMode: "illustrative ward profiles; persistent user reports",
    });
  }
  if (path === "/api/wards" && req.method === "GET")
    return json(res, 200, { illustrative: true, wards });
  if (path === "/api/reports" && req.method === "GET") {
    const wardId = url.searchParams.get("wardId");
    const status = url.searchParams.get("status");
    if (wardId && !wards.some((ward) => ward.id === wardId))
      throw new HttpError(400, "Unknown ward.");
    if (status && !STATUSES.includes(status))
      throw new HttpError(400, "Unknown status.");
    const limit = Number(url.searchParams.get("limit") || 50);
    const offset = Number(url.searchParams.get("offset") || 0);
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > 1000000
    )
      throw new HttpError(400, "Invalid pagination.");
    const params = [
      wardId || null,
      wardId || null,
      status || null,
      status || null,
    ];
    const where =
      "WHERE (? IS NULL OR wardId = ?) AND (? IS NULL OR status = ?)";
    const total = db
      .prepare(`SELECT COUNT(*) AS count FROM reports ${where}`)
      .get(...params).count;
    const reports = db
      .prepare(
        `SELECT * FROM reports ${where} ORDER BY createdAt DESC, id DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset);
    const counts = Object.fromEntries(STATUSES.map((value) => [value, 0]));
    for (const row of db
      .prepare("SELECT status, COUNT(*) AS count FROM reports GROUP BY status")
      .all())
      counts[row.status] = row.count;
    return json(res, 200, { reports, total, limit, offset, counts });
  }
  if (path === "/api/reports" && req.method === "POST") {
    const input = await body(req);
    exactFields(input, ["wardId", "category", "location", "description"]);
    if (!wards.some((ward) => ward.id === input.wardId))
      throw new HttpError(400, "Choose a valid ward.");
    if (!CATEGORIES.includes(input.category))
      throw new HttpError(400, "Choose a valid category.");
    const location = textField(input.location, "Location", 3, 120);
    const description = textField(input.description, "Description", 10, 2000);
    const id = randomUUID();
    const now = new Date().toISOString();
    transaction(() => {
      db.prepare(
        "INSERT INTO reports (id, wardId, category, location, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run(id, input.wardId, input.category, location, description, now, now);
      db.prepare(
        "INSERT INTO report_events (reportId, status, createdAt) VALUES (?, ?, ?)",
      ).run(id, "Submitted", now);
    });
    res.setHeader("Location", `/api/reports/${id}`);
    return json(res, 201, { report: getReport(id) });
  }
  const match = path.match(/^\/api\/reports\/([a-f0-9-]{36})(\/status)?$/);
  if (match && !match[2] && req.method === "GET")
    return json(res, 200, { report: getReport(match[1]) });
  if (match && !match[2] && req.method === "DELETE") {
    transaction(() => {
      const report = getReport(match[1]);
      db.prepare("DELETE FROM report_events WHERE reportId = ?").run(report.id);
      db.prepare("DELETE FROM reports WHERE id = ?").run(report.id);
    });
    return json(res, 200, { deleted: match[1] });
  }
  if (match && match[2] && req.method === "PATCH") {
    authorize(req);
    const input = await body(req);
    exactFields(input, ["status"]);
    if (!STATUSES.includes(input.status))
      throw new HttpError(400, "Choose a valid report status.");
    transaction(() => {
      const report = getReport(match[1]);
      if (report.status === input.status) return;
      const now = new Date().toISOString();
      db.prepare(
        "UPDATE reports SET status = ?, updatedAt = ? WHERE id = ?",
      ).run(input.status, now, report.id);
      db.prepare(
        "INSERT INTO report_events (reportId, status, createdAt) VALUES (?, ?, ?)",
      ).run(report.id, input.status, now);
    });
    return json(res, 200, { report: getReport(match[1]) });
  }
  throw new HttpError(404, "API route not found.");
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
async function staticFile(req, res, url) {
  if (!["GET", "HEAD"].includes(req.method))
    throw new HttpError(405, "Method not allowed.");
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    throw new HttpError(400, "Invalid URL encoding.");
  }
  if (pathname.split(/[\\/]/).some((part) => part.startsWith(".")))
    throw new HttpError(404, "File not found.");
  const base = resolve(dist);
  let path = resolve(base, "." + pathname);
  if (path !== base && !path.startsWith(base + sep))
    throw new HttpError(403, "Forbidden.");
  // Only built assets and the SPA shell are served. Source, secrets and DB stay private.
  if (pathname === "/" || !extname(pathname))
    path = resolve(base, "index.html");
  try {
    if (!(await stat(path)).isFile())
      throw new HttpError(404, "File not found.");
    const content = await readFile(path);
    res.writeHead(200, {
      "Content-Type": mime[extname(path)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch (error) {
    if (error.code === "ENOENT")
      throw new HttpError(
        404,
        "File not found. Run npm run build before starting production.",
      );
    throw error;
  }
}

const server = createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api" || url.pathname.startsWith("/api/"))
      await handleApi(req, res, url);
    else await staticFile(req, res, url);
  } catch (error) {
    if (!error.status) console.error(error);
    if (!res.headersSent)
      json(res, error.status || 500, {
        error: error.status ? error.message : "Internal server error.",
      });
    else res.end();
  }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(port, host, () => {
  console.log(`SustainIQ listening on http://${host}:${server.address().port}`);
  if (!adminToken)
    console.warn("ADMIN_TOKEN is unset; status updates are disabled.");
});
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  server.closeIdleConnections();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
