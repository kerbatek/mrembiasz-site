const ACCESS_TOKEN_KEY = "todoAccessToken";
const ID_TOKEN_KEY = "todoIdToken";
const REFRESH_TOKEN_KEY = "todoRefreshToken";
const EXPIRES_AT_KEY = "todoTokenExpiresAt";
const PKCE_VERIFIER_KEY = "todoPkceVerifier";
const OAUTH_STATE_KEY = "todoOAuthState";

const SESSION_KEYS = [
  ACCESS_TOKEN_KEY,
  ID_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  EXPIRES_AT_KEY,
  PKCE_VERIFIER_KEY,
  OAUTH_STATE_KEY,
];

function storageOrDefault(storage) {
  return storage || globalThis.localStorage;
}

function cryptoOrDefault(crypto) {
  return crypto || globalThis.crypto;
}

function base64Url(bytes) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomString(crypto, byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256Base64Url(value, crypto) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return base64Url(new Uint8Array(digest));
}

function normalizedDomain(domain) {
  return String(domain || "").replace(/\/+$/, "");
}

function requireAuthConfig({ domain, clientId, redirectUri }) {
  if (!domain || !clientId || !redirectUri) {
    throw new Error("Cognito auth is not configured");
  }
}

export function getStoredTodoSession({ storage, now = () => Date.now() } = {}) {
  const sessionStorage = storageOrDefault(storage);
  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);

  if (!accessToken) {
    return null;
  }

  const expiresAt = Number.parseInt(
    sessionStorage.getItem(EXPIRES_AT_KEY) || "0",
    10,
  );

  if (expiresAt && expiresAt <= now()) {
    clearTodoSession({ storage: sessionStorage });
    return null;
  }

  return {
    accessToken,
    idToken: sessionStorage.getItem(ID_TOKEN_KEY) || "",
    refreshToken: sessionStorage.getItem(REFRESH_TOKEN_KEY) || "",
    expiresAt,
  };
}

export function clearTodoSession({ storage } = {}) {
  const sessionStorage = storageOrDefault(storage);

  for (const key of SESSION_KEYS) {
    sessionStorage.removeItem(key);
  }
}

export async function beginTodoLogin({
  domain,
  clientId,
  redirectUri,
  scopes = "openid email profile",
  storage,
  crypto,
  location,
}) {
  requireAuthConfig({ domain, clientId, redirectUri });

  const sessionStorage = storageOrDefault(storage);
  const browserCrypto = cryptoOrDefault(crypto);
  const verifier = randomString(browserCrypto, 48);
  const state = randomString(browserCrypto, 24);
  const challenge = await sha256Base64Url(verifier, browserCrypto);
  const url = new URL(`${normalizedDomain(domain)}/oauth2/authorize`);

  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("state", state);

  if (location?.assign) {
    location.assign(url.toString());
  }

  return url;
}

export async function completeTodoLogin({
  domain,
  clientId,
  redirectUri,
  storage,
  fetch = globalThis.fetch,
  now = () => Date.now(),
  currentUrl = globalThis.location.href,
  history = globalThis.history,
}) {
  requireAuthConfig({ domain, clientId, redirectUri });

  const url = new URL(currentUrl);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    return getStoredTodoSession({ storage, now });
  }

  const sessionStorage = storageOrDefault(storage);
  const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);

  if (!expectedState || expectedState !== state) {
    throw new Error("OAuth state did not match");
  }

  if (!verifier) {
    throw new Error("PKCE verifier is missing");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  const response = await fetch(`${normalizedDomain(domain)}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(
      `Cognito token exchange failed with status ${response.status}`,
    );
  }

  const token = await response.json();
  const expiresAt = now() + Number(token.expires_in || 3600) * 1000;

  sessionStorage.setItem(ACCESS_TOKEN_KEY, token.access_token || "");
  sessionStorage.setItem(ID_TOKEN_KEY, token.id_token || "");
  sessionStorage.setItem(REFRESH_TOKEN_KEY, token.refresh_token || "");
  sessionStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);

  url.searchParams.delete("code");
  url.searchParams.delete("state");
  history?.replaceState?.({}, "", `${url.pathname}${url.search}${url.hash}`);

  return getStoredTodoSession({ storage: sessionStorage, now });
}

export function todoLogoutUrl({ domain, clientId, logoutUri, storage }) {
  requireAuthConfig({ domain, clientId, redirectUri: logoutUri });
  clearTodoSession({ storage });

  const url = new URL(`${normalizedDomain(domain)}/logout`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("logout_uri", logoutUri);
  return url;
}
