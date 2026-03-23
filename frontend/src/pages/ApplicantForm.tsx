import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card, Form, Input, Button, Typography, Upload, Select, InputNumber,
  Tag, Space, message, Result, Steps, Row, Col, Divider, Spin, Alert, Checkbox,
} from "antd";
import {
  UploadOutlined, UserOutlined, ArrowLeftOutlined,
  CheckCircleOutlined, FileOutlined, BulbOutlined, ThunderboltOutlined,
} from "@ant-design/icons";
import { getPin, pinUpload } from "../utils/api";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function ApplicantForm() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [suggestedSkills, setSuggestedSkills] = useState<string[]>([]);
  const [useWizard, setUseWizard] = useState(false);

  const pin = getPin();
  if (!pin) { navigate("/"); return null; }

  const addSkill = (skill?: string) => {
    const s = (skill || skillInput).trim();
    if (s && !skills.includes(s)) {
      setSkills([...skills, s]);
      // Remove from suggestions if it was there
      setSuggestedSkills((prev) => prev.filter((ss) => ss !== s));
    }
    if (!skill) setSkillInput("");
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleCvUploadAndParse = async () => {
    if (!cvFile || !useWizard) {
      setStep(1);
      return;
    }

    setParsing(true);
    try {
      const formData = new FormData();
      formData.append("cv", cvFile);

      const res = await fetch("/api/applicant/parse-cv", {
        method: "POST",
        headers: { "x-pin-code": pin || "" },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();

        // Pre-populate form fields
        form.setFieldsValue({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          currentRole: data.currentRole || "",
          currentCompany: data.currentCompany || "",
          yearsExp: data.yearsExp || undefined,
          linkedinUrl: data.linkedinUrl || "",
          portfolioUrl: data.portfolioUrl || "",
        });

        // Set skills
        if (data.skills?.length) {
          setSkills(data.skills);
        }

        // Set suggested skills (ones AI thinks they might have)
        if (data.suggestedSkills?.length) {
          const existing = new Set((data.skills || []).map((s: string) => s.toLowerCase()));
          setSuggestedSkills(
            data.suggestedSkills.filter((s: string) => !existing.has(s.toLowerCase()))
          );
        }

        // Set certifications
        if (data.certifications?.length) {
          form.setFieldsValue({
            certifications: data.certifications.join("\n"),
          });
        }

        message.success("CV parsed — please review and complete your details");
      } else {
        message.warning("Couldn't auto-fill from CV — please fill in manually");
      }
    } catch {
      message.warning("CV parsing failed — please fill in your details manually");
    } finally {
      setParsing(false);
      setStep(1);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const formData = new FormData();
      if (cvFile) formData.append("cv", cvFile);
      formData.append("name", values.name);
      if (values.email) formData.append("email", values.email);
      if (values.phone) formData.append("phone", values.phone);
      if (values.currentRole) formData.append("currentRole", values.currentRole);
      if (values.currentCompany) formData.append("currentCompany", values.currentCompany);
      if (values.noticePeriod) formData.append("noticePeriod", values.noticePeriod);
      if (values.rightToWork) formData.append("rightToWork", values.rightToWork);
      if (values.linkedinUrl) formData.append("linkedinUrl", values.linkedinUrl);
      if (values.portfolioUrl) formData.append("portfolioUrl", values.portfolioUrl);
      if (values.workPreference) formData.append("workPreference", values.workPreference);
      if (values.yearsExp) formData.append("yearsExp", String(values.yearsExp));
      if (values.desiredSalaryMin) formData.append("desiredSalaryMin", String(values.desiredSalaryMin));
      if (values.desiredSalaryMax) formData.append("desiredSalaryMax", String(values.desiredSalaryMax));
      formData.append("desiredSalaryCurrency", values.desiredSalaryCurrency || "GBP");
      formData.append("skills", JSON.stringify(skills));
      formData.append("certifications", JSON.stringify(
        (values.certifications || "").split("\n").map((s: string) => s.trim()).filter(Boolean)
      ));

      await pinUpload("/applicant/upload", formData);
      setStep(2);
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 2) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
        <Result
          status="success"
          title="Application Submitted"
          subTitle="Thank you! Your CV and details have been received. We'll be in touch."
          extra={
            <Button type="primary" onClick={() => { setStep(0); form.resetFields(); setCvFile(null); setSkills([]); setSuggestedSkills([]); }}>
              Submit Another
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: "24px 16px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => step === 0 ? navigate("/") : setStep(0)} style={{ padding: 0, marginBottom: 16 }}>
          Back
        </Button>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img src="/logo-dark.png" alt="RecruitSmart" style={{ height: 40, marginBottom: 12 }} />
          <Title level={3}>Submit Your Application</Title>
        </div>

        <Steps current={step} items={[{ title: "Upload CV" }, { title: "Your Details" }]} style={{ marginBottom: 32 }} />

        {step === 0 && (
          <Card>
            <Title level={4}><FileOutlined /> Upload Your CV</Title>
            <Paragraph type="secondary">
              Upload your CV and we'll extract your details automatically. You can review and edit everything on the next step.
            </Paragraph>

            <Upload.Dragger
              accept=".pdf,.docx,.doc,.txt"
              maxCount={1}
              showUploadList={!!cvFile}
              beforeUpload={(file) => { setCvFile(file); return false; }}
              onRemove={() => { setCvFile(null); setUseWizard(false); }}
              style={{ marginBottom: 16 }}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined style={{ fontSize: 40, color: "#e74c3c" }} />
              </p>
              <p className="ant-upload-text">Drop your CV here or click to upload</p>
              <p className="ant-upload-hint">PDF, DOCX, DOC, or TXT — max 10MB</p>
            </Upload.Dragger>

            {cvFile && (
              <div
                style={{
                  background: "linear-gradient(135deg, #fff7e6 0%, #fff1f0 100%)",
                  borderRadius: 8,
                  padding: "12px 16px",
                  marginBottom: 16,
                  border: "1px solid #ffd591",
                  cursor: "pointer",
                }}
                onClick={() => setUseWizard(!useWizard)}
              >
                <Checkbox checked={useWizard} onChange={(e) => setUseWizard(e.target.checked)}>
                  <Space>
                    <ThunderboltOutlined style={{ color: "#e74c3c", fontSize: 16 }} />
                    <span style={{ fontWeight: 600 }}>Use RecruitWizard</span>
                  </Space>
                </Checkbox>
                <div style={{ marginLeft: 24, marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    Let our AI read your CV and auto-fill the form for you. You can review and edit everything before submitting.
                  </Text>
                </div>
              </div>
            )}

            <Button
              type="primary"
              size="large"
              block
              loading={parsing}
              onClick={handleCvUploadAndParse}
              style={{ height: 48 }}
            >
              {parsing ? "RecruitWizard is reading your CV..." : "Continue"}
            </Button>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <Title level={4}><UserOutlined /> Your Details</Title>
            {cvFile && (
              <Alert
                type="info"
                message="We've pre-filled what we could from your CV. Please review and correct anything that's wrong."
                showIcon
                closable
                style={{ marginBottom: 16 }}
              />
            )}

            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
                    <Input placeholder="Your full name" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="email" label="Email">
                    <Input type="email" placeholder="your@email.com" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="phone" label="Phone">
                    <Input placeholder="Your phone number" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="yearsExp" label="Years of Experience">
                    <InputNumber min={0} max={50} style={{ width: "100%" }} placeholder="e.g. 5" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="currentRole" label="Current Role">
                    <Input placeholder="e.g. Senior Engineer" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="currentCompany" label="Current Company">
                    <Input placeholder="e.g. Acme Corp" />
                  </Form.Item>
                </Col>
              </Row>

              {/* Skills with suggestions */}
              <Form.Item label="Key Skills">
                <Space.Compact style={{ width: "100%", marginBottom: 8 }}>
                  <Input
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onPressEnter={(e) => { e.preventDefault(); addSkill(); }}
                    placeholder="Type a skill and press Enter"
                    style={{ flex: 1 }}
                  />
                  <Button onClick={() => addSkill()}>Add</Button>
                </Space.Compact>
                <div style={{ marginBottom: 8 }}>
                  {skills.map((s) => (
                    <Tag key={s} closable onClose={() => removeSkill(s)} color="blue" style={{ marginBottom: 4 }}>
                      {s}
                    </Tag>
                  ))}
                </div>
                {suggestedSkills.length > 0 && (
                  <div style={{ background: "#f6ffed", borderRadius: 6, padding: "8px 12px", border: "1px solid #b7eb8f" }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <BulbOutlined style={{ marginRight: 4 }} />
                      Suggested skills (click to add):
                    </Text>
                    <div style={{ marginTop: 4 }}>
                      {suggestedSkills.map((s) => (
                        <Tag
                          key={s}
                          style={{ cursor: "pointer", marginBottom: 4 }}
                          color="green"
                          onClick={() => addSkill(s)}
                        >
                          + {s}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Form.Item name="workPreference" label="Work Preference">
                    <Select placeholder="Select" allowClear options={[
                      { value: "ONSITE", label: "On-site" },
                      { value: "REMOTE", label: "Remote" },
                      { value: "HYBRID", label: "Hybrid" },
                    ]} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="noticePeriod" label="Notice Period">
                    <Select placeholder="Select" allowClear options={[
                      { value: "Immediate", label: "Immediate" },
                      { value: "1 week", label: "1 Week" },
                      { value: "2 weeks", label: "2 Weeks" },
                      { value: "1 month", label: "1 Month" },
                      { value: "2 months", label: "2 Months" },
                      { value: "3 months", label: "3 Months" },
                    ]} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="rightToWork" label="Right to Work">
                    <Select placeholder="Select" allowClear options={[
                      { value: "Yes - UK citizen", label: "UK Citizen" },
                      { value: "Yes - settled status", label: "Settled Status" },
                      { value: "Yes - work visa", label: "Work Visa" },
                      { value: "Requires sponsorship", label: "Requires Sponsorship" },
                    ]} />
                  </Form.Item>
                </Col>
              </Row>

              <Divider>Salary Expectations (optional)</Divider>

              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Form.Item name="desiredSalaryMin" label="Min">
                    <InputNumber style={{ width: "100%" }} placeholder="40000" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="desiredSalaryMax" label="Max">
                    <InputNumber style={{ width: "100%" }} placeholder="60000" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="desiredSalaryCurrency" label="Currency" initialValue="GBP">
                    <Select options={[
                      { value: "GBP", label: "GBP" },
                      { value: "USD", label: "USD" },
                      { value: "EUR", label: "EUR" },
                    ]} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="linkedinUrl" label="LinkedIn URL">
                    <Input placeholder="https://linkedin.com/in/..." />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="portfolioUrl" label="Portfolio / GitHub URL">
                    <Input placeholder="https://..." />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="certifications" label="Certifications (one per line)">
                <TextArea rows={3} placeholder="AWS Solutions Architect&#10;PMP Certified" />
              </Form.Item>

              <Button
                type="primary"
                size="large"
                block
                loading={submitting}
                onClick={handleSubmit}
                icon={<CheckCircleOutlined />}
                style={{ height: 48, marginTop: 16 }}
              >
                Submit Application
              </Button>
            </Form>
          </Card>
        )}
      </div>
    </div>
  );
}
