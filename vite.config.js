import { readFileSync } from "fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Load .env and .env.local into process.env for server-side API plugin.
// Vite auto-loads .env.local for client-side VITE_* vars, but not for
// process.env in dev plugins. .env.local takes precedence over .env.
for (const file of [".env", ".env.local"]) {
  try {
    const env = readFileSync(file, "utf-8");
    for (const line of env.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        process.env[match[1]] = match[2] || "";
      }
    }
  } catch {}
}

function apiDevPlugin() {
  return {
    name: "pulse-api-dev",
    configureServer(server) {
      // Helper: parse JSON body from request
      async function parseBody(req) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        return JSON.parse(Buffer.concat(chunks).toString());
      }

      // GET /api/tasks
      server.middlewares.use("/api/tasks", async (req, res, next) => {
        const urlPath = req.url || "";
        const idMatch = urlPath.match(/^\/([^/?]+)/);

        if (req.method === "GET" && !idMatch) {
          try {
            const handler = (await import("./api/tasks/index.js")).default;
            const mockReq = { method: "GET" };
            const mockRes = {
              status(code) { res.statusCode = code; return this; },
              json(data) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(data)); },
            };
            await handler(mockReq, mockRes);
          } catch (err) {
            console.error("[api/tasks] Dev handler error:", err.message);
            res.statusCode = 502;
            res.end(JSON.stringify({ error: "Tasks API unavailable" }));
          }
          return;
        }

        if (req.method === "PATCH" && idMatch) {
          const taskId = decodeURIComponent(idMatch[1]);
          try {
            const body = await parseBody(req);
            const handler = (await import("./api/tasks/[id].js")).default;
            const mockReq = { method: "PATCH", query: { id: taskId }, body };
            const mockRes = {
              status(code) { res.statusCode = code; return this; },
              json(data) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(data)); },
            };
            await handler(mockReq, mockRes);
          } catch (err) {
            console.error("[api/tasks/:id] Dev handler error:", err.message);
            res.statusCode = 502;
            res.end(JSON.stringify({ error: "Task update unavailable" }));
          }
          return;
        }

        next();
      });

      // GET /api/calendar
      server.middlewares.use("/api/calendar", async (req, res) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        try {
          const handler = (await import("./api/calendar/index.js")).default;
          const mockReq = { method: "GET" };
          const mockRes = {
            status(code) { res.statusCode = code; return this; },
            json(data) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(data)); },
          };
          await handler(mockReq, mockRes);
        } catch (err) {
          console.error("[api/calendar] Dev handler error:", err.message);
          res.statusCode = 502;
          res.end(JSON.stringify({ error: "Calendar API unavailable" }));
        }
      });

      // GET /api/linear
      server.middlewares.use("/api/linear", async (req, res) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        try {
          const handler = (await import("./api/linear/index.js")).default;
          // Parse fresh=1 from query string
          const urlPath = req.url || "";
          const qs = urlPath.includes("?") ? urlPath.split("?")[1] : "";
          const params = new URLSearchParams(qs);
          const mockReq = {
            method: "GET",
            query: { fresh: params.get("fresh") || undefined },
          };
          const mockRes = {
            status(code) { res.statusCode = code; return this; },
            setHeader(k, v) { res.setHeader(k, v); return this; },
            json(data) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(data)); },
          };
          await handler(mockReq, mockRes);
        } catch (err) {
          console.error("[api/linear] Dev handler error:", err.message);
          res.statusCode = 502;
          res.end(JSON.stringify({ error: "Linear API unavailable" }));
        }
      });

      // POST /api/triage
      server.middlewares.use("/api/triage", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        try {
          const body = await parseBody(req);
          const handler = (await import("./api/triage.js")).default;
          const mockReq = { method: "POST", body };
          const mockRes = {
            status(code) { res.statusCode = code; return this; },
            json(data) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(data)); },
          };
          await handler(mockReq, mockRes);
        } catch (err) {
          console.error("[api/triage] Dev handler error:", err.message);
          res.statusCode = 502;
          res.end(JSON.stringify({ error: "Triage API unavailable" }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [apiDevPlugin(), react(), tailwindcss()],
  test: {
    globals: true,
    setupFiles: ["./src/test-setup.js"],
  },
});
