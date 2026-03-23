import { useState, useEffect } from "react";
import {
  Card, Table, Button, Typography, Modal, Form, Input, Select,
  Switch, Space, message, Tag, Tooltip, DatePicker,
} from "antd";
import {
  PlusOutlined, CopyOutlined, DeleteOutlined, ShareAltOutlined,
} from "@ant-design/icons";
import { adminFetch } from "../../utils/api";

const { Title, Text } = Typography;

interface ShareLink {
  id: string;
  code: string;
  label: string;
  jobId: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export default function AdminShareLinks() {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = () => {
    setLoading(true);
    Promise.all([
      adminFetch("/admin/share-links"),
      adminFetch("/jobs"),
    ])
      .then(([l, j]) => { setLinks(l); setJobs(j); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(loadData, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await adminFetch("/admin/share-links", {
        method: "POST",
        body: JSON.stringify({
          label: values.label,
          jobId: values.jobId || null,
          expiresAt: values.expiresAt?.toISOString() || null,
        }),
      });
      message.success("Share link created");
      setModalOpen(false);
      form.resetFields();
      loadData();
    } catch (err: any) {
      message.error(err.message || "Failed to create share link");
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await adminFetch(`/admin/share-links/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    });
    loadData();
  };

  const deleteLink = (id: string) => {
    Modal.confirm({
      title: "Delete share link?",
      onOk: async () => {
        await adminFetch(`/admin/share-links/${id}`, { method: "DELETE" });
        message.success("Deleted");
        loadData();
      },
    });
  };

  const copyLink = (code: string) => {
    const url = `${window.location.origin}/?code=${code}`;
    navigator.clipboard.writeText(url);
    message.success("Link copied to clipboard");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Share Links</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { form.resetFields(); setModalOpen(true); }}
        >
          Create Link
        </Button>
      </div>

      <Card>
        <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
          Share links allow hiring managers to view shortlisted candidates without logging in.
        </Text>

        <Table
          dataSource={links}
          rowKey="id"
          loading={loading}
          columns={[
            { title: "Label", dataIndex: "label" },
            {
              title: "Code",
              dataIndex: "code",
              render: (code: string) => (
                <Space>
                  <Tag color="blue" style={{ fontFamily: "monospace", fontSize: 14 }}>{code}</Tag>
                  <Tooltip title="Copy link">
                    <Button size="small" icon={<CopyOutlined />} onClick={() => copyLink(code)} />
                  </Tooltip>
                </Space>
              ),
            },
            {
              title: "Scope",
              dataIndex: "jobId",
              render: (jobId: string | null) => {
                if (!jobId) return <Text type="secondary">All jobs</Text>;
                const job = jobs.find((j) => j.id === jobId);
                return job ? <Tag>{job.title}</Tag> : <Text type="secondary">Unknown</Text>;
              },
            },
            {
              title: "Active",
              dataIndex: "isActive",
              render: (active: boolean, record: ShareLink) => (
                <Switch checked={active} onChange={(val) => toggleActive(record.id, val)} />
              ),
            },
            {
              title: "Expires",
              dataIndex: "expiresAt",
              render: (d: string | null) => d ? new Date(d).toLocaleDateString() : <Text type="secondary">Never</Text>,
            },
            {
              title: "",
              width: 50,
              render: (_: any, record: ShareLink) => (
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteLink(record.id)} />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="Create Share Link"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        okText="Create"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="label" label="Label" rules={[{ required: true }]}>
            <Input placeholder="e.g. Sarah - Engineering Manager" />
          </Form.Item>
          <Form.Item name="jobId" label="Scope to Job (optional)">
            <Select
              allowClear
              placeholder="All jobs"
              options={jobs.map((j) => ({ value: j.id, label: j.title }))}
            />
          </Form.Item>
          <Form.Item name="expiresAt" label="Expiry Date (optional)">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
