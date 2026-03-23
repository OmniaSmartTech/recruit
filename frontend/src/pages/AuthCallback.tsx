import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Spin, Typography, Alert } from "antd";
import {
  setAccessToken,
  setRefreshToken,
  setUserData,
  setSelectedOrg,
} from "../utils/api";

const { Text } = Typography;

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function processCallback() {
      try {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (!accessToken) {
          setError("No access token received. Please try signing in again.");
          return;
        }

        setAccessToken(accessToken);
        if (refreshToken) {
          setRefreshToken(refreshToken);
        }

        const resolveRes = await fetch("/api/auth/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken }),
        });

        if (!resolveRes.ok) {
          const data = await resolveRes.json().catch(() => ({}));
          setError(data.message || data.error || "Failed to resolve your account. Please contact support.");
          return;
        }

        const resolved = await resolveRes.json();

        if (resolved.user) {
          setUserData(resolved.user);
        }

        if (resolved.requiresOrgSelection) {
          sessionStorage.setItem(
            "recruitsmart_pending_orgs",
            JSON.stringify(resolved.organisations)
          );
          navigate("/admin/select-org", { replace: true });
        } else {
          setSelectedOrg(resolved.organisation);
          navigate("/admin", { replace: true });
        }
      } catch (err: any) {
        setError(err.message || "Authentication failed");
      }
    }

    processCallback();
  }, [navigate]);

  if (error) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#f0f2f5", padding: 24,
      }}>
        <Alert
          type="error"
          message="Authentication Failed"
          description={error}
          showIcon
          action={<a href="/admin/login" style={{ fontWeight: 500 }}>Back to login</a>}
          style={{ maxWidth: 480 }}
        />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "#f0f2f5", gap: 16,
    }}>
      <Spin size="large" />
      <Text type="secondary">Signing you in...</Text>
    </div>
  );
}
