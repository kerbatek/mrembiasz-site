import assert from "node:assert/strict";
import test from "node:test";

import {
  createTodo,
  deleteTodo,
  listTodos,
  updateTodo,
} from "../src/lib/todoApi.js";

function mockFetch(responseBody) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, init });

    return {
      ok: true,
      status: 200,
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
      completed: false,
      createdAt: "2026-07-19T09:00:00.000Z",
      updatedAt: "2026-07-19T09:00:00.000Z",
    },
  ]);

  const todos = await listTodos({ apiBaseUrl: "https://api.example.com", fetch });

  assert.equal(calls[0].url, "https://api.example.com/todos");
  assert.equal(calls[0].init.method, "GET");
  assert.deepEqual(todos, [
    {
      id: "task-1",
      title: "Pay invoice",
      completed: false,
      createdAt: new Date("2026-07-19T09:00:00.000Z"),
      updatedAt: new Date("2026-07-19T09:00:00.000Z"),
    },
  ]);
});

test("createTodo posts a title and trims surrounding whitespace", async () => {
  const { calls, fetch } = mockFetch({
    id: "task-2",
    title: "Buy coffee",
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

test("updateTodo patches only provided fields", async () => {
  const { calls, fetch } = mockFetch({
    id: "task-1",
    title: "Pay invoice",
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
