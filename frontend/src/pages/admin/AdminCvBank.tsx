import { useState, useEffect } from "react";
import { Card, Typography, Tag, Space } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { adminFetch } from "../../utils/api";
import DataTable, { DataTableColumn } from "../../components/shared/DataTable";

const { Title, Text } = Typography;

interface CandidateRow {
  id: string;
  name: string;
  email: string | null;
  currentRole: string | null;
  skills: string[];
  yearsExp: number | null;
  cvFileName: string | null;
  cvDownloadUrl: string | null;
  isActive: boolean;
  createdAt: string;
  pin: { label: string; type: string } | null;
}

export default function AdminCvBank() {
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminFetch("/admin/candidates").then(setCandidates).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const columns: DataTableColumn<CandidateRow>[] = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      sortable: true,
      width: 180,
      render: (name: string) => <><UserOutlined className="data-table__cell-icon" /> {name}</>,
    },
    { title: "Email", dataIndex: "email", key: "email", sortable: true, width: 200 },
    { title: "Current Role", dataIndex: "currentRole", key: "currentRole", sortable: true, width: 180 },
    {
      title: "Skills",
      dataIndex: "skills",
      key: "skills",
      width: 250,
      render: (skills: string[]) => (
        <Space wrap size={2}>
          {(skills || []).slice(0, 4).map((s) => <Tag key={s} color="blue">{s}</Tag>)}
          {(skills || []).length > 4 && <Tag>+{skills.length - 4}</Tag>}
        </Space>
      ),
      filterRender: (val) => (val as string[] || []).join(", "),
    },
    {
      title: "Experience",
      dataIndex: "yearsExp",
      key: "yearsExp",
      sortable: true,
      width: 100,
      render: (y: number) => y ? `${y} yrs` : "—",
      filterable: [
        { text: "0-2 years", value: "junior" },
        { text: "3-5 years", value: "mid" },
        { text: "6-10 years", value: "senior" },
        { text: "10+ years", value: "lead" },
      ],
      filterRender: (val) => {
        const y = val as number;
        if (!y) return "unknown";
        if (y <= 2) return "junior";
        if (y <= 5) return "mid";
        if (y <= 10) return "senior";
        return "lead";
      },
    },
    {
      title: "CV File", dataIndex: "cvFileName", key: "cvFileName", width: 150,
      render: (name: string, record: CandidateRow) =>
        name ? (
          record.cvDownloadUrl ? (
            <a href={record.cvDownloadUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              {name}
            </a>
          ) : name
        ) : "—",
    },
    {
      title: "Source",
      key: "source",
      width: 150,
      render: (_: unknown, record: CandidateRow) =>
        record.pin ? <Tag>{record.pin.label}</Tag> : <Text type="secondary">Admin</Text>,
      filterRender: (_val, record) => record.pin?.label || "Admin",
    },
    {
      title: "Date",
      dataIndex: "createdAt",
      key: "createdAt",
      sortable: true,
      width: 110,
      render: (d: string) => new Date(d).toLocaleDateString(),
      exportFormatter: (d) => new Date(d as string).toLocaleDateString(),
    },
  ];

  return (
    <div>
      <Title level={3}>CV Bank</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
        All candidates who have uploaded their CVs via applicant PINs.
      </Text>

      <Card>
        <DataTable<CandidateRow>
          columns={columns}
          dataSource={candidates}
          rowKey="id"
          loading={loading}
          onRefresh={load}
          customizable
          tableId="rs-cv-bank"
          exportable
          exportFilename="cv-bank"
          searchPlaceholder="Search candidates..."
          scrollHeight={500}
        />
      </Card>
    </div>
  );
}
