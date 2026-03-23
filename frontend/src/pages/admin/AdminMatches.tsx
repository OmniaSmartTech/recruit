import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Typography, Tag, Button, Select, message, Modal } from "antd";
import { EyeOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { adminFetch } from "../../utils/api";
import DataTable, { DataTableColumn } from "../../components/shared/DataTable";

const { Title, Text } = Typography;

interface MatchRow {
  id: string;
  status: string;
  totalCandidates: number;
  preFilterCount: number;
  triggeredBy: string | null;
  createdAt: string;
  job: { title: string; department: string | null } | null;
  pin: { label: string } | null;
  _count: { results: number };
}

export default function AdminMatches() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([adminFetch("/admin/matches"), adminFetch("/jobs")])
      .then(([m, j]) => { setMatches(m); setJobs(j.filter((jj: any) => jj.status === "OPEN")); })
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const runMatch = async (jobId: string) => {
    try {
      const result = await adminFetch(`/admin/match/${jobId}`, { method: "POST" });
      message.success(`Match started: ${result.preFilterPassed} of ${result.totalCandidates} candidates`);
      navigate(`/admin/matches/${result.matchRunId}`);
    } catch (err: any) { message.error(err.message); }
  };

  const statusColor: Record<string, string> = {
    PENDING: "default", PRE_FILTERING: "processing", ANALYZING: "processing", COMPLETED: "green", FAILED: "red",
  };

  const columns: DataTableColumn<MatchRow>[] = [
    {
      title: "Job", key: "job", sortable: true, width: 220,
      render: (_: unknown, r: MatchRow) => <Text strong>{r.job?.title || "—"}</Text>,
      filterRender: (_, r) => r.job?.title || "",
    },
    {
      title: "Status", dataIndex: "status", key: "status", width: 120,
      filterable: [
        { text: "Pending", value: "PENDING" }, { text: "Pre-filtering", value: "PRE_FILTERING" },
        { text: "Analyzing", value: "ANALYZING" }, { text: "Completed", value: "COMPLETED" }, { text: "Failed", value: "FAILED" },
      ],
      render: (s: string) => <Tag color={statusColor[s]}>{s}</Tag>,
    },
    {
      title: "Candidates", key: "candidates", width: 120, sortable: true,
      render: (_: unknown, r: MatchRow) => `${r._count?.results || 0} / ${r.totalCandidates}`,
      filterRender: (_, r) => `${r._count?.results || 0} / ${r.totalCandidates}`,
    },
    {
      title: "Triggered By", key: "triggeredBy", width: 150,
      render: (_: unknown, r: MatchRow) => r.pin?.label ? <Tag>{r.pin.label}</Tag> : <Text type="secondary">{r.triggeredBy || "admin"}</Text>,
      filterRender: (_, r) => r.pin?.label || r.triggeredBy || "admin",
    },
    {
      title: "Date", dataIndex: "createdAt", key: "createdAt", sortable: true, width: 110,
      render: (d: string) => new Date(d).toLocaleDateString(),
    },
    {
      title: "", key: "actions", width: 50,
      render: (_: unknown, record: MatchRow) => (
        <Button size="small" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); navigate(`/admin/matches/${record.id}`); }} className="data-table__action-btn data-table__action-btn--view" />
      ),
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>Match Runs</Title>
      <Card>
        <DataTable<MatchRow>
          columns={columns}
          dataSource={matches}
          rowKey="id"
          loading={loading}
          onRefresh={load}
          customizable
          tableId="rs-matches"
          exportable
          exportFilename="match-runs"
          searchPlaceholder="Search matches..."
          scrollHeight={500}
          toolbar={
            jobs.length > 0 ? (
              <Select
                placeholder="Run new match..."
                style={{ width: 250 }}
                options={jobs.map((j: any) => ({ value: j.id, label: j.title }))}
                onChange={(jobId) => {
                  Modal.confirm({ title: "Run match?", content: "Pre-filter CV bank + AI analysis on top candidates.", onOk: () => runMatch(jobId) });
                }}
              />
            ) : undefined
          }
          tableProps={{
            onRow: (record: MatchRow) => ({
              onClick: () => navigate(`/admin/matches/${record.id}`),
              style: { cursor: "pointer" },
            }),
          }}
        />
      </Card>
    </div>
  );
}
