import { useState, useEffect } from "react";
import { Card, Button, Typography, Modal, Form, Input, Select, Switch, Space, message, Tag, Tooltip, DatePicker } from "antd";
import { PlusOutlined, CopyOutlined, DeleteOutlined } from "@ant-design/icons";
import { adminFetch } from "../../utils/api";
import DataTable, { DataTableColumn } from "../../components/shared/DataTable";

const { Title, Text } = Typography;

interface ShareLinkRow {
  id: string;
  code: string;
  label: string;
  jobId: string | null;
  matchRunId: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export default function AdminShareLinks() {
  const [links, setLinks] = useState<ShareLinkRow[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    Promise.all([adminFetch("/admin/share-links"), adminFetch("/jobs")])
      .then(([l, j]) => { setLinks(l); setJobs(j); }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await adminFetch("/admin/share-links", {
        method: "POST", body: JSON.stringify({ label: values.label, jobId: values.jobId || null, expiresAt: values.expiresAt?.toISOString() || null }),
      });
      message.success("Share link created"); setModalOpen(false); form.resetFields(); load();
    } catch (err: any) { if (!err.errorFields) message.error(err.message); }
  };

  const deleteLink = (id: string) => {
    Modal.confirm({ title: "Delete share link?", onOk: async () => { await adminFetch(`/admin/share-links/${id}`, { method: "DELETE" }); message.success("Deleted"); load(); } });
  };

  const copyLink = (code: string) => { navigator.clipboard.writeText(`${window.location.origin}/?code=${code}`); message.success("Link copied"); };

  const columns: DataTableColumn<ShareLinkRow>[] = [
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
      title: "Expires", dataIndex: "expiresAt", key: "expiresAt", sortable: true, width: 120,
      render: (d: string | null) => d ? new Date(d).toLocaleDateString() : <Text type="secondary">Never</Text>,
    },
    {
      title: "Created", dataIndex: "createdAt", key: "createdAt", sortable: true, width: 110,
      render: (d: string) => new Date(d).toLocaleDateString(),
    },
    {
      title: "", key: "actions", width: 50,
      render: (_: unknown, record: ShareLinkRow) => <Button size="small" icon={<DeleteOutlined />} onClick={() => deleteLink(record.id)} className="data-table__action-btn data-table__action-btn--delete" />,
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>Share Links</Title>
      <Card>
        <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
          Share links allow hiring managers to view shortlisted candidates without logging in.
        </Text>
        <DataTable<ShareLinkRow>
          columns={columns}
          dataSource={links}
          rowKey="id"
          loading={loading}
          onRefresh={load}
          tableId="rs-share-links"
          toolbar={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>Create Link</Button>
          }
        />
      </Card>

      <Modal title="Create Share Link" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleCreate} okText="Create">
        <Form form={form} layout="vertical">
          <Form.Item name="label" label="Label" rules={[{ required: true }]}><Input placeholder="e.g. Sarah - Engineering Manager" /></Form.Item>
          <Form.Item name="jobId" label="Scope to Job (optional)">
            <Select allowClear placeholder="All jobs" options={jobs.map((j) => ({ value: j.id, label: j.title }))} />
          </Form.Item>
          <Form.Item name="expiresAt" label="Expiry Date (optional)"><DatePicker style={{ width: "100%" }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
