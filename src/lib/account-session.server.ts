import { getCookie, getRequest, getRequestProtocol, setCookie } from "@tanstack/react-start/server";

const SESSION_COOKIE = "fortebet_proxy_session";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24;
// A response cookie is not part of the incoming request. Keep rotations visible
// to subsequent upstream calls, isolated to this request (never across users).
const requestCookies = new WeakMap<object, Map<string, string>>();

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function readSessionCookies(): Map<string, string> {
  const request = getRequest();
  const current = requestCookies.get(request);
  if (current) return current;
  const cookies = decodeSessionCookies();
  requestCookies.set(request, cookies);
  return cookies;
}

function decodeSessionCookies(): Map<string, string> {
  const encoded = getCookie(SESSION_COOKIE);
  if (!encoded || encoded.length > 4000) return new Map();

  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(encoded));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return new Map();
    return new Map(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(entry[0]) && typeof entry[1] === "string",
      ),
    );
  } catch {
    return new Map();
  }
}

function writeSessionCookies(cookies: Map<string, string>) {
  // The editor preview runs the app inside a cross-site frame, where browsers
  // drop SameSite=Lax cookies. A Secure, partitioned SameSite=None cookie is
  // kept there and still works top-level (browsers treat localhost as secure).
  const options = {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "none" as const,
    partitioned: true,
  };
  if (cookies.size === 0) {
    setCookie(SESSION_COOKIE, "", { ...options, maxAge: 0 });
    return;
  }

  const encoded = encodeBase64Url(JSON.stringify(Object.fromEntries(cookies)));
  // Browsers reject cookies larger than roughly 4 KB. Never silently store a
  // truncated session cookie that would be unusable on the next API request.
  if (encoded.length > 3500) {
    cookies.clear();
    setCookie(SESSION_COOKIE, "", { ...options, maxAge: 0 });
    throw new Error("The account session could not be stored. Please sign in again.");
  }

  setCookie(SESSION_COOKIE, encoded, { ...options, maxAge: SESSION_COOKIE_MAX_AGE });
}

export function clearFortebetSessionCookie() {
  requestCookies.set(getRequest(), new Map());
  writeSessionCookies(new Map());
}

export function captureFortebetSessionCookies(response: Response) {
  const responseHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
  const combined = response.headers.get("set-cookie");
  // Split only at the start of another cookie, not the comma in Expires.
  const setCookieHeaders = responseHeaders.getSetCookie?.() ??
    (combined ? combined.split(/,(?=\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=)/) : []);
  if (setCookieHeaders.length === 0) return;

  const cookies = readSessionCookies();
  for (const header of setCookieHeaders) {
    const [cookiePair = "", ...attributes] = header.split(";");
    const separator = cookiePair.indexOf("=");
    if (separator <= 0) continue;

    const name = cookiePair.slice(0, separator).trim();
    const value = cookiePair.slice(separator + 1).trim();
    if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name)) continue;

    const expired = attributes.some((attribute) => {
      const trimmed = attribute.trim();
      const age = /^max-age\s*=\s*(-?\d+)$/i.exec(trimmed);
      if (age) return Number(age[1]) <= 0;
      const expires = /^expires\s*=\s*(.+)$/i.exec(trimmed);
      return Boolean(expires && Date.parse(expires[1] ?? '') <= Date.now());
    });
    if (expired || !value) cookies.delete(name);
    else cookies.set(name, value);
  }
  writeSessionCookies(cookies);
}

export function getFortebetSessionCookieHeader() {
  return [...readSessionCookies()].map(([name, value]) => `${name}=${value}`).join("; ");
}
