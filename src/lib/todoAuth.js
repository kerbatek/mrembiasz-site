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
  return btoa(binary).split("+").join("-").split("/").join("_").split("=")[0];
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
  return trimTrailingSlashes(domain);
}

function trimTrailingSlashes(value) {
  const text = String(value || "");
  let end = text.length;

  while (end > 0 && text[end - 1] === "/") {
    end -= 1;
  }

  return text.slice(0, end);
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

  const expiresAt = storedExpiresAt(sessionStorage);

  if (isExpired(expiresAt, now)) {
    clearTodoSession({ storage: sessionStorage });
    return null;
  }

  return sessionFromStorage(sessionStorage, accessToken, expiresAt);
}

function storedExpiresAt(storage) {
  return Number.parseInt(storage.getItem(EXPIRES_AT_KEY) || "0", 10);
}

function isExpired(expiresAt, now) {
  return Boolean(expiresAt && expiresAt <= now());
}

function sessionFromStorage(storage, accessToken, expiresAt) {
  return {
    accessToken,
    idToken: storage.getItem(ID_TOKEN_KEY) || "",
    refreshToken: storage.getItem(REFRESH_TOKEN_KEY) || "",
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
  const redirect = redirectParams(url);

  if (!redirect.code) {
    return getStoredTodoSession({ storage, now });
  }

  const sessionStorage = storageOrDefault(storage);
  const verifier = verifiedPkceVerifier(sessionStorage, redirect.state);
  const token = await exchangeCodeForToken({
    domain,
    clientId,
    redirectUri,
    code: redirect.code,
    verifier,
    fetch,
  });
  const expiresAt = now() + Number(token.expires_in || 3600) * 1000;

  storeTokenSession(sessionStorage, token, expiresAt);
  clearRedirectParams(url, history);

  return getStoredTodoSession({ storage: sessionStorage, now });
}

function redirectParams(url) {
  return {
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
  };
}

function verifiedPkceVerifier(storage, state) {
  const expectedState = storage.getItem(OAUTH_STATE_KEY);
  const verifier = storage.getItem(PKCE_VERIFIER_KEY);

  if (!expectedState || expectedState !== state) {
    throw new Error("OAuth state did not match");
  }

  if (!verifier) {
    throw new Error("PKCE verifier is missing");
  }

  return verifier;
}

async function exchangeCodeForToken({
  domain,
  clientId,
  redirectUri,
  code,
  verifier,
  fetch,
}) {
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

  return response.json();
}

function storeTokenSession(storage, token, expiresAt) {
  storage.setItem(ACCESS_TOKEN_KEY, token.access_token || "");
  storage.setItem(ID_TOKEN_KEY, token.id_token || "");
  storage.setItem(REFRESH_TOKEN_KEY, token.refresh_token || "");
  storage.setItem(EXPIRES_AT_KEY, String(expiresAt));
  storage.removeItem(PKCE_VERIFIER_KEY);
  storage.removeItem(OAUTH_STATE_KEY);
}

function clearRedirectParams(url, history) {
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  history?.replaceState?.({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function todoLogoutUrl({ domain, clientId, logoutUri, storage }) {
  requireAuthConfig({ domain, clientId, redirectUri: logoutUri });
  clearTodoSession({ storage });

  const url = new URL(`${normalizedDomain(domain)}/logout`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("logout_uri", logoutUri);
  return url;
}
