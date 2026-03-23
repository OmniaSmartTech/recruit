import { useState, useEffect } from "react";
import { Card, Table, Typography, Tag, Space, Spin } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { adminFetch } from "../../utils/api";

const { Title, Text } = Typography;

export default function AdminCvBank() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch("/admin/candidates")
      .then(setCandidates)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Title level={3}>CV Bank</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
        All candidates who have uploaded their CVs via applicant PINs.
      </Text>

      <Card>
        <Table
          dataSource={candidates}
          rowKey="id"
          loading={loading}
          columns={[
            {
              title: "Name",
              dataIndex: "name",
              render: (name: string) => <><UserOutlined style={{ marginRight: 8 }} />{name}</>,
            },
            { title: "Email", dataIndex: "email" },
            { title: "Current Role", dataIndex: "currentRole" },
            {
              title: "Skills",
              dataIndex: "skills",
              render: (skills: string[]) => (
                <Space wrap>
                  {(skills || []).slice(0, 5).map((s) => (
                    <Tag key={s} color="blue">{s}</Tag>
                  ))}
                  {(skills || []).length > 5 && <Tag>+{skills.length - 5}</Tag>}
                </Space>
              ),
            },
            {
              title: "Experience",
              dataIndex: "yearsExp",
              render: (y: number) => y ? `${y} years` : "—",
            },
            { title: "CV", dataIndex: "cvFileName", render: (f: string) => f || "—" },
            {
              title: "Via",
              render: (_: any, record: any) => (
                record.pin ? <Tag>{record.pin.label}</Tag> : <Text type="secondary">Admin</Text>
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
