// SustainIQ Bengaluru | Author: Vanshika Sharma
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { calculateIndex, wards } from "../shared/wards.js";
import { openDatabase } from "../server/database.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const token = "integration-test-only-token";

async function launch(dbPath, adminToken = token) {
  const child = spawn(process.execPath, ["server/index.js"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: "0",
      HOST: "127.0.0.1",
      DB_PATH: dbPath,
      ADMIN_TOKEN: adminToken,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let logs = "";
  let errors = "";
  child.stderr.on("data", (chunk) => {
    errors += chunk;
  });
  const base = await new Promise((resolveReady, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Startup timed out: ${errors}`));
    }, 10000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited ${code}: ${errors}`));
    });
    child.stdout.on("data", (chunk) => {
      logs += chunk;
      const match = logs.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timeout);
        resolveReady(match[0]);
      }
    });
  });
  return {
    base,
    async stop() {
      if (child.exitCode !== null) return;
      const exited = once(child, "exit");
      child.kill();
      await exited;
    },
  };
}

async function request(server, path, options = {}) {
  const response = await fetch(server.base + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  return {
    status: response.status,
    body: await response.json(),
  };
}
const valid = {
  wardId: "ward-150",
  category: "Waste",
  location: "Near the community park",
  description: "Uncollected waste beside the park entrance.",
};

test("Node HTTP API, validation, authorization and SQLite persistence", async (t) => {
  assert.match(
    process.versions.node,
    /^24\./,
    "Run the integration tests with Node.js 24",
  );
  const temp = await mkdtemp(join(tmpdir(), "sustainiq-test-"));
  const dbPath = join(temp, "reports.sqlite");
  let server;
  let id;
  let otherId;
  try {
    // Simulate an existing database from the previous ownership-based version.
    const legacyId = "00000000-0000-4000-8000-000000000001";
    const legacyDb = openDatabase(dbPath);
    legacyDb.exec(`CREATE TABLE report_owners (
      reportId TEXT PRIMARY KEY REFERENCES reports(id) ON DELETE CASCADE,
      ownerHash TEXT NOT NULL
    )`);
    const now = new Date().toISOString();
    legacyDb
      .prepare(
        "INSERT INTO reports (id, wardId, category, location, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        legacyId,
        valid.wardId,
        valid.category,
        valid.location,
        valid.description,
        now,
        now,
      );
    legacyDb
      .prepare(
        "INSERT INTO report_events (reportId, status, createdAt) VALUES (?, ?, ?)",
      )
      .run(legacyId, "Submitted", now);
    legacyDb
      .prepare("INSERT INTO report_owners (reportId, ownerHash) VALUES (?, ?)")
      .run(legacyId, "legacy-owner-hash");
    legacyDb.close();
    server = await launch(dbPath);
    await t.test(
      "previously published reports can be deleted without credentials",
      async () => {
        const path = `/api/reports/${legacyId}`;
        const result = await request(server, path);
        assert.equal(result.status, 200);
        assert.equal(result.body.report.history.length, 1);
        assert.equal(
          (await request(server, path, { method: "DELETE" })).status,
          200,
        );
        assert.equal((await request(server, path)).status, 404);
        const inspection = openDatabase(dbPath);
        try {
          assert.equal(
            inspection
              .prepare(
                "SELECT COUNT(*) AS count FROM report_owners WHERE reportId = ?",
              )
              .get(legacyId).count,
            0,
          );
          assert.equal(
            inspection
              .prepare(
                "SELECT COUNT(*) AS count FROM report_events WHERE reportId = ?",
              )
              .get(legacyId).count,
            0,
          );
        } finally {
          inspection.close();
        }
      },
    );
    await t.test("health and ward dataset metadata", async () => {
      assert.equal((await request(server, "/api/health")).status, 200);
      const result = await request(server, "/api/wards");
      assert.equal(result.body.illustrative, true);
      assert.equal(result.body.wards.length, wards.length);
      assert.equal(calculateIndex({ aq: 100, wq: 100, te: 100, wm: 100 }), 100);
      assert.equal(calculateIndex({ aq: 0, wq: 0, te: 0, wm: 0 }), 0);
      assert.equal(calculateIndex(wards[0].scores), 42.5);
    });
    await t.test("valid submission starts with one history event", async () => {
      const result = await request(server, "/api/reports", {
        method: "POST",
        body: JSON.stringify(valid),
      });
      assert.equal(result.status, 201);
      id = result.body.report.id;
      assert.equal(result.body.report.status, "Submitted");
      assert.equal(result.body.report.history.length, 1);
    });
    await t.test(
      "server rejects invalid, malformed, unsupported and oversized bodies",
      async () => {
        for (const input of [
          {},
          { ...valid, wardId: "unknown" },
          { ...valid, category: "Other" },
          { ...valid, location: "  " },
          { ...valid, description: 123 },
          { ...valid, description: "short" },
          { ...valid, status: "Resolved" },
          null,
          [],
        ]) {
          assert.equal(
            (
              await request(server, "/api/reports", {
                method: "POST",
                body: JSON.stringify(input),
              })
            ).status,
            400,
          );
        }
        assert.equal(
          (await request(server, "/api/reports", { method: "POST", body: "{" }))
            .status,
          400,
        );
        assert.equal(
          (
            await request(server, "/api/reports", {
              method: "POST",
              headers: { "Content-Type": "text/plain" },
              body: "{}",
            })
          ).status,
          415,
        );
        assert.equal(
          (
            await request(server, "/api/reports", {
              method: "POST",
              body: JSON.stringify({
                ...valid,
                description: "x".repeat(20000),
              }),
            })
          ).status,
          413,
        );
        assert.equal(
          (await request(server, "/api/reports?limit=-1")).status,
          400,
        );
        assert.equal(
          (await request(server, "/api/reports?status=invalid")).status,
          400,
        );
        assert.equal(
          (await request(server, "/api/reports?wardId=invalid")).status,
          400,
        );
        assert.equal(
          (
            await request(
              server,
              "/api/reports/00000000-0000-0000-0000-000000000000",
            )
          ).status,
          404,
        );
      },
    );
    await t.test(
      "status updates require a valid token and status",
      async () => {
        const path = `/api/reports/${id}/status`;
        for (const headers of [{}, { Authorization: "Bearer wrong" }]) {
          assert.equal(
            (
              await request(server, path, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ status: "Resolved" }),
              })
            ).status,
            401,
          );
        }
        const headers = { Authorization: `Bearer ${token}` };
        assert.equal(
          (
            await request(server, path, {
              method: "PATCH",
              headers,
              body: JSON.stringify({ status: "invalid" }),
            })
          ).status,
          400,
        );
        const result = await request(server, path, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ status: "In progress" }),
        });
        assert.equal(result.status, 200);
        assert.equal(result.body.report.history.length, 2);
        assert.equal(result.body.report.status, "In progress");
        const repeated = await request(server, path, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ status: "In progress" }),
        });
        assert.equal(repeated.body.report.history.length, 2);
      },
    );
    await t.test("filtering, pagination and aggregate counts", async () => {
      const result = await request(
        server,
        "/api/reports?wardId=ward-150&status=In%20progress&limit=1",
      );
      assert.equal(result.body.total, 1);
      assert.equal(result.body.reports[0].id, id);
      assert.equal(result.body.counts["In progress"], 1);
      assert.equal(
        (await request(server, "/api/reports?offset=1")).body.reports.length,
        0,
      );
    });
    await t.test(
      "production serves the built SPA and keeps private files inaccessible",
      async () => {
        const response = await fetch(server.base);
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.match(html, /SustainIQ/);
        const asset = html.match(/src="([^"]+\.js)"/)[1];
        assert.equal((await fetch(server.base + asset)).status, 200);
        assert.equal((await fetch(server.base + "/ward-explorer")).status, 200);
        for (const path of [
          "/.env",
          "/server/index.js",
          "/data/reports.sqlite",
          "/backups/original-project.zip",
        ]) {
          assert.equal((await fetch(server.base + path)).status, 404);
        }
      },
    );
    await server.stop();
    server = null;
    server = await launch(dbPath);
    await t.test(
      "report, status and audit history survive a process restart",
      async () => {
        const result = await request(server, `/api/reports/${id}`);
        assert.equal(result.status, 200);
        assert.equal(result.body.report.description, valid.description);
        assert.equal(result.body.report.status, "In progress");
        assert.deepEqual(
          result.body.report.history.map((event) => event.status),
          ["Submitted", "In progress"],
        );
        const updated = await request(server, `/api/reports/${id}/status`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: "Resolved" }),
        });
        assert.equal(updated.body.report.history.length, 3);
        assert.equal(
          (await request(server, "/api/reports")).body.counts.Resolved,
          1,
        );
      },
    );
    await server.stop();
    server = null;
    server = await launch(dbPath, "");
    await t.test("unset ADMIN_TOKEN disables updates", async () => {
      const result = await request(server, `/api/reports/${id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "Submitted" }),
      });
      assert.equal(result.status, 503);
      assert.equal(
        (await request(server, `/api/reports/${id}`)).body.report.status,
        "Resolved",
      );
    });
    await t.test(
      "deletion needs no token or cookies and updates list and counts",
      async () => {
        const retained = await request(server, "/api/reports", {
          method: "POST",
          body: JSON.stringify(valid),
        });
        otherId = retained.body.report.id;
        const result = await request(server, `/api/reports/${id}`, {
          method: "DELETE",
        });
        assert.equal(result.status, 200);
        assert.equal(result.body.deleted, id);
        assert.equal((await request(server, `/api/reports/${id}`)).status, 404);
        assert.equal(
          (await request(server, `/api/reports/${otherId}`)).status,
          200,
        );
        const list = await request(server, "/api/reports");
        assert.equal(list.body.total, 1);
        assert.equal(list.body.counts.Resolved, 0);
        assert.equal(list.body.counts.Submitted, 1);
        assert.equal(list.body.reports[0].id, otherId);
        assert.equal(
          (await request(server, `/api/reports/${id}`, { method: "DELETE" }))
            .status,
          404,
        );
      },
    );
    await server.stop();
    server = null;
    server = await launch(dbPath);
    await t.test(
      "deletion and history cleanup persist after restart",
      async () => {
        assert.equal((await request(server, `/api/reports/${id}`)).status, 404);
        assert.equal(
          (await request(server, `/api/reports/${otherId}`)).status,
          200,
        );
        const inspection = openDatabase(dbPath);
        try {
          assert.equal(
            inspection
              .prepare(
                "SELECT COUNT(*) AS count FROM report_events WHERE reportId = ?",
              )
              .get(id).count,
            0,
          );
          assert.equal(
            inspection
              .prepare(
                "SELECT COUNT(*) AS count FROM report_events WHERE reportId = ?",
              )
              .get(otherId).count,
            1,
          );
        } finally {
          inspection.close();
        }
        const deleted = await request(server, `/api/reports/${otherId}`, {
          method: "DELETE",
        });
        assert.equal(deleted.status, 200);
        const list = await request(server, "/api/reports");
        assert.equal(list.body.total, 0);
        assert.equal(
          Object.values(list.body.counts).reduce(
            (sum, count) => sum + count,
            0,
          ),
          0,
        );
      },
    );
  } finally {
    if (server) await server.stop();
    const target = resolve(temp);
    assert.ok(
      target.startsWith(resolve(tmpdir()) + sep) &&
        target.includes("sustainiq-test-"),
    );
    await rm(target, { recursive: true, force: true });
  }
});
