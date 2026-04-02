import { readFileSync } from "fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Load .env into process.env for server-side API plugin
try {
  const env = readFileSync(".env", "utf-8");
  for (const line of env.split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2] || "";
    }
  }
} catch {}

function apiDevPlugin() {
  return {
    name: "pulse-api-dev",
    configureServer(server) {
      // GET /api/tasks
      server.middlewares.use("/api/tasks", async (req, res, next) => {
        // Let PATCH /api/tasks/:id fall through to the next handler
        const urlPath = req.url || "";
        const idMatch = urlPath.match(/^\/([^/?]+)/);

        if (req.method === "GET" && !idMatch) {
          try {
            const { GET } = await import("./api/tasks.js");
            const request = new Request("http://localhost/api/tasks", {
              method: "GET",
            });
            const response = await GET(request);
            res.statusCode = response.status;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(await response.json()));
          } catch (err) {
            console.error("[api/tasks] Dev handler error:", err.message);
            res.statusCode = 502;
            res.end(JSON.stringify({ error: "Tasks API unavailable" }));
          }
          return;
        }

        if (req.method === "PATCH" && idMatch) {
          const taskId = decodeURIComponent(idMatch[1]);
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          let body;
          try {
            body = JSON.parse(Buffer.concat(chunks).toString());
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Invalid JSON" }));
            return;
          }

          try {
            const { PATCH } = await import("./api/tasks.js");
            const request = new Request(
              `http://localhost/api/tasks/${taskId}`,
              {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
              },
            );
            const response = await PATCH(request, taskId);
            res.statusCode = response.status;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(await response.json()));
          } catch (err) {
            console.error("[api/tasks/:id] Dev handler error:", err.message);
            res.statusCode = 502;
            res.end(JSON.stringify({ error: "Task update unavailable" }));
          }
          return;
        }

        next();
      });

      // POST /api/triage
      server.middlewares.use("/api/triage", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        let body;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString());
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid JSON" }));
          return;
        }

        try {
          const { POST } = await import("./api/triage.js");
          const request = new Request("http://localhost/api/triage", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          const response = await POST(request);
          res.statusCode = response.status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(await response.json()));
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
