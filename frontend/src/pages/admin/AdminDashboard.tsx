import { useState, useEffect } from "react";
import { Card, Row, Col, Statistic, Table, Tag, Typography, Spin } from "antd";
import {
  FileSearchOutlined, TeamOutlined, ThunderboltOutlined, KeyOutlined,
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

  const statusColor: Record<string, string> = {
    PENDING: "default", PRE_FILTERING: "processing", ANALYZING: "processing",
    COMPLETED: "green", FAILED: "red",
  };

  return (
    <div>
      <Title level={3}>Dashboard</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Open Jobs" value={stats?.openJobs || 0} prefix={<FileSearchOutlined />} suffix={`/ ${stats?.totalJobs || 0}`} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="CV Bank" value={stats?.totalCandidates || 0} prefix={<TeamOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="New This Week" value={stats?.recentCandidates || 0} prefix={<KeyOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Match Runs" value={stats?.totalMatchRuns || 0} prefix={<ThunderboltOutlined />} /></Card>
        </Col>
      </Row>

      <Card title="Recent Matches">
        <Table
          dataSource={stats?.recentMatches || []}
          rowKey="id"
          pagination={false}
          onRow={(record: any) => ({
            onClick: () => navigate(`/admin/matches/${record.id}`),
            style: { cursor: "pointer" },
          })}
          columns={[
            { title: "Job", render: (_: any, r: any) => r.job?.title },
            {
              title: "Status",
              dataIndex: "status",
              render: (s: string) => <Tag color={statusColor[s] || "default"}>{s}</Tag>,
            },
            {
              title: "Candidates",
              render: (_: any, r: any) => `${r._count?.results || 0} / ${r.totalCandidates}`,
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
