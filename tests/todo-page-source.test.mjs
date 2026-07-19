import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/pages/todo.astro", import.meta.url), "utf8");

test("todo page exposes create controls for the full todo model", () => {
  for (const marker of [
    "data-title-input",
    "data-priority-input",
    "data-status-input",
    "data-category-input",
    "data-description-input",
  ]) {
    assert.match(source, new RegExp(marker));
  }
});

test("todo page supports status-based filters", () => {
  for (const filter of ['data-filter="all"', 'data-filter="todo"', 'data-filter="in_progress"', 'data-filter="done"']) {
    assert.match(source, new RegExp(filter));
  }
});

test("todo item template exposes editable metadata fields", () => {
  for (const marker of [
    "data-edit-priority",
    "data-edit-status",
    "data-edit-category",
    "data-edit-description",
  ]) {
    assert.match(source, new RegExp(marker));
  }
});

test("todo page exposes Cognito auth controls", () => {
  for (const marker of [
    "data-auth-panel",
    "data-login",
    "data-logout",
    "PUBLIC_TODO_COGNITO_DOMAIN",
    "PUBLIC_TODO_COGNITO_CLIENT_ID",
  ]) {
    assert.match(source, new RegExp(marker));
  }
});
