function apiUrl(apiBaseUrl, path) {
  const base = trimTrailingSlashes(apiBaseUrl);
  return `${base}${path}`;
}

function trimTrailingSlashes(value) {
  const text = String(value || "");
  let end = text.length;

  while (end > 0 && text[end - 1] === "/") {
    end -= 1;
  }

  return text.slice(0, end);
}

function todoFromApi(todo) {
  const completed = Boolean(todo.completed);

  return {
    id: String(todo.id),
    title: String(todo.title ?? ""),
    priority: Number.isInteger(todo.priority) ? todo.priority : 0,
    status: todoStatus(todo.status, completed),
    category: String(todo.category ?? ""),
    description: String(todo.description ?? ""),
    completed,
    createdAt: dateOrNull(todo.createdAt),
    updatedAt: dateOrNull(todo.updatedAt),
  };
}

function todoStatus(status, completed) {
  return String(status ?? (completed ? "done" : "todo"));
}

function dateOrNull(value) {
  return value ? new Date(value) : null;
}

async function parseJson(response) {
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function headersWithAccessToken(headers = {}, accessToken) {
  if (!accessToken) {
    return headers;
  }

  return {
    ...headers,
    Authorization: `Bearer ${accessToken}`,
  };
}

async function request({ apiBaseUrl, accessToken, fetch, path, init }) {
  const response = await fetch(apiUrl(apiBaseUrl, path), {
    ...init,
    headers: headersWithAccessToken(init.headers, accessToken),
  });

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

export async function listTodos({
  apiBaseUrl,
  accessToken,
  fetch = globalThis.fetch,
}) {
  const body = await request({
    apiBaseUrl,
    accessToken,
    fetch,
    path: "/todos",
    init: { method: "GET" },
  });

  return Array.isArray(body) ? body.map(todoFromApi) : [];
}

export async function createTodo({
  apiBaseUrl,
  accessToken,
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
    accessToken,
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
  accessToken,
  fetch = globalThis.fetch,
  id,
  changes,
}) {
  const body = await request({
    apiBaseUrl,
    accessToken,
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
  accessToken,
  fetch = globalThis.fetch,
  id,
}) {
  await request({
    apiBaseUrl,
    accessToken,
    fetch,
    path: `/todos/${encodeURIComponent(id)}`,
    init: { method: "DELETE" },
  });
}
