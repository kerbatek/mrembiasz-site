import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../../src/pages/todo.astro", import.meta.url),
  "utf8",
);
const controllerSource = await readFile(
  new URL("../../src/lib/todoPage.ts", import.meta.url),
  "utf8",
);
const packageSource = await readFile(
  new URL("../../package.json", import.meta.url),
  "utf8",
);
const globalStyleSource = await readFile(
  new URL("../../src/styles/global.css", import.meta.url),
  "utf8",
);
const todoStyleSource = await readFile(
  new URL("../../src/styles/todo.css", import.meta.url),
  "utf8",
);

test("todo page keeps todo-specific styles in todo stylesheet", () => {
  assert.match(source, /import "\.\.\/styles\/todo\.css";/);
  assert.doesNotMatch(globalStyleSource, /\.todo-/);
  assert.match(todoStyleSource, /\.todo-shell/);
});

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
  for (const filter of [
    'data-filter="all"',
    'data-filter="todo"',
    'data-filter="in_progress"',
    'data-filter="done"',
  ]) {
    assert.match(source, new RegExp(filter));
  }
});

test("all filter is labeled as not done and excludes done tasks", () => {
  assert.match(source, />\s*All \(not done\)\s*<\/button>/);
  assert.match(
    controllerSource,
    /activeFilter === "all"[\s\S]*todos\.filter\(\(todo\) => !isDoneTodo\(todo\)\)/,
  );
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

test("todo item edits are autosave-only", () => {
  assert.doesNotMatch(source, /todo-save/);
  assert.doesNotMatch(source, />Save</);
  assert.doesNotMatch(controllerSource, /data-edit-form/);
});

test("todo item edits update local state before autosave request", () => {
  const updateIndex = controllerSource.indexOf(
    "async function updateExistingTodo",
  );
  const optimisticIndex = controllerSource.indexOf(
    "applyLocalTodoChanges(todo, normalizedChanges)",
    updateIndex,
  );
  const pendingIndex = controllerSource.indexOf(
    "await withPending",
    updateIndex,
  );
  const rollbackIndex = controllerSource.indexOf(
    "restoreLocalTodo(todo)",
    pendingIndex,
  );

  assert.notEqual(updateIndex, -1);
  assert.notEqual(optimisticIndex, -1);
  assert.notEqual(pendingIndex, -1);
  assert.ok(optimisticIndex < pendingIndex);
  assert.notEqual(rollbackIndex, -1);
});

test("todo page exposes Cognito auth controls", () => {
  for (const marker of ["data-auth-panel", "data-login", "data-logout"]) {
    assert.match(source, new RegExp(marker));
  }

  for (const marker of [
    "PUBLIC_TODO_COGNITO_DOMAIN",
    "PUBLIC_TODO_COGNITO_CLIENT_ID",
  ]) {
    assert.match(controllerSource, new RegExp(marker));
  }
});

test("todo preview can render an injected sample task", () => {
  assert.match(controllerSource, /PUBLIC_TODO_PREVIEW_SAMPLE/);
  assert.match(controllerSource, /Preview deployment smoke test/);
  assert.match(packageSource, /PUBLIC_TODO_PREVIEW_SAMPLE=1/);
});

test("todo items sort by highest priority first", () => {
  assert.match(controllerSource, /sortTodosByPriority/);
  assert.match(controllerSource, /right\.priority - left\.priority/);
});

test("todo sorting keeps done tasks after active tasks", () => {
  assert.match(controllerSource, /function isDoneTodo/);
  assert.match(
    controllerSource,
    /Number\(isDoneTodo\(left\)\) - Number\(isDoneTodo\(right\)\)/,
  );
});

test("done todo styling crosses out every editable field", () => {
  for (const selector of [
    "[data-edit-title]",
    "[data-edit-priority]",
    "[data-edit-status]",
    "[data-edit-category]",
    "[data-edit-description]",
  ]) {
    for (const stateSelector of [
      '.todo-item[data-completed="true"]',
      '.todo-item[data-status="done"]',
    ]) {
      const selectorIndex = todoStyleSource.indexOf(
        `${stateSelector} ${selector}`,
      );
      const decorationIndex = todoStyleSource.indexOf(
        "text-decoration: line-through;",
        selectorIndex,
      );
      const ruleEndIndex = todoStyleSource.indexOf("}", selectorIndex);

      assert.notEqual(selectorIndex, -1);
      assert.notEqual(decorationIndex, -1);
      assert.ok(decorationIndex < ruleEndIndex);
    }
  }
});

test("mobile todo edit fields render in the requested order", () => {
  for (const [selector, order] of [
    ["data-edit-title", 1],
    ["data-edit-category", 2],
    ["data-edit-status", 3],
    ["data-edit-description", 4],
    ["data-edit-priority", 5],
  ]) {
    const selectorIndex = todoStyleSource.indexOf(`.todo-edit [${selector}]`);
    const orderIndex = todoStyleSource.indexOf(
      `order: ${order};`,
      selectorIndex,
    );
    const ruleEndIndex = todoStyleSource.indexOf("}", selectorIndex);

    assert.notEqual(selectorIndex, -1);
    assert.notEqual(orderIndex, -1);
    assert.ok(orderIndex < ruleEndIndex);
  }
});

test("mobile create fields render in the same order as todo items", () => {
  for (const [selector, order] of [
    ["data-title-input", 1],
    ["data-category-input", 2],
    ["data-status-input", 3],
    ["data-description-input", 4],
    ["data-priority-input", 5],
  ]) {
    const selectorIndex = todoStyleSource.indexOf(`.todo-form [${selector}]`);
    const orderIndex = todoStyleSource.indexOf(
      `order: ${order};`,
      selectorIndex,
    );
    const ruleEndIndex = todoStyleSource.indexOf("}", selectorIndex);

    assert.notEqual(selectorIndex, -1);
    assert.notEqual(orderIndex, -1);
    assert.ok(orderIndex < ruleEndIndex);
  }
});

test("mobile todo count text is centered", () => {
  const mediaIndex = todoStyleSource.indexOf("@media (max-width: 520px)");
  const selectorIndex = todoStyleSource.indexOf(".todo-count {", mediaIndex);
  const alignmentIndex = todoStyleSource.indexOf(
    "text-align: center;",
    selectorIndex,
  );
  const ruleEndIndex = todoStyleSource.indexOf("}", selectorIndex);

  assert.notEqual(mediaIndex, -1);
  assert.notEqual(selectorIndex, -1);
  assert.notEqual(alignmentIndex, -1);
  assert.ok(alignmentIndex < ruleEndIndex);
});

test("todo count badge centers its content vertically", () => {
  const selectorIndex = todoStyleSource.indexOf(".todo-count {");
  const displayIndex = todoStyleSource.indexOf(
    "display: inline-flex;",
    selectorIndex,
  );
  const alignIndex = todoStyleSource.indexOf(
    "align-items: center;",
    selectorIndex,
  );
  const ruleEndIndex = todoStyleSource.indexOf("}", selectorIndex);

  assert.notEqual(selectorIndex, -1);
  assert.notEqual(displayIndex, -1);
  assert.notEqual(alignIndex, -1);
  assert.ok(displayIndex < ruleEndIndex);
  assert.ok(alignIndex < ruleEndIndex);
});

test("todo description fields are not manually resizable", () => {
  for (const selector of [".todo-form textarea", ".todo-edit textarea"]) {
    const selectorIndex = todoStyleSource.lastIndexOf(`${selector} {`);
    const resizeIndex = todoStyleSource.indexOf("resize: none;", selectorIndex);
    const overflowIndex = todoStyleSource.indexOf(
      "overflow-y: hidden;",
      selectorIndex,
    );
    const ruleEndIndex = todoStyleSource.indexOf("}", selectorIndex);

    assert.notEqual(selectorIndex, -1);
    assert.notEqual(resizeIndex, -1);
    assert.notEqual(overflowIndex, -1);
    assert.ok(resizeIndex < ruleEndIndex);
    assert.ok(overflowIndex < ruleEndIndex);
  }
});

test("todo description textareas auto-grow instead of scrolling", () => {
  assert.match(source, /data-autosize-textarea/);
  assert.match(controllerSource, /function autosizeTextarea/);
  assert.match(controllerSource, /scrollHeight/);
  assert.match(controllerSource, /bindAutosizeTextarea\(descriptionInput\)/);
  assert.match(controllerSource, /autosizeTextarea\(editDescription\)/);
});
