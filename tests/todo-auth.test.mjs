import assert from "node:assert/strict";
import test from "node:test";

import {
  beginTodoLogin,
  clearTodoSession,
  completeTodoLogin,
  getStoredTodoSession,
  todoLogoutUrl,
} from "../src/lib/todoAuth.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

const authConfig = {
  domain: "https://auth.example.com",
  clientId: "client-123",
  redirectUri: "https://site.example.com/todo/",
  scopes: "openid email profile",
};

test("beginTodoLogin builds Cognito Hosted UI URL and stores PKCE verifier", async () => {
  const storage = memoryStorage();
  const crypto = {
    getRandomValues(bytes) {
      bytes.fill(7);
      return bytes;
    },
    subtle: {
      async digest() {
        return new Uint8Array(32).fill(9).buffer;
      },
    },
  };

  const url = await beginTodoLogin({
    ...authConfig,
    storage,
    crypto,
    location: { assign() {} },
  });

  assert.equal(url.origin, "https://auth.example.com");
  assert.equal(url.pathname, "/oauth2/authorize");
  assert.equal(url.searchParams.get("client_id"), "client-123");
  assert.equal(url.searchParams.get("redirect_uri"), "https://site.example.com/todo/");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("scope"), "openid email profile");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.ok(url.searchParams.get("code_challenge"));
  assert.ok(storage.getItem("todoPkceVerifier"));
  assert.equal(storage.getItem("todoOAuthState"), url.searchParams.get("state"));
});

test("completeTodoLogin exchanges redirect code and stores access token session", async () => {
  const storage = memoryStorage({
    todoPkceVerifier: "verifier",
    todoOAuthState: "state-123",
  });
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          access_token: "access-token",
          id_token: "id-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
          token_type: "Bearer",
        };
      },
    };
  };

  const session = await completeTodoLogin({
    ...authConfig,
    storage,
    fetch,
    now: () => 1000,
    currentUrl: "https://site.example.com/todo/?code=code-123&state=state-123",
    history: { replaceState() {} },
  });

  assert.equal(session.accessToken, "access-token");
  assert.equal(session.idToken, "id-token");
  assert.equal(session.refreshToken, "refresh-token");
  assert.equal(session.expiresAt, 3601000);
  assert.equal(calls[0].url, "https://auth.example.com/oauth2/token");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(
    calls[0].init.body.toString(),
    "grant_type=authorization_code&client_id=client-123&code=code-123&redirect_uri=https%3A%2F%2Fsite.example.com%2Ftodo%2F&code_verifier=verifier",
  );
  assert.equal(storage.getItem("todoAccessToken"), "access-token");
  assert.equal(storage.getItem("todoPkceVerifier"), null);
  assert.equal(storage.getItem("todoOAuthState"), null);
});

test("completeTodoLogin rejects redirects with mismatched state", async () => {
  await assert.rejects(
    completeTodoLogin({
      ...authConfig,
      storage: memoryStorage({
        todoPkceVerifier: "verifier",
        todoOAuthState: "expected-state",
      }),
      currentUrl: "https://site.example.com/todo/?code=code-123&state=wrong-state",
    }),
    /OAuth state did not match/,
  );
});

test("getStoredTodoSession ignores expired sessions", () => {
  const storage = memoryStorage({
    todoAccessToken: "access-token",
    todoTokenExpiresAt: "999",
  });

  assert.equal(getStoredTodoSession({ storage, now: () => 1000 }), null);
});

test("clearTodoSession removes all Cognito token state", () => {
  const storage = memoryStorage({
    todoAccessToken: "access-token",
    todoIdToken: "id-token",
    todoRefreshToken: "refresh-token",
    todoTokenExpiresAt: "1000",
    todoPkceVerifier: "verifier",
    todoOAuthState: "state",
  });

  clearTodoSession({ storage });

  for (const key of [
    "todoAccessToken",
    "todoIdToken",
    "todoRefreshToken",
    "todoTokenExpiresAt",
    "todoPkceVerifier",
    "todoOAuthState",
  ]) {
    assert.equal(storage.getItem(key), null);
  }
});

test("todoLogoutUrl clears local session and builds hosted UI logout URL", () => {
  const storage = memoryStorage({ todoAccessToken: "access-token" });

  const url = todoLogoutUrl({
    domain: "https://auth.example.com/",
    clientId: "client-123",
    logoutUri: "https://site.example.com/todo/",
    storage,
  });

  assert.equal(storage.getItem("todoAccessToken"), null);
  assert.equal(url.toString(), "https://auth.example.com/logout?client_id=client-123&logout_uri=https%3A%2F%2Fsite.example.com%2Ftodo%2F");
});
