import { useState, useEffect } from "react";
import { Card, Typography, Form, Input, Button, Upload, message, Spin, ColorPicker } from "antd";
import { SaveOutlined, UploadOutlined } from "@ant-design/icons";
import { adminFetch } from "../../utils/api";

const { Title, Text } = Typography;

export default function AdminBranding() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    adminFetch("/admin/branding")
      .then((data) => {
        form.setFieldsValue({
          name: data.name,
          companyName: data.companyName,
          website: data.website,
          primaryColor: data.primaryColor || "#e74c3c",
        });
        setLogoUrl(data.logoUrl);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [form]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = form.getFieldsValue();
      const formData = new FormData();
      formData.append("name", values.name || "");
      formData.append("companyName", values.companyName || "");
      formData.append("website", values.website || "");
      formData.append("primaryColor",
        typeof values.primaryColor === "string"
          ? values.primaryColor
          : values.primaryColor?.toHexString?.() || "#e74c3c"
      );
      if (logoFile) {
        formData.append("logo", logoFile);
      }

      const token = localStorage.getItem("recruitsmart_access_token");
      const org = JSON.parse(localStorage.getItem("recruitsmart_org") || "{}");

      const res = await fetch("/api/admin/branding", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "x-recruitsmart-org": org.recruitsmartOrgId || "",
        },
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to save");

      const data = await res.json();
      setLogoUrl(data.logoUrl);
      setLogoFile(null);
      message.success("Branding updated");
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;

  return (
    <div>
      <Title level={3}>Branding</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        Customise how your organisation appears in reports and shared views.
      </Text>

      <Card style={{ maxWidth: 600 }}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Organisation Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="companyName" label="Company Name (for reports)">
            <Input placeholder="Defaults to organisation name" />
          </Form.Item>

          <Form.Item name="website" label="Website">
            <Input placeholder="https://..." />
          </Form.Item>

          <Form.Item name="primaryColor" label="Brand Colour">
            <ColorPicker showText />
          </Form.Item>

          <Form.Item label="Logo">
            {logoUrl && (
              <img src={logoUrl} alt="Logo" style={{ height: 48, marginBottom: 12, display: "block" }} />
            )}
            <Upload
              accept="image/*"
              maxCount={1}
              showUploadList={!!logoFile}
              beforeUpload={(file) => {
                setLogoFile(file);
                return false;
              }}
            >
              <Button icon={<UploadOutlined />}>Upload Logo</Button>
            </Upload>
          </Form.Item>

          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            Save Branding
          </Button>
        </Form>
      </Card>
    </div>
  );
}
