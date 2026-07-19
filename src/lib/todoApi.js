function apiUrl(apiBaseUrl, path) {
  const base = apiBaseUrl.replace(/\/+$/, "");
  return `${base}${path}`;
}

function todoFromApi(todo) {
  return {
    id: String(todo.id),
    title: String(todo.title ?? ""),
    priority: Number.isInteger(todo.priority) ? todo.priority : 0,
    status: String(todo.status ?? (todo.completed ? "done" : "todo")),
    category: String(todo.category ?? ""),
    description: String(todo.description ?? ""),
    completed: Boolean(todo.completed),
    createdAt: todo.createdAt ? new Date(todo.createdAt) : null,
    updatedAt: todo.updatedAt ? new Date(todo.updatedAt) : null,
  };
}

async function parseJson(response) {
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function request({ apiBaseUrl, fetch, path, init }) {
  const response = await fetch(apiUrl(apiBaseUrl, path), init);

  if (!response.ok) {
    let message = `Todo API request failed with status ${response.status}`;

    try {
      const body = await response.json();
      message = body.message || body.error || message;
    } catch {
      // Keep the status-derived fallback.
    }

    throw new Error(message);
  }

  return parseJson(response);
}

export async function listTodos({ apiBaseUrl, fetch = globalThis.fetch }) {
  const body = await request({
    apiBaseUrl,
    fetch,
    path: "/todos",
    init: { method: "GET" },
  });

  return Array.isArray(body) ? body.map(todoFromApi) : [];
}

export async function createTodo({
  apiBaseUrl,
  fetch = globalThis.fetch,
  title,
  priority,
  status,
  category,
  description,
}) {
  const payload = { title: title.trim() };

  if (priority !== undefined) {
    payload.priority = priority;
  }

  if (status !== undefined) {
    payload.status = status;
  }

  if (category !== undefined) {
    payload.category = category;
  }

  if (description !== undefined) {
    payload.description = description;
  }

  const body = await request({
    apiBaseUrl,
    fetch,
    path: "/todos",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  });

  return todoFromApi(body);
}

export async function updateTodo({
  apiBaseUrl,
  fetch = globalThis.fetch,
  id,
  changes,
}) {
  const body = await request({
    apiBaseUrl,
    fetch,
    path: `/todos/${encodeURIComponent(id)}`,
    init: {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    },
  });

  return todoFromApi(body);
}

export async function deleteTodo({
  apiBaseUrl,
  fetch = globalThis.fetch,
  id,
}) {
  await request({
    apiBaseUrl,
    fetch,
    path: `/todos/${encodeURIComponent(id)}`,
    init: { method: "DELETE" },
  });
}
