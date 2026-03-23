import { Card, Button, Typography, Divider } from "antd";
import { GoogleOutlined, WindowsOutlined, ArrowLeftOutlined, ShareAltOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

const { Text } = Typography;

const AIONE_AUTH_BASE = "https://auth.aione.uk";

function getSSOUrl(provider: "google" | "microsoft"): string {
  const redirectUri = encodeURIComponent(
    window.location.origin + "/auth/callback"
  );
  return `${AIONE_AUTH_BASE}/api/auth/web/${provider}?redirect_uri=${redirectUri}`;
}

export default function AdminLogin() {
  const navigate = useNavigate();

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
          <Text
            type="secondary"
            style={{ display: "block", marginBottom: 20, fontSize: 14, textAlign: "center" }}
          >
            Sign in to your admin account
          </Text>

          <Button
            size="large"
            block
            icon={<GoogleOutlined />}
            onClick={() => {
              window.location.href = getSSOUrl("google");
            }}
            style={{
              height: 48,
              borderRadius: 8,
              fontWeight: 500,
              marginBottom: 12,
            }}
          >
            Sign in with Google
          </Button>

          <Button
            size="large"
            block
            icon={<WindowsOutlined />}
            onClick={() => {
              window.location.href = getSSOUrl("microsoft");
            }}
            style={{
              height: 48,
              borderRadius: 8,
              fontWeight: 500,
            }}
          >
            Sign in with Microsoft
          </Button>

          <Divider style={{ margin: "16px 0" }} />

          <Button
            size="large"
            block
            type="link"
            icon={<ShareAltOutlined />}
            onClick={() => navigate("/")}
            style={{
              height: 44,
              fontWeight: 500,
              color: "#8c8c8c",
            }}
          >
            Enter with Share Code
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
