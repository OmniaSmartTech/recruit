import { useState, useEffect } from "react";
import { Card, Typography, Form, Input, Select, Button, message, Spin } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { adminFetch } from "../../utils/api";

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function AdminPromptSettings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminFetch("/admin/prompt")
      .then((data) => {
        form.setFieldsValue({
          companyRole: data.companyRole || "",
          assessmentFocus: data.assessmentFocus || "",
          languagePrefs: data.languagePrefs || "british",
          customInstructions: data.customInstructions || "",
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [form]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = form.getFieldsValue();
      await adminFetch("/admin/prompt", {
        method: "PUT",
        body: JSON.stringify(values),
      });
      message.success("AI prompt settings saved");
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;

  return (
    <div>
      <Title level={3}>AI Prompt Settings</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        Customise how the AI analyses candidates for your organisation.
      </Text>

      <Card style={{ maxWidth: 700 }}>
        <Form form={form} layout="vertical">
          <Form.Item
            name="companyRole"
            label="Company Context"
            tooltip="Tell the AI about your company so it can better assess cultural fit"
          >
            <TextArea
              rows={3}
              placeholder="e.g. We are a fast-growing fintech startup with 50 employees, focused on B2B payments..."
            />
          </Form.Item>

          <Form.Item
            name="assessmentFocus"
            label="Assessment Focus"
            tooltip="What should the AI prioritise when assessing candidates?"
          >
            <TextArea
              rows={3}
              placeholder="e.g. We value practical experience over formal qualifications. Look for evidence of ownership and impact..."
            />
          </Form.Item>

          <Form.Item name="languagePrefs" label="Language">
            <Select options={[
              { value: "british", label: "British English" },
              { value: "american", label: "American English" },
            ]} />
          </Form.Item>

          <Form.Item
            name="customInstructions"
            label="Custom Instructions"
            tooltip="Additional instructions appended to every AI analysis"
          >
            <TextArea
              rows={4}
              placeholder="e.g. Always check for experience with our tech stack: React, Node.js, PostgreSQL, AWS..."
            />
          </Form.Item>

          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            Save Settings
          </Button>
        </Form>
      </Card>
    </div>
  );
}
