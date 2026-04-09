const API_BASE = "/api";

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export function fetchTasks() {
  return request("/tasks");
}

export function fetchCalendar() {
  return request("/calendar");
}

export function updateTask(id, updates) {
  return request(`/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function submitTriage(dispositions) {
  return request("/triage", {
    method: "POST",
    body: JSON.stringify({ dispositions }),
  });
}
