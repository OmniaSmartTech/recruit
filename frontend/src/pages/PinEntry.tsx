import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Input, Button, Typography, Divider, Alert } from "antd";
import { ArrowLeftOutlined, KeyOutlined, LoginOutlined, SearchOutlined } from "@ant-design/icons";
import { setPin, setPinType } from "../utils/api";

const { Text } = Typography;

export default function PinEntry() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/pin/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Invalid PIN code");
        return;
      }

      const data = await res.json();
      setPin(code.trim().toUpperCase());
      setPinType(data.type);

      // Route based on PIN type
      if (data.type === "APPLICANT") {
        navigate("/apply");
      } else if (data.type === "INTERVIEWER") {
        navigate("/interview");
      } else {
        navigate("/recruit");
      }
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
            Enter your PIN to continue
          </Text>

          <Input
            size="large"
            placeholder="Enter PIN"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onPressEnter={handleSubmit}
            prefix={<KeyOutlined />}
            className="pin-input"
          />

          <Button
            type="primary"
            size="large"
            block
            loading={loading}
            onClick={handleSubmit}
            className="pin-submit-btn"
          >
            Continue
          </Button>

          <Divider style={{ margin: "16px 0" }} />

          <Button
            size="large"
            block
            type="link"
            icon={<LoginOutlined />}
            onClick={() => navigate("/admin/login")}
            style={{ height: 40, fontWeight: 500, color: "#8c8c8c" }}
          >
            Admin Login
          </Button>

          <Button
            size="large"
            block
            type="link"
            icon={<SearchOutlined />}
            onClick={() => navigate("/status")}
            style={{ height: 40, fontWeight: 500, color: "#8c8c8c" }}
          >
            Check Application Status
          </Button>
        </Card>

        <div className="login-footer">
          <div className="login-footer-links">
            <a href="https://aione.uk/privacy">Privacy</a>
            <span className="footer-separator">|</span>
            <a href="https://aione.uk/terms">Terms</a>
            <span className="footer-separator">|</span>
            <a href="https://fix.aione.uk/public/submit?product=recruitsmart">Support</a>
          </div>
        </div>
      </div>
    </div>
  );
}
