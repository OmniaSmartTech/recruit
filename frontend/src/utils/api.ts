const API_BASE = "/api";
const AIONE_AUTH_BASE = "https://auth.aione.uk";

// --- PIN management ---

export function getPin(): string | null {
  return sessionStorage.getItem("recruitsmart_pin");
}

export function setPin(pin: string) {
  sessionStorage.setItem("recruitsmart_pin", pin);
}

export function getPinType(): string | null {
  return sessionStorage.getItem("recruitsmart_pin_type");
}

export function setPinType(type: string) {
  sessionStorage.setItem("recruitsmart_pin_type", type);
}

export function clearPin() {
  sessionStorage.removeItem("recruitsmart_pin");
  sessionStorage.removeItem("recruitsmart_pin_type");
}

// --- SSO token management ---

export function getAccessToken(): string | null {
  return localStorage.getItem("recruitsmart_access_token");
}
export function setAccessToken(token: string) {
  localStorage.setItem("recruitsmart_access_token", token);
}
export function getRefreshToken(): string | null {
  return localStorage.getItem("recruitsmart_refresh_token");
}
export function setRefreshToken(token: string) {
  localStorage.setItem("recruitsmart_refresh_token", token);
}
export function getUserData(): Record<string, any> | null {
  const raw = localStorage.getItem("recruitsmart_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
export function setUserData(user: Record<string, any>) {
  localStorage.setItem("recruitsmart_user", JSON.stringify(user));
}
export function getSelectedOrg(): Record<string, any> | null {
  const raw = localStorage.getItem("recruitsmart_org");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
export function setSelectedOrg(org: Record<string, any>) {
  localStorage.setItem("recruitsmart_org", JSON.stringify(org));
}
export function clearAuth() {
  localStorage.removeItem("recruitsmart_access_token");
  localStorage.removeItem("recruitsmart_refresh_token");
  localStorage.removeItem("recruitsmart_user");
  localStorage.removeItem("recruitsmart_org");
}

// --- Share code ---

export function getShareCode(): string | null {
  return sessionStorage.getItem("recruitsmart_share_code");
}
export function setShareCode(code: string) {
  sessionStorage.setItem("recruitsmart_share_code", code);
}
export function clearShareCode() {
  sessionStorage.removeItem("recruitsmart_share_code");
}

// --- Token refresh ---

let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refresh = getRefreshToken();
    if (!refresh) return false;
    try {
      const res = await fetch(`${AIONE_AUTH_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.access_token) {
        setAccessToken(data.access_token);
        if (data.refresh_token) setRefreshToken(data.refresh_token);
        return true;
      }
      return false;
    } catch { return false; }
    finally { refreshPromise = null; }
  })();
  return refreshPromise;
}

// --- Fetch helpers ---

/** PIN-authenticated fetch (for applicant + recruiter flows) */
export async function pinFetch(path: string, options: RequestInit = {}) {
  const pin = getPin();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-pin-code": pin || "",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

/** PIN-authenticated upload (multipart, no Content-Type) */
export async function pinUpload(path: string, formData: FormData) {
  const pin = getPin();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "x-pin-code": pin || "" },
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function getOrgHeaders(): Record<string, string> {
  const org = getSelectedOrg();
  return org?.recruitsmartOrgId ? { "x-recruitsmart-org": org.recruitsmartOrgId } : {};
}

/** SSO-authenticated fetch (for admin) */
export async function adminFetch(path: string, options: RequestInit = {}) {
  const token = getAccessToken();
  const orgHeaders = getOrgHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...orgHeaders,
      ...options.headers,
    },
  });

  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const retryRes = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
          ...orgHeaders,
          ...options.headers,
        },
      });
      if (retryRes.status === 401) { clearAuth(); window.location.href = "/admin/login"; throw new Error("Unauthorized"); }
      if (!retryRes.ok) { const d = await retryRes.json().catch(() => ({})); throw new Error(d.error || `${retryRes.status}`); }
      return retryRes.json();
    }
    clearAuth(); window.location.href = "/admin/login"; throw new Error("Unauthorized");
  }
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `${res.status}`); }
  return res.json();
}

/** SSO upload (multipart) */
export async function adminUpload(path: string, formData: FormData) {
  const token = getAccessToken();
  const orgHeaders = getOrgHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, ...orgHeaders },
    body: formData,
  });
  if (res.status === 401) { clearAuth(); window.location.href = "/admin/login"; throw new Error("Unauthorized"); }
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `${res.status}`); }
  return res.json();
}

/** Share-link authenticated fetch */
export async function shareFetch(path: string, options: RequestInit = {}) {
  const code = getShareCode();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-share-code": code || "",
      ...options.headers,
    },
  });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `${res.status}`); }
  return res.json();
}
