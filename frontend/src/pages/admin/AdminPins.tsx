import { useState, useEffect } from "react";
import {
  Card, Table, Button, Typography, Modal, Form, Input, Select,
  Switch, Space, message, Tag, Tooltip,
} from "antd";
import { PlusOutlined, CopyOutlined, DeleteOutlined, KeyOutlined } from "@ant-design/icons";
import { adminFetch } from "../../utils/api";

const { Title, Text } = Typography;

export default function AdminPins() {
  const [pins, setPins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadPins = () => {
    setLoading(true);
    adminFetch("/admin/pins").then(setPins).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(loadPins, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await adminFetch("/admin/pins", {
        method: "POST",
        body: JSON.stringify(values),
      });
      message.success("PIN created");
      setModalOpen(false);
      form.resetFields();
      loadPins();
    } catch (err: any) {
      if (!err.errorFields) message.error(err.message);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await adminFetch(`/admin/pins/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) });
    loadPins();
  };

  const deletePin = (id: string) => {
    Modal.confirm({
      title: "Delete PIN?",
      onOk: async () => {
        await adminFetch(`/admin/pins/${id}`, { method: "DELETE" });
        message.success("Deleted");
        loadPins();
      },
    });
  };

  const copyLink = (code: string, type: string) => {
    const url = `${window.location.origin}/?pin=${code}`;
    navigator.clipboard.writeText(url);
    message.success(`${type} link copied`);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>PINs</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>
          Create PIN
        </Button>
      </div>

      <Card>
        <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
          <strong>Recruiter PINs</strong> allow staff to run CV matching against jobs.
          <strong> Applicant PINs</strong> allow candidates to upload their CVs.
        </Text>

        <Table
          dataSource={pins}
          rowKey="id"
          loading={loading}
          columns={[
            { title: "Label", dataIndex: "label" },
            {
              title: "Code",
              dataIndex: "code",
              render: (code: string, record: any) => (
                <Space>
                  <Tag color="blue" style={{ fontFamily: "monospace", fontSize: 14 }}>{code}</Tag>
                  <Tooltip title="Copy link">
                    <Button size="small" icon={<CopyOutlined />} onClick={() => copyLink(code, record.type)} />
                  </Tooltip>
                </Space>
              ),
            },
            {
              title: "Type",
              dataIndex: "type",
              render: (t: string) => (
                <Tag color={t === "RECRUITER" ? "purple" : "cyan"}>
                  {t === "RECRUITER" ? "Recruiter" : "Applicant"}
                </Tag>
              ),
            },
            {
              title: "Usage",
              render: (_: any, record: any) => (
                <Text type="secondary">
                  {record.type === "APPLICANT"
                    ? `${record._count?.candidates || 0} CVs uploaded`
                    : `${record._count?.matchRuns || 0} matches run`
                  }
                </Text>
              ),
            },
            {
              title: "Active",
              dataIndex: "isActive",
              render: (active: boolean, record: any) => (
                <Switch checked={active} onChange={(val) => toggleActive(record.id, val)} />
              ),
            },
            {
              title: "",
              width: 50,
              render: (_: any, record: any) => (
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deletePin(record.id)} />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="Create PIN"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        okText="Create"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="label" label="Label" rules={[{ required: true }]}>
            <Input placeholder="e.g. HR Team or Engineering Applicants" />
          </Form.Item>
          <Form.Item name="type" label="PIN Type" rules={[{ required: true }]}>
            <Select placeholder="Select type" options={[
              { value: "RECRUITER", label: "Recruiter — can run CV matching" },
              { value: "APPLICANT", label: "Applicant — can upload CVs" },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
