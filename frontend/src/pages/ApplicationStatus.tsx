import { useState } from "react";
import {
  Card, Input, Button, Typography, Steps, Tag, Empty, Alert, Spin, Space, Result,
} from "antd";
import {
  ArrowLeftOutlined, MailOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, SearchOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

const { Title, Text, Paragraph } = Typography;

export default function ApplicationStatus() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [applications, setApplications] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/status/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No applications found");
        setApplications(null);
        return;
      }
      const data = await res.json();
      setApplications(data.applications);
    } catch {
      setError("Failed to check status. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: "24px 16px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate("/")} style={{ padding: 0, marginBottom: 16 }}>
          Back
        </Button>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/logo-dark.png" alt="RecruitSmart" style={{ height: 40, marginBottom: 12 }} />
          <Title level={3}>Application Status</Title>
          <Text type="secondary">Check the status of your application</Text>
        </div>

        <Card style={{ marginBottom: 24 }}>
          <Text style={{ display: "block", marginBottom: 12 }}>
            Enter the email address you used when applying:
          </Text>
          <Space.Compact style={{ width: "100%" }}>
            <Input
              size="large"
              prefix={<MailOutlined />}
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onPressEnter={checkStatus}
            />
            <Button type="primary" size="large" icon={<SearchOutlined />} loading={loading} onClick={checkStatus}>
              Check
            </Button>
          </Space.Compact>
        </Card>

        {error && <Alert type="warning" message={error} showIcon style={{ marginBottom: 16 }} />}

        {applications && applications.length === 0 && (
          <Empty description="No applications found for this email" />
        )}

        {applications?.map((app, i) => (
          <Card key={i} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              {app.logoUrl && <img src={app.logoUrl} alt="" style={{ height: 32 }} />}
              <div>
                <Text strong style={{ fontSize: 16 }}>{app.jobTitle}</Text>
                {app.department && <Text type="secondary"> — {app.department}</Text>}
                <br />
                <Text type="secondary">{app.companyName}</Text>
                {app.location && <Text type="secondary"> | {app.location}</Text>}
              </div>
            </div>

            {app.isHired && (
              <Result
                status="success"
                title="Congratulations!"
                subTitle="You've been offered this position"
                style={{ padding: "12px 0" }}
              />
            )}

            {app.isRejected && (
              <Alert
                type="info"
                message="Application not progressed"
                description="Unfortunately your application was not selected for this role. We encourage you to apply for future openings."
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            {!app.isHired && !app.isRejected && (
              <Steps
                size="small"
                current={app.stages.findIndex((s: any) => s.current)}
                items={app.stages.map((s: any) => ({
                  title: s.name,
                  status: s.completed ? "finish" : s.current ? "process" : "wait",
                }))}
              />
            )}

            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Applied: {new Date(app.appliedAt).toLocaleDateString()} | Last updated: {new Date(app.lastUpdated).toLocaleDateString()}
              </Text>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
