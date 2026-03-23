import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Typography, Spin, Alert } from "antd";
import { BankOutlined } from "@ant-design/icons";
import { setSelectedOrg, setUserData, getAccessToken } from "../../utils/api";

const { Title, Text } = Typography;

interface OrgOption {
  aioneOrgId: number;
  recruitsmartOrgId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  role: string;
}

export default function OrgSelector() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("recruitsmart_pending_orgs");
    if (stored) {
      try {
        setOrgs(JSON.parse(stored));
        setLoading(false);
        return;
      } catch { /* fall through */ }
    }

    const token = getAccessToken();
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }

    fetch("/api/auth/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "Failed to load organisations");
        }
        return res.json();
      })
      .then((data) => {
        if (data.user) setUserData(data.user);
        if (!data.requiresOrgSelection) {
          setSelectedOrg(data.organisation);
          navigate("/admin", { replace: true });
          return;
        }
        setOrgs(data.organisations);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [navigate]);

  const handleSelect = (org: OrgOption) => {
    setSelectedOrg(org);
    sessionStorage.removeItem("recruitsmart_pending_orgs");
    navigate("/admin", { replace: true });
  };

  if (loading) {
    return (
      <div className="org-selector-page">
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="org-selector-page">
        <Alert
          type="error"
          message="Access Error"
          description={error}
          showIcon
          action={<a href="/admin/login" style={{ fontWeight: 500 }}>Back to login</a>}
          style={{ maxWidth: 480 }}
        />
      </div>
    );
  }

  return (
    <div className="org-selector-page">
      <div className="org-selector-content">
        <img src="/logo-dark.png" alt="RecruitSmart" className="org-selector-logo" />
        <Title level={3} className="org-selector-title">
          Select Organisation
        </Title>
        <Text type="secondary" className="org-selector-subtitle">
          Choose which organisation to manage
        </Text>

        <div className="org-selector-grid">
          {orgs.map((org) => (
            <Card
              key={org.recruitsmartOrgId}
              hoverable
              className="org-selector-card"
              onClick={() => handleSelect(org)}
            >
              <div className="org-selector-card__inner">
                {org.logoUrl ? (
                  <img src={org.logoUrl} alt={org.name} className="org-selector-card__logo" />
                ) : (
                  <div
                    className="org-selector-card__icon"
                    style={{ backgroundColor: org.primaryColor || "#e74c3c" }}
                  >
                    <BankOutlined />
                  </div>
                )}
                <div className="org-selector-card__info">
                  <Text strong className="org-selector-card__name">{org.name}</Text>
                  <Text type="secondary" className="org-selector-card__role">{org.role}</Text>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
