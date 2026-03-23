import { useState, useEffect } from "react";
import { Card, Row, Col, Statistic, Table, Tag, Typography, Spin, Progress } from "antd";
import {
  FileSearchOutlined,
  UserOutlined,
  TrophyOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { adminFetch } from "../../utils/api";
import { useNavigate } from "react-router-dom";

const { Title } = Typography;

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    adminFetch("/admin/stats")
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;

  return (
    <div>
      <Title level={3}>Dashboard</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Open Jobs"
              value={stats?.openJobs || 0}
              prefix={<FileSearchOutlined />}
              suffix={`/ ${stats?.totalJobs || 0}`}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Total Candidates"
              value={stats?.totalCandidates || 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="This Week"
              value={stats?.recentCandidates || 0}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Avg Match Score"
              value={stats?.avgMatchScore || 0}
              prefix={<TrophyOutlined />}
              suffix="/ 100"
            />
          </Card>
        </Col>
      </Row>

      {stats?.statusBreakdown && Object.keys(stats.statusBreakdown).length > 0 && (
        <Card title="Pipeline Overview" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            {["NEW", "SHORTLISTED", "INTERVIEWING", "OFFERED", "HIRED", "REJECTED"].map((status) => (
              <Col xs={8} sm={4} key={status}>
                <Statistic
                  title={status.charAt(0) + status.slice(1).toLowerCase()}
                  value={stats.statusBreakdown[status] || 0}
                  valueStyle={{
                    color: status === "HIRED" ? "#10b981" :
                      status === "REJECTED" ? "#ef4444" :
                      status === "OFFERED" ? "#3b82f6" : undefined,
                  }}
                />
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Card title="Top Candidates">
        <Table
          dataSource={stats?.topCandidates || []}
          rowKey="id"
          pagination={false}
          onRow={(record: any) => ({
            onClick: () => navigate(`/admin/candidates/${record.id}`),
            style: { cursor: "pointer" },
          })}
          columns={[
            { title: "Candidate", dataIndex: "name" },
            {
              title: "Job",
              dataIndex: ["job", "title"],
            },
            {
              title: "Score",
              dataIndex: "matchScore",
              render: (s: number) => (
                <Progress
                  percent={s}
                  size="small"
                  strokeColor={s >= 75 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444"}
                  format={(p) => `${p}`}
                  style={{ width: 100 }}
                />
              ),
            },
            {
              title: "Status",
              dataIndex: "status",
              render: (s: string) => (
                <Tag color={
                  s === "SHORTLISTED" ? "blue" :
                  s === "INTERVIEWING" ? "orange" :
                  s === "OFFERED" ? "green" :
                  s === "HIRED" ? "cyan" :
                  s === "REJECTED" ? "red" : "default"
                }>
                  {s}
                </Tag>
              ),
            },
            {
              title: "Date",
              dataIndex: "createdAt",
              render: (d: string) => new Date(d).toLocaleDateString(),
            },
          ]}
        />
      </Card>
    </div>
  );
}
