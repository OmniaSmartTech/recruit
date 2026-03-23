import { useState, useEffect } from "react";
import { Card, Button, Typography, Modal, Form, Input, Select, Switch, Space, message, Tag, Tooltip } from "antd";
import { PlusOutlined, CopyOutlined, DeleteOutlined } from "@ant-design/icons";
import { adminFetch } from "../../utils/api";
import DataTable, { DataTableColumn } from "../../components/shared/DataTable";

const { Title, Text } = Typography;

interface PinRow {
  id: string;
  code: string;
  label: string;
  type: string;
  isActive: boolean;
  createdAt: string;
  _count: { candidates: number; matchRuns: number };
}

export default function AdminPins() {
  const [pins, setPins] = useState<PinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = () => { setLoading(true); adminFetch("/admin/pins").then(setPins).catch(console.error).finally(() => setLoading(false)); };
  useEffect(load, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await adminFetch("/admin/pins", { method: "POST", body: JSON.stringify(values) });
      message.success("PIN created"); setModalOpen(false); form.resetFields(); load();
    } catch (err: any) { if (!err.errorFields) message.error(err.message); }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await adminFetch(`/admin/pins/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }); load();
  };

  const deletePin = (id: string) => {
    Modal.confirm({ title: "Delete PIN?", onOk: async () => { await adminFetch(`/admin/pins/${id}`, { method: "DELETE" }); message.success("Deleted"); load(); } });
  };

  const copyLink = (code: string) => { navigator.clipboard.writeText(`${window.location.origin}/?pin=${code}`); message.success("Link copied"); };

  const columns: DataTableColumn<PinRow>[] = [
    { title: "Label", dataIndex: "label", key: "label", sortable: true, width: 200 },
    {
      title: "Code", dataIndex: "code", key: "code", width: 150,
      render: (code: string) => (
        <Space>
          <Tag color="blue" style={{ fontFamily: "monospace", fontSize: 14 }}>{code}</Tag>
          <Tooltip title="Copy link"><Button size="small" icon={<CopyOutlined />} onClick={() => copyLink(code)} /></Tooltip>
        </Space>
      ),
    },
    {
      title: "Type", dataIndex: "type", key: "type", width: 120,
      filterable: [{ text: "Recruiter", value: "RECRUITER" }, { text: "Applicant", value: "APPLICANT" }],
      render: (t: string) => <Tag color={t === "RECRUITER" ? "purple" : "cyan"}>{t === "RECRUITER" ? "Recruiter" : "Applicant"}</Tag>,
    },
    {
      title: "Usage", key: "usage", width: 140,
      render: (_: unknown, r: PinRow) => <Text type="secondary">{r.type === "APPLICANT" ? `${r._count?.candidates || 0} CVs` : `${r._count?.matchRuns || 0} matches`}</Text>,
      filterRender: (_, r) => r.type === "APPLICANT" ? `${r._count?.candidates || 0} CVs` : `${r._count?.matchRuns || 0} matches`,
    },
    {
      title: "Active", dataIndex: "isActive", key: "isActive", width: 80,
      render: (active: boolean, record: PinRow) => <Switch checked={active} onChange={(val) => toggleActive(record.id, val)} />,
      filterable: [{ text: "Active", value: "true" }, { text: "Inactive", value: "false" }],
      filterRender: (val) => String(val),
    },
    {
      title: "Created", dataIndex: "createdAt", key: "createdAt", sortable: true, width: 110,
      render: (d: string) => new Date(d).toLocaleDateString(),
    },
    {
      title: "", key: "actions", width: 50,
      render: (_: unknown, record: PinRow) => <Button size="small" icon={<DeleteOutlined />} onClick={() => deletePin(record.id)} className="data-table__action-btn data-table__action-btn--delete" />,
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>PINs</Title>
      <Card>
        <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
          <strong>Recruiter PINs</strong> allow staff to run CV matching. <strong>Applicant PINs</strong> allow candidates to upload CVs.
        </Text>
        <DataTable<PinRow>
          columns={columns}
          dataSource={pins}
          rowKey="id"
          loading={loading}
          onRefresh={load}
          customizable
          tableId="rs-pins"
          exportable
          exportFilename="pins"
          toolbar={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>Create PIN</Button>
          }
        />
      </Card>

      <Modal title="Create PIN" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleCreate} okText="Create">
        <Form form={form} layout="vertical">
          <Form.Item name="label" label="Label" rules={[{ required: true }]}><Input placeholder="e.g. HR Team or Engineering Applicants" /></Form.Item>
          <Form.Item name="type" label="PIN Type" rules={[{ required: true }]}>
            <Select placeholder="Select type" options={[{ value: "RECRUITER", label: "Recruiter — can run CV matching" }, { value: "APPLICANT", label: "Applicant — can upload CVs" }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
