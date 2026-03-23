const API_BASE = "/api";
const AIONE_AUTH_BASE = "https://auth.aione.uk";

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
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setUserData(user: Record<string, any>) {
  localStorage.setItem("recruitsmart_user", JSON.stringify(user));
}

export function getSelectedOrg(): Record<string, any> | null {
  const raw = localStorage.getItem("recruitsmart_org");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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

// --- Share code management ---

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
        if (data.refresh_token) {
          setRefreshToken(data.refresh_token);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// --- Fetch helpers ---

export function getOrgHeaders(): Record<string, string> {
  const org = getSelectedOrg();
  return org?.recruitsmartOrgId ? { "x-recruitsmart-org": org.recruitsmartOrgId } : {};
}

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
      const newToken = getAccessToken();
      const retryRes = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${newToken}`,
          ...orgHeaders,
          ...options.headers,
        },
      });

      if (retryRes.status === 401) {
        clearAuth();
        window.location.href = "/admin/login";
        throw new Error("Unauthorized");
      }

      if (!retryRes.ok) {
        const data = await retryRes.json().catch(() => ({}));
        throw new Error(data.error || `Request failed: ${retryRes.status}`);
      }
      return retryRes.json();
    }

    clearAuth();
    window.location.href = "/admin/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch for file uploads (no Content-Type header — let browser set multipart boundary)
 */
export async function adminUpload(path: string, formData: FormData) {
  const token = getAccessToken();
  const orgHeaders = getOrgHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...orgHeaders,
    },
    body: formData,
  });

  if (res.status === 401) {
    clearAuth();
    window.location.href = "/admin/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

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
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return res.json();
}
