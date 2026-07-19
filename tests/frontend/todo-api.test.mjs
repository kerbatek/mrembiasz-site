import assert from "node:assert/strict";
import test from "node:test";

import {
  createTodo,
  deleteTodo,
  listTodos,
  updateTodo,
} from "../../src/lib/todoApi.js";

function mockFetch(responseBody, options = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, init });

    return {
      ok: options.ok ?? true,
      status: options.status ?? 200,
      async json() {
        return responseBody;
      },
    };
  };

  return { calls, fetch };
}

test("listTodos loads todos from the API base and normalizes dates", async () => {
  const { calls, fetch } = mockFetch([
    {
      id: "task-1",
      title: "Pay invoice",
      priority: 2,
      status: "todo",
      category: "finance",
      description: "Check billing portal.",
      completed: false,
      createdAt: "2026-07-19T09:00:00.000Z",
      updatedAt: "2026-07-19T09:00:00.000Z",
    },
  ]);

  const todos = await listTodos({
    apiBaseUrl: "https://api.example.com",
    fetch,
  });

  assert.equal(calls[0].url, "https://api.example.com/todos");
  assert.equal(calls[0].init.method, "GET");
  assert.deepEqual(todos, [
    {
      id: "task-1",
      title: "Pay invoice",
      priority: 2,
      status: "todo",
      category: "finance",
      description: "Check billing portal.",
      completed: false,
      createdAt: new Date("2026-07-19T09:00:00.000Z"),
      updatedAt: new Date("2026-07-19T09:00:00.000Z"),
    },
  ]);
});

test("listTodos sends bearer token when provided", async () => {
  const { calls, fetch } = mockFetch([]);

  await listTodos({
    apiBaseUrl: "https://api.example.com",
    accessToken: "token",
    fetch,
  });

  assert.equal(calls[0].init.headers.Authorization, "Bearer token");
});

test("listTodos applies defaults when API omits optional fields", async () => {
  const { fetch } = mockFetch([
    {
      id: "task-1",
      title: "Pay invoice",
      completed: true,
      createdAt: null,
      updatedAt: null,
    },
  ]);

  const todos = await listTodos({
    apiBaseUrl: "https://api.example.com",
    fetch,
  });

  assert.deepEqual(todos, [
    {
      id: "task-1",
      title: "Pay invoice",
      priority: 0,
      status: "done",
      category: "",
      description: "",
      completed: true,
      createdAt: null,
      updatedAt: null,
    },
  ]);
});

test("createTodo posts a title and trims surrounding whitespace", async () => {
  const { calls, fetch } = mockFetch({
    id: "task-2",
    title: "Buy coffee",
    priority: 0,
    status: "todo",
    category: "",
    description: "",
    completed: false,
    createdAt: "2026-07-19T10:00:00.000Z",
    updatedAt: "2026-07-19T10:00:00.000Z",
  });

  const todo = await createTodo({
    apiBaseUrl: "https://api.example.com/",
    fetch,
    title: "  Buy coffee  ",
  });

  assert.equal(calls[0].url, "https://api.example.com/todos");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  assert.equal(calls[0].init.body, JSON.stringify({ title: "Buy coffee" }));
  assert.equal(todo.title, "Buy coffee");
});

test("createTodo includes bearer token alongside JSON headers", async () => {
  const { calls, fetch } = mockFetch({
    id: "task-2",
    title: "Buy coffee",
    priority: 0,
    status: "todo",
    category: "",
    description: "",
    completed: false,
    createdAt: "2026-07-19T10:00:00.000Z",
    updatedAt: "2026-07-19T10:00:00.000Z",
  });

  await createTodo({
    apiBaseUrl: "https://api.example.com/",
    accessToken: "token",
    fetch,
    title: "Buy coffee",
  });

  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  assert.equal(calls[0].init.headers.Authorization, "Bearer token");
});

test("createTodo can post full todo metadata", async () => {
  const { calls, fetch } = mockFetch({
    id: "task-2",
    title: "Buy coffee",
    priority: 4,
    status: "in_progress",
    category: "errands",
    description: "Beans",
    completed: false,
    createdAt: "2026-07-19T10:00:00.000Z",
    updatedAt: "2026-07-19T10:00:00.000Z",
  });

  await createTodo({
    apiBaseUrl: "https://api.example.com/",
    fetch,
    title: "Buy coffee",
    priority: 4,
    status: "in_progress",
    category: "errands",
    description: "Beans",
  });

  assert.equal(
    calls[0].init.body,
    JSON.stringify({
      title: "Buy coffee",
      priority: 4,
      status: "in_progress",
      category: "errands",
      description: "Beans",
    }),
  );
});

test("updateTodo patches only provided fields", async () => {
  const { calls, fetch } = mockFetch({
    id: "task-1",
    title: "Pay invoice",
    priority: 3,
    status: "done",
    category: "finance",
    description: "",
    completed: true,
    createdAt: "2026-07-19T09:00:00.000Z",
    updatedAt: "2026-07-19T11:00:00.000Z",
  });

  await updateTodo({
    apiBaseUrl: "https://api.example.com",
    fetch,
    id: "task-1",
    changes: { completed: true },
  });

  assert.equal(calls[0].url, "https://api.example.com/todos/task-1");
  assert.equal(calls[0].init.method, "PATCH");
  assert.equal(calls[0].init.body, JSON.stringify({ completed: true }));
});

test("updateTodo sends rich field changes unchanged", async () => {
  const { calls, fetch } = mockFetch({
    id: "task-1",
    title: "Pay invoice",
    priority: 5,
    status: "in_progress",
    category: "finance",
    description: "Receipt needed",
    completed: false,
    createdAt: "2026-07-19T09:00:00.000Z",
    updatedAt: "2026-07-19T11:00:00.000Z",
  });

  await updateTodo({
    apiBaseUrl: "https://api.example.com",
    fetch,
    id: "task-1",
    changes: {
      priority: 5,
      status: "in_progress",
      category: "finance",
      description: "Receipt needed",
    },
  });

  assert.equal(
    calls[0].init.body,
    JSON.stringify({
      priority: 5,
      status: "in_progress",
      category: "finance",
      description: "Receipt needed",
    }),
  );
});

test("deleteTodo calls the todo resource with DELETE", async () => {
  const { calls, fetch } = mockFetch(null);

  await deleteTodo({
    apiBaseUrl: "https://api.example.com",
    fetch,
    id: "task-1",
  });

  assert.equal(calls[0].url, "https://api.example.com/todos/task-1");
  assert.equal(calls[0].init.method, "DELETE");
});

test("deleteTodo accepts a 204 response without parsing JSON", async () => {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 204,
      async json() {
        throw new Error("json should not be parsed for 204");
      },
    };
  };

  await deleteTodo({
    apiBaseUrl: "https://api.example.com",
    fetch,
    id: "task-1",
  });

  assert.equal(calls[0].init.method, "DELETE");
});

test("API helpers surface backend error messages", async () => {
  const { fetch } = mockFetch(
    { message: "title is required" },
    { ok: false, status: 400 },
  );

  await assert.rejects(
    createTodo({
      apiBaseUrl: "https://api.example.com",
      fetch,
      title: "",
    }),
    /title is required/,
  );
});

test("API helpers use status fallback when error response is not JSON", async () => {
  const fetch = async () => ({
    ok: false,
    status: 502,
    async json() {
      throw new Error("invalid json");
    },
  });

  await assert.rejects(
    listTodos({
      apiBaseUrl: "https://api.example.com",
      fetch,
    }),
    /Todo API request failed with status 502/,
  );
});
