import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Input, Button, Typography, Divider, Alert } from "antd";
import { ArrowLeftOutlined, ShareAltOutlined, LoginOutlined } from "@ant-design/icons";
import { setShareCode } from "../utils/api";

const { Text } = Typography;

export default function ShareEntry() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/share/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Invalid share code");
        return;
      }

      setShareCode(code.trim().toUpperCase());
      navigate("/shared");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <a href="https://aione.uk" className="login-back-button">
        <ArrowLeftOutlined /> Back to AIOne
      </a>

      <div className="login-content">
        <img src="/logo-dark.png" alt="AIOne RecruitSmart" className="login-logo" />

        <p className="login-welcome">
          Welcome to{" "}
          <span className="login-welcome__product">RecruitSmart</span>
        </p>

        <Card className="login-card">
          {error && (
            <Alert
              type="error"
              message={error}
              showIcon
              closable
              onClose={() => setError(null)}
              style={{ marginBottom: 16 }}
            />
          )}

          <Text
            type="secondary"
            style={{ display: "block", marginBottom: 16, fontSize: 14 }}
          >
            Enter your share code to view candidates
          </Text>

          <Input
            size="large"
            placeholder="Enter code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onPressEnter={handleSubmit}
            prefix={<ShareAltOutlined />}
            style={{
              fontSize: 18,
              letterSpacing: 4,
              textAlign: "center",
              height: 56,
              borderRadius: 8,
            }}
          />

          <Button
            type="primary"
            size="large"
            block
            loading={loading}
            onClick={handleSubmit}
            style={{
              marginTop: 16,
              height: 48,
              fontWeight: 600,
              borderRadius: 8,
            }}
          >
            View Candidates
          </Button>

          <Divider style={{ margin: "16px 0" }} />

          <Button
            size="large"
            block
            type="link"
            icon={<LoginOutlined />}
            onClick={() => navigate("/admin/login")}
            style={{
              height: 44,
              fontWeight: 500,
              color: "#8c8c8c",
            }}
          >
            Admin Login
          </Button>
        </Card>

        <div className="login-footer">
          <div className="login-footer-links">
            <a href="https://aione.uk/privacy">Privacy</a>
            <span className="footer-separator">|</span>
            <a href="https://aione.uk/terms">Terms</a>
            <span className="footer-separator">|</span>
            <a href="https://fix.aione.uk/public/submit?product=recruitsmart">
              Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
