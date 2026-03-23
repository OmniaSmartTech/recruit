import { useState, useEffect } from "react";
import { Card, Typography, Form, Input, Button, message, Spin, List, Tag, Modal, Switch, Space } from "antd";
import { SaveOutlined, MailOutlined, EditOutlined } from "@ant-design/icons";
import { adminFetch } from "../../utils/api";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const stageColors: Record<string, string> = {
  APPLIED: "default", SCREENING: "blue", SHORTLISTED: "cyan", PHONE_SCREEN: "geekblue",
  INTERVIEW: "purple", ASSESSMENT: "orange", FINAL_INTERVIEW: "volcano",
  OFFER: "gold", HIRED: "green", REJECTED: "red",
};

interface StageTemplate {
  id: string | null;
  stage: string;
  name: string;
  emailSubject: string | null;
  emailBody: string | null;
  isActive: boolean;
  isDefault?: boolean;
}

export default function AdminStageTemplates() {
  const [templates, setTemplates] = useState<StageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<StageTemplate | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    adminFetch("/pipeline/templates").then(setTemplates).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openEdit = (tpl: StageTemplate) => {
    setEditing(tpl);
    form.setFieldsValue({
      name: tpl.name,
      emailSubject: tpl.emailSubject || "",
      emailBody: tpl.emailBody || "",
      isActive: tpl.isActive,
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const values = form.getFieldsValue();
      await adminFetch(`/pipeline/templates/${editing.stage}`, {
        method: "PUT",
        body: JSON.stringify(values),
      });
      message.success("Template saved");
      setEditing(null);
      load();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;

  return (
    <div>
      <Title level={3}>Email Templates</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
        Customise the email templates sent at each stage of the recruitment pipeline.
        Use <code>{"{{candidateName}}"}</code>, <code>{"{{jobTitle}}"}</code>, <code>{"{{companyName}}"}</code> as placeholders.
      </Text>

      <Card>
        <List
          dataSource={templates}
          renderItem={(tpl) => (
            <List.Item
              actions={[
                <Button icon={<EditOutlined />} onClick={() => openEdit(tpl)}>Edit</Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Tag color={stageColors[tpl.stage]}>{tpl.name}</Tag>
                    {tpl.isDefault && <Tag>Default</Tag>}
                    {!tpl.isActive && <Tag color="red">Disabled</Tag>}
                  </Space>
                }
                description={tpl.emailSubject || "No email template configured"}
              />
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title={`Edit Template — ${editing?.name}`}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={handleSave}
        confirmLoading={saving}
        okText="Save Template"
        width={650}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Stage Display Name">
            <Input />
          </Form.Item>
          <Form.Item name="isActive" label="Email Enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="emailSubject" label="Email Subject">
            <Input placeholder="e.g. Thank you for applying — {{jobTitle}}" />
          </Form.Item>
          <Form.Item name="emailBody" label="Email Body">
            <TextArea rows={12} placeholder="Dear {{candidateName}},..." />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Available variables: <code>{"{{candidateName}}"}</code> <code>{"{{jobTitle}}"}</code> <code>{"{{companyName}}"}</code>
          </Text>
        </Form>
      </Modal>
    </div>
  );
}
