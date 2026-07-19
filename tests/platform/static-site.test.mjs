import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const deployScriptSource = await readFile(
  new URL("../../scripts/deploy-static-site.sh", import.meta.url),
  "utf8",
);

test("static deploy injects todo API and Cognito public config", () => {
  for (const marker of [
    "PUBLIC_TODO_API_BASE_URL",
    "PUBLIC_TODO_COGNITO_DOMAIN",
    "PUBLIC_TODO_COGNITO_CLIENT_ID",
    "PUBLIC_TODO_COGNITO_REDIRECT_URI",
    "PUBLIC_TODO_COGNITO_LOGOUT_URI",
    "infra/aws-personal-todo",
  ]) {
    assert.match(deployScriptSource, new RegExp(marker));
  }
});
