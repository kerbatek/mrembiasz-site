import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const indexSource = await readFile(
  new URL("../../src/pages/index.astro", import.meta.url),
  "utf8",
);
const todoArchitectureSource = await readFile(
  new URL(
    "../../src/pages/projects/personal-todo-architecture.astro",
    import.meta.url,
  ),
  "utf8",
);
const primaryNavSource = await readFile(
  new URL("../../src/components/PrimaryNav.astro", import.meta.url),
  "utf8",
);

test("homepage lists todo as a project with an architecture case study", () => {
  assert.match(indexSource, /title: "Personal Todo"/);
  assert.match(indexSource, /Lambda \/ DynamoDB \/ Cognito/);
  assert.match(indexSource, /href: "\/projects\/personal-todo-architecture\/"/);
});

test("todo architecture page follows the project case study structure", () => {
  for (const marker of [
    "Personal Todo Architecture Case Study",
    "Overview",
    "Architecture",
    "Key decisions",
    "Request flow",
    "Next phases",
    "AWS Lambda",
    "DynamoDB",
    "Cognito",
    "GitLab CI",
  ]) {
    assert.match(todoArchitectureSource, new RegExp(marker));
  }
});

test("primary navigation links to todo architecture", () => {
  assert.match(
    primaryNavSource,
    /href: "\/projects\/personal-todo-architecture\/"/,
  );
  assert.match(primaryNavSource, /label: "Todo architecture"/);
});
