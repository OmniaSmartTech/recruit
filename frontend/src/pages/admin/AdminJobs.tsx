import { useState, useEffect } from "react";
import { Card, Table, Tag, Button, Typography, Modal, Form, Input, Select, Space, InputNumber, message } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from "@ant-design/icons";
import { adminFetch } from "../../utils/api";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Job {
  id: string;
  title: string;
  department: string | null;
  status: string;
  location: string | null;
  workMode: string;
  candidateCount: number;
  avgMatchScore: number;
  createdAt: string;
}

export default function AdminJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const loadJobs = () => {
    setLoading(true);
    adminFetch("/jobs")
      .then(setJobs)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(loadJobs, []);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Parse requirements
      const requirements = {
        mustHave: (values.mustHave || "").split("\n").map((s: string) => s.trim()).filter(Boolean),
        niceToHave: (values.niceToHave || "").split("\n").map((s: string) => s.trim()).filter(Boolean),
      };

      const salaryRange = values.salaryMin || values.salaryMax ? {
        min: values.salaryMin || 0,
        max: values.salaryMax || 0,
        currency: values.salaryCurrency || "GBP",
      } : null;

      const data = {
        title: values.title,
        department: values.department || null,
        description: values.description,
        requirements,
        salaryRange,
        location: values.location || null,
        workMode: values.workMode || "HYBRID",
        experienceLevel: values.experienceLevel || null,
        teamNotes: values.teamNotes || null,
        status: values.status || "OPEN",
      };

      if (editing) {
        await adminFetch(`/jobs/${editing.id}`, { method: "PATCH", body: JSON.stringify(data) });
        message.success("Job updated");
      } else {
        await adminFetch("/jobs", { method: "POST", body: JSON.stringify(data) });
        message.success("Job created");
      }

      setModalOpen(false);
      form.resetFields();
      setEditing(null);
      loadJobs();
    } catch (err: any) {
      message.error(err.message || "Failed to save job");
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: "Delete this job?",
      content: "This will also delete all candidates and their analyses. This cannot be undone.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        await adminFetch(`/jobs/${id}`, { method: "DELETE" });
        message.success("Job deleted");
        loadJobs();
      },
    });
  };

  const openEdit = (job: Job) => {
    setEditing(job);
    adminFetch(`/jobs/${job.id}`).then((full) => {
      const reqs = full.requirements || {};
      form.setFieldsValue({
        title: full.title,
        department: full.department,
        description: full.description,
        mustHave: (reqs.mustHave || []).join("\n"),
        niceToHave: (reqs.niceToHave || []).join("\n"),
        salaryMin: full.salaryRange?.min,
        salaryMax: full.salaryRange?.max,
        salaryCurrency: full.salaryRange?.currency || "GBP",
        location: full.location,
        workMode: full.workMode,
        experienceLevel: full.experienceLevel,
        teamNotes: full.teamNotes,
        status: full.status,
      });
      setModalOpen(true);
    });
  };

  const statusColor: Record<string, string> = {
    OPEN: "green", DRAFT: "default", ON_HOLD: "orange", CLOSED: "red", FILLED: "blue",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Jobs</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}
        >
          Create Job
        </Button>
      </div>

      <Card>
        <Table
          dataSource={jobs}
          rowKey="id"
          loading={loading}
          onRow={(record) => ({
            onClick: () => navigate(`/admin/jobs/${record.id}`),
            style: { cursor: "pointer" },
          })}
          columns={[
            { title: "Title", dataIndex: "title", render: (t: string) => <Text strong>{t}</Text> },
            { title: "Department", dataIndex: "department" },
            {
              title: "Status",
              dataIndex: "status",
              render: (s: string) => <Tag color={statusColor[s] || "default"}>{s}</Tag>,
            },
            { title: "Candidates", dataIndex: "candidateCount", align: "center" as const },
            {
              title: "Avg Score",
              dataIndex: "avgMatchScore",
              render: (s: number) => s ? (
                <Tag color={s >= 75 ? "green" : s >= 50 ? "orange" : "red"}>{s}/100</Tag>
              ) : <Text type="secondary">—</Text>,
            },
            {
              title: "Created",
              dataIndex: "createdAt",
              render: (d: string) => new Date(d).toLocaleDateString(),
            },
            {
              title: "",
              width: 120,
              render: (_: any, record: Job) => (
                <Space onClick={(e) => e.stopPropagation()}>
                  <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/admin/jobs/${record.id}`)} />
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? "Edit Job" : "Create Job"}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        onOk={handleSubmit}
        width={700}
        okText={editing ? "Save Changes" : "Create Job"}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Job Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Senior Software Engineer" />
          </Form.Item>

          <Space style={{ width: "100%" }} size="middle">
            <Form.Item name="department" label="Department" style={{ flex: 1 }}>
              <Input placeholder="e.g. Engineering" />
            </Form.Item>
            <Form.Item name="location" label="Location" style={{ flex: 1 }}>
              <Input placeholder="e.g. London, UK" />
            </Form.Item>
          </Space>

          <Space style={{ width: "100%" }} size="middle">
            <Form.Item name="workMode" label="Work Mode" style={{ flex: 1 }}>
              <Select defaultValue="HYBRID" options={[
                { value: "ONSITE", label: "On-site" },
                { value: "REMOTE", label: "Remote" },
                { value: "HYBRID", label: "Hybrid" },
              ]} />
            </Form.Item>
            <Form.Item name="experienceLevel" label="Experience Level" style={{ flex: 1 }}>
              <Select allowClear placeholder="Select level" options={[
                { value: "Junior", label: "Junior" },
                { value: "Mid", label: "Mid-Level" },
                { value: "Senior", label: "Senior" },
                { value: "Lead", label: "Lead" },
                { value: "Director", label: "Director" },
              ]} />
            </Form.Item>
            <Form.Item name="status" label="Status" style={{ flex: 1 }}>
              <Select defaultValue="OPEN" options={[
                { value: "DRAFT", label: "Draft" },
                { value: "OPEN", label: "Open" },
                { value: "ON_HOLD", label: "On Hold" },
                { value: "CLOSED", label: "Closed" },
                { value: "FILLED", label: "Filled" },
              ]} />
            </Form.Item>
          </Space>

          <Form.Item name="description" label="Job Description" rules={[{ required: true }]}>
            <TextArea rows={6} placeholder="Full job description..." />
          </Form.Item>

          <Form.Item name="mustHave" label="Must-Have Requirements (one per line)">
            <TextArea rows={4} placeholder="5+ years Python experience&#10;AWS certification&#10;Team leadership experience" />
          </Form.Item>

          <Form.Item name="niceToHave" label="Nice-to-Have Requirements (one per line)">
            <TextArea rows={3} placeholder="Kubernetes experience&#10;Public speaking skills" />
          </Form.Item>

          <Space style={{ width: "100%" }} size="middle">
            <Form.Item name="salaryMin" label="Salary Min" style={{ flex: 1 }}>
              <InputNumber style={{ width: "100%" }} placeholder="40000" />
            </Form.Item>
            <Form.Item name="salaryMax" label="Salary Max" style={{ flex: 1 }}>
              <InputNumber style={{ width: "100%" }} placeholder="65000" />
            </Form.Item>
            <Form.Item name="salaryCurrency" label="Currency" style={{ flex: 1 }}>
              <Select defaultValue="GBP" options={[
                { value: "GBP", label: "GBP" },
                { value: "USD", label: "USD" },
                { value: "EUR", label: "EUR" },
              ]} />
            </Form.Item>
          </Space>

          <Form.Item name="teamNotes" label="Team & Culture Notes (for AI context)">
            <TextArea rows={3} placeholder="Describe the team, culture, working style..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
