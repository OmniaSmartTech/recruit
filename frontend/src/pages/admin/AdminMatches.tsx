import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Table, Typography, Tag, Button, Space, Spin, Select, message, Modal } from "antd";
import { ThunderboltOutlined, EyeOutlined } from "@ant-design/icons";
import { adminFetch } from "../../utils/api";

const { Title, Text } = Typography;

export default function AdminMatches() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminFetch("/admin/matches"),
      adminFetch("/jobs"),
    ])
      .then(([m, j]) => { setMatches(m); setJobs(j.filter((jj: any) => jj.status === "OPEN")); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const runMatch = async (jobId: string) => {
    try {
      const result = await adminFetch(`/admin/match/${jobId}`, { method: "POST" });
      message.success(`Match started: ${result.preFilterPassed} of ${result.totalCandidates} candidates`);
      navigate(`/admin/matches/${result.matchRunId}`);
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const statusColor: Record<string, string> = {
    PENDING: "default", PRE_FILTERING: "processing", ANALYZING: "processing",
    COMPLETED: "green", FAILED: "red",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Match Runs</Title>
        {jobs.length > 0 && (
          <Select
            placeholder="Run new match..."
            style={{ width: 250 }}
            options={jobs.map((j: any) => ({ value: j.id, label: j.title }))}
            onChange={(jobId) => {
              Modal.confirm({
                title: "Run match?",
                content: "This will pre-filter the CV bank and run AI analysis on top candidates.",
                onOk: () => runMatch(jobId),
              });
            }}
          />
        )}
      </div>

      <Card>
        <Table
          dataSource={matches}
          rowKey="id"
          loading={loading}
          onRow={(record: any) => ({
            onClick: () => navigate(`/admin/matches/${record.id}`),
            style: { cursor: "pointer" },
          })}
          columns={[
            { title: "Job", render: (_: any, r: any) => <Text strong>{r.job?.title}</Text> },
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
              title: "Triggered By",
              render: (_: any, r: any) => r.pin?.label ? <Tag>{r.pin.label}</Tag> : <Text type="secondary">{r.triggeredBy || "admin"}</Text>,
            },
            {
              title: "Date",
              dataIndex: "createdAt",
              render: (d: string) => new Date(d).toLocaleDateString(),
            },
            {
              title: "",
              width: 50,
              render: () => <Button size="small" icon={<EyeOutlined />} />,
            },
          ]}
        />
      </Card>
    </div>
  );
}
