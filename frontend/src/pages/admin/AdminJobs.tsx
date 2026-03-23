import { useState, useEffect } from "react";
import { Card, Tag, Button, Typography, Modal, Form, Input, Select, Space, InputNumber, message, Tooltip, Tabs, App, Row, Col } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, ProjectOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { adminFetch } from "../../utils/api";
import { useNavigate } from "react-router-dom";
import DataTable, { DataTableColumn } from "../../components/shared/DataTable";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Job {
  id: string;
  title: string;
  department: string | null;
  status: string;
  location: string | null;
  workMode: string;
  experienceLevel: string | null;
  candidateCount?: number;
  matchRunCount?: number;
  createdAt: string;
}

export default function AdminJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { modal: antModal } = App.useApp();

  const loadJobs = () => {
    setLoading(true);
    adminFetch("/jobs").then(setJobs).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(loadJobs, []);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const requirements = {
        mustHave: (values.mustHave || "").split("\n").map((s: string) => s.trim()).filter(Boolean),
        niceToHave: (values.niceToHave || "").split("\n").map((s: string) => s.trim()).filter(Boolean),
      };
      const salaryRange = values.salaryMin || values.salaryMax ? {
        min: values.salaryMin || 0, max: values.salaryMax || 0, currency: values.salaryCurrency || "GBP",
      } : null;

      const data = {
        title: values.title, department: values.department || null, description: values.description,
        requirements, salaryRange, location: values.location || null, workMode: values.workMode || "HYBRID",
        experienceLevel: values.experienceLevel || null, teamNotes: values.teamNotes || null, status: values.status || "OPEN",
      };

      if (editing) {
        await adminFetch(`/jobs/${editing.id}`, { method: "PATCH", body: JSON.stringify(data) });
        message.success("Job updated");
      } else {
        await adminFetch("/jobs", { method: "POST", body: JSON.stringify(data) });
        message.success("Job created");
      }
      setModalOpen(false); form.resetFields(); setEditing(null); loadJobs();
    } catch (err: any) { if (!err.errorFields) message.error(err.message); }
  };

  const runMatch = (jobId: string) => {
    antModal.confirm({
      title: "Run match?",
      content: "Pre-filter the CV bank and run AI analysis on top candidates.",
      okText: "Run Match",
      onOk: async () => {
        try {
          const result = await adminFetch(`/admin/match/${jobId}`, { method: "POST" });
          message.success(`${result.preFilterPassed} of ${result.totalCandidates} candidates matched`);
          navigate(`/admin/matches/${result.matchRunId}`);
        } catch (err: any) { message.error(err.message); }
      },
    });
  };

  const handleDelete = (id: string) => {
    antModal.confirm({
      title: "Delete this job?",
      content: "This will also remove all pipeline candidates for this job. This cannot be undone.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        await adminFetch(`/jobs/${id}`, { method: "DELETE" });
        message.success("Deleted");
        loadJobs();
      },
    });
  };

  const openEdit = (job: Job) => {
    setEditing(job);
    adminFetch(`/jobs/${job.id}`).then((full) => {
      const reqs = full.requirements || {};
      form.setFieldsValue({
        title: full.title, department: full.department, description: full.description,
        mustHave: (reqs.mustHave || []).join("\n"), niceToHave: (reqs.niceToHave || []).join("\n"),
        salaryMin: full.salaryRange?.min, salaryMax: full.salaryRange?.max, salaryCurrency: full.salaryRange?.currency || "GBP",
        location: full.location, workMode: full.workMode, experienceLevel: full.experienceLevel, teamNotes: full.teamNotes, status: full.status,
      });
      setModalOpen(true);
    });
  };

  const cloneJob = (job: Job) => {
    adminFetch(`/jobs/${job.id}`).then((full) => {
      setEditing(null);
      const reqs = full.requirements || {};
      form.setFieldsValue({
        title: `${full.title} (copy)`, department: full.department, description: full.description,
        mustHave: (reqs.mustHave || []).join("\n"), niceToHave: (reqs.niceToHave || []).join("\n"),
        salaryMin: full.salaryRange?.min, salaryMax: full.salaryRange?.max, salaryCurrency: full.salaryRange?.currency || "GBP",
        location: full.location, workMode: full.workMode, experienceLevel: full.experienceLevel, teamNotes: full.teamNotes, status: "DRAFT",
      });
      setModalOpen(true);
    });
  };

  const statusColor: Record<string, string> = { OPEN: "green", DRAFT: "default", ON_HOLD: "orange", CLOSED: "red", FILLED: "blue" };

  const columns: DataTableColumn<Job>[] = [
    { title: "Title", dataIndex: "title", key: "title", sortable: true, width: 220, render: (t: string) => <Text strong>{t}</Text> },
    { title: "Department", dataIndex: "department", key: "department", sortable: true, width: 140 },
    {
      title: "Status", dataIndex: "status", key: "status", width: 100,
      filterable: [
        { text: "Open", value: "OPEN" }, { text: "Draft", value: "DRAFT" },
        { text: "On Hold", value: "ON_HOLD" }, { text: "Closed", value: "CLOSED" }, { text: "Filled", value: "FILLED" },
      ],
      render: (s: string) => <Tag color={statusColor[s] || "default"}>{s}</Tag>,
    },
    { title: "Location", dataIndex: "location", key: "location", sortable: true, width: 140 },
    {
      title: "Work Mode", dataIndex: "workMode", key: "workMode", width: 100,
      filterable: [{ text: "On-site", value: "ONSITE" }, { text: "Remote", value: "REMOTE" }, { text: "Hybrid", value: "HYBRID" }],
    },
    { title: "Level", dataIndex: "experienceLevel", key: "experienceLevel", width: 100,
      filterable: [{ text: "Junior", value: "Junior" }, { text: "Mid", value: "Mid" }, { text: "Senior", value: "Senior" }, { text: "Lead", value: "Lead" }, { text: "Director", value: "Director" }],
      render: (l: string) => l ? <Tag color="blue">{l}</Tag> : null,
    },
    { title: "Created", dataIndex: "createdAt", key: "createdAt", sortable: true, width: 110,
      render: (d: string) => new Date(d).toLocaleDateString(),
    },
    {
      title: "", key: "actions", width: 160,
      render: (_: unknown, record: Job) => (
        <Space size={4}>
          <Tooltip title="Run Match"><Button size="small" icon={<ThunderboltOutlined />} onClick={(e) => { e.stopPropagation(); runMatch(record.id); }} className="data-table__action-btn data-table__action-btn--edit" /></Tooltip>
          <Tooltip title="Pipeline"><Button size="small" icon={<ProjectOutlined />} onClick={(e) => { e.stopPropagation(); navigate(`/admin/pipeline/${record.id}`); }} className="data-table__action-btn data-table__action-btn--view" /></Tooltip>
          <Button size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); openEdit(record); }} className="data-table__action-btn data-table__action-btn--edit" />
          <Button size="small" icon={<CopyOutlined />} onClick={(e) => { e.stopPropagation(); cloneJob(record); }} className="data-table__action-btn data-table__action-btn--view" title="Clone" />
          <Button size="small" icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); handleDelete(record.id); }} className="data-table__action-btn data-table__action-btn--delete" />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>Jobs</Title>
      <Card>
        <DataTable<Job>
          columns={columns}
          dataSource={jobs}
          rowKey="id"
          loading={loading}
          onRefresh={loadJobs}
          customizable
          tableId="rs-jobs"
          exportable
          exportFilename="jobs"
          searchPlaceholder="Search jobs..."
          scrollHeight={500}
          toolbar={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
              Create Job
            </Button>
          }
        />
      </Card>

      <Modal
        title={editing ? "Edit Job" : "Create Job"}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        onOk={handleSubmit}
        width={700}
        okText={editing ? "Save" : "Create"}
      >
        <Form form={form} layout="vertical">
          <Tabs
            defaultActiveKey="details"
            items={[
              {
                key: "details",
                label: "Job Details",
                children: (
                  <>
                    <Form.Item name="title" label="Job Title" rules={[{ required: true }]}>
                      <Input placeholder="e.g. Senior Software Engineer" />
                    </Form.Item>
                    <Row gutter={16}>
                      <Col span={8}><Form.Item name="department" label="Department"><Input placeholder="e.g. Engineering" /></Form.Item></Col>
                      <Col span={8}><Form.Item name="location" label="Location"><Input placeholder="e.g. London, UK" /></Form.Item></Col>
                      <Col span={8}>
                        <Form.Item name="workMode" label="Work Mode">
                          <Select defaultValue="HYBRID" options={[{ value: "ONSITE", label: "On-site" }, { value: "REMOTE", label: "Remote" }, { value: "HYBRID", label: "Hybrid" }]} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item name="experienceLevel" label="Level">
                          <Select allowClear placeholder="Select" options={[{ value: "Junior", label: "Junior" }, { value: "Mid", label: "Mid" }, { value: "Senior", label: "Senior" }, { value: "Lead", label: "Lead" }, { value: "Director", label: "Director" }]} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name="status" label="Status">
                          <Select defaultValue="OPEN" options={[{ value: "DRAFT", label: "Draft" }, { value: "OPEN", label: "Open" }, { value: "ON_HOLD", label: "On Hold" }, { value: "CLOSED", label: "Closed" }, { value: "FILLED", label: "Filled" }]} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name="description" label="Job Description" rules={[{ required: true }]}>
                      <TextArea rows={5} />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: "requirements",
                label: "Requirements",
                children: (
                  <>
                    <Form.Item name="mustHave" label="Must-Have Requirements (one per line)">
                      <TextArea rows={5} placeholder="5+ years Python experience&#10;AWS certification&#10;Team leadership" />
                    </Form.Item>
                    <Form.Item name="niceToHave" label="Nice-to-Have (one per line)">
                      <TextArea rows={4} placeholder="Kubernetes experience&#10;Public speaking" />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: "compensation",
                label: "Compensation & Culture",
                children: (
                  <>
                    <Row gutter={16}>
                      <Col span={8}><Form.Item name="salaryMin" label="Salary Min"><InputNumber placeholder="40000" /></Form.Item></Col>
                      <Col span={8}><Form.Item name="salaryMax" label="Salary Max"><InputNumber placeholder="65000" /></Form.Item></Col>
                      <Col span={8}>
                        <Form.Item name="salaryCurrency" label="Currency">
                          <Select defaultValue="GBP" options={[{ value: "GBP", label: "GBP" }, { value: "USD", label: "USD" }, { value: "EUR", label: "EUR" }]} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name="teamNotes" label="Team & Culture Notes">
                      <TextArea rows={4} placeholder="Describe the team, working style, what makes this role special..." />
                    </Form.Item>
                  </>
                ),
              },
            ]}
          />
        </Form>
      </Modal>
    </div>
  );
}
