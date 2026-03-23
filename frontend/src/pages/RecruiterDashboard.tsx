import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card, Typography, Button, List, Tag, Space, Spin, Empty, Modal, message,
  Form, Input, Select, InputNumber, Collapse, Row, Col, Statistic,
} from "antd";
import {
  ArrowLeftOutlined, ThunderboltOutlined, FileSearchOutlined,
  HistoryOutlined, TeamOutlined, PlusOutlined,
} from "@ant-design/icons";
import { getPin, pinFetch } from "../utils/api";

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function RecruiterDashboard() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState<string | null>(null);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [creatingJob, setCreatingJob] = useState(false);
  const [form] = Form.useForm();

  const pin = getPin();
  if (!pin) { navigate("/"); return null; }

  const loadData = () => {
    Promise.all([
      pinFetch("/recruiter/jobs"),
      pinFetch("/recruiter/matches"),
    ])
      .then(([j, m]) => { setJobs(j); setMatches(m); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const runMatch = async (jobId: string, jobTitle: string) => {
    Modal.confirm({
      title: `Run match for "${jobTitle}"?`,
      content: "This will scan the CV bank, pre-filter candidates, and run AI analysis on the top matches.",
      okText: "Run Match",
      onOk: async () => {
        setMatching(jobId);
        try {
          const result = await pinFetch(`/recruiter/match/${jobId}`, { method: "POST" });
          message.success(`${result.preFilterPassed} of ${result.totalCandidates} candidates matched`);
          navigate(`/recruit/match/${result.matchRunId}`);
        } catch (err: any) {
          message.error(err.message);
        } finally {
          setMatching(null);
        }
      },
    });
  };

  const handleCreateJob = async () => {
    try {
      const values = await form.validateFields();
      setCreatingJob(true);

      const requirements = {
        mustHave: (values.mustHave || "").split("\n").map((s: string) => s.trim()).filter(Boolean),
        niceToHave: (values.niceToHave || "").split("\n").map((s: string) => s.trim()).filter(Boolean),
      };

      const salaryRange = values.salaryMin || values.salaryMax ? {
        min: values.salaryMin || 0, max: values.salaryMax || 0, currency: values.salaryCurrency || "GBP",
      } : null;

      await pinFetch("/recruiter/jobs", {
        method: "POST",
        body: JSON.stringify({
          title: values.title,
          department: values.department || null,
          description: values.description,
          requirements,
          salaryRange,
          location: values.location || null,
          workMode: values.workMode || "HYBRID",
          experienceLevel: values.experienceLevel || null,
          teamNotes: values.teamNotes || null,
        }),
      });

      message.success("Job created — you can now run a match against it");
      form.resetFields();
      setShowCreateJob(false);
      loadData();
    } catch (err: any) {
      if (!err.errorFields) message.error(err.message || "Failed to create job");
    } finally {
      setCreatingJob(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: "24px 16px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate("/")} style={{ padding: 0, marginBottom: 16 }}>
          Back
        </Button>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/logo-dark.png" alt="RecruitSmart" style={{ height: 40, marginBottom: 12 }} />
          <Title level={3}><TeamOutlined /> Recruiter Dashboard</Title>
        </div>

        {/* Quick stats */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={8}><Card><Statistic title="Open Jobs" value={jobs.length} prefix={<FileSearchOutlined />} /></Card></Col>
          <Col xs={8}><Card><Statistic title="Matches Run" value={matches.length} prefix={<ThunderboltOutlined />} /></Card></Col>
          <Col xs={8}><Card><Statistic title="Completed" value={matches.filter((m) => m.status === "COMPLETED").length} valueStyle={{ color: "#10b981" }} /></Card></Col>
        </Row>

        {/* Open Jobs */}
        <Card
          title={<><FileSearchOutlined /> Open Jobs</>}
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreateJob(true)}>
              Create Job
            </Button>
          }
          style={{ marginBottom: 24 }}
        >
          {jobs.length === 0 ? (
            <Empty description="No open jobs yet. Create one to start matching." />
          ) : (
            <List
              dataSource={jobs}
              renderItem={(job: any) => (
                <List.Item
                  actions={[
                    <Button
                      type="primary"
                      icon={<ThunderboltOutlined />}
                      loading={matching === job.id}
                      onClick={() => runMatch(job.id, job.title)}
                    >
                      Run Match
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={<Text strong style={{ fontSize: 15 }}>{job.title}</Text>}
                    description={
                      <Space wrap>
                        {job.department && <Tag>{job.department}</Tag>}
                        {job.location && <Tag>{job.location}</Tag>}
                        <Tag>{job.workMode}</Tag>
                        {job.experienceLevel && <Tag color="blue">{job.experienceLevel}</Tag>}
                        {job.salaryRange && (
                          <Tag color="green">
                            {job.salaryRange.currency} {job.salaryRange.min?.toLocaleString()}-{job.salaryRange.max?.toLocaleString()}
                          </Tag>
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>

        {/* Match History */}
        <Card title={<><HistoryOutlined /> Match History</>}>
          {matches.length === 0 ? (
            <Empty description="No matches run yet" />
          ) : (
            <List
              dataSource={matches}
              renderItem={(run: any) => (
                <List.Item
                  actions={[
                    <Button onClick={() => navigate(`/recruit/match/${run.id}`)}>View Results</Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={run.job?.title || "Unknown Job"}
                    description={
                      <Space>
                        <Tag color={
                          run.status === "COMPLETED" ? "green" :
                          run.status === "ANALYZING" ? "processing" :
                          run.status === "FAILED" ? "red" : "default"
                        }>
                          {run.status}
                        </Tag>
                        <Text type="secondary">{run._count?.results || 0} candidates</Text>
                        <Text type="secondary">{new Date(run.createdAt).toLocaleDateString()}</Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>

        {/* Create Job Modal */}
        <Modal
          title="Create Job"
          open={showCreateJob}
          onCancel={() => setShowCreateJob(false)}
          onOk={handleCreateJob}
          confirmLoading={creatingJob}
          okText="Create Job"
          width={700}
        >
          <Form form={form} layout="vertical">
            <Form.Item name="title" label="Job Title" rules={[{ required: true }]}>
              <Input placeholder="e.g. Senior Software Engineer" />
            </Form.Item>

            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="department" label="Department">
                  <Input placeholder="e.g. Engineering" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="location" label="Location">
                  <Input placeholder="e.g. London, UK" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="workMode" label="Work Mode" initialValue="HYBRID">
                  <Select options={[
                    { value: "ONSITE", label: "On-site" },
                    { value: "REMOTE", label: "Remote" },
                    { value: "HYBRID", label: "Hybrid" },
                  ]} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="experienceLevel" label="Experience Level">
                  <Select allowClear placeholder="Select" options={[
                    { value: "Junior", label: "Junior" },
                    { value: "Mid", label: "Mid-Level" },
                    { value: "Senior", label: "Senior" },
                    { value: "Lead", label: "Lead" },
                    { value: "Director", label: "Director" },
                  ]} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="salaryMin" label="Salary Min">
                  <InputNumber style={{ width: "100%" }} placeholder="40000" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="salaryMax" label="Salary Max">
                  <InputNumber style={{ width: "100%" }} placeholder="65000" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="description" label="Job Description" rules={[{ required: true }]}>
              <TextArea rows={4} placeholder="Describe the role, responsibilities, and what you're looking for..." />
            </Form.Item>

            <Form.Item name="mustHave" label="Must-Have Requirements (one per line)">
              <TextArea rows={3} placeholder="5+ years Python experience&#10;AWS certification&#10;Team leadership" />
            </Form.Item>

            <Form.Item name="niceToHave" label="Nice-to-Have (one per line)">
              <TextArea rows={2} placeholder="Kubernetes experience&#10;Public speaking" />
            </Form.Item>

            <Form.Item name="teamNotes" label="Team & Culture Notes (helps AI assess fit)">
              <TextArea rows={2} placeholder="Small team, fast-paced, pragmatic..." />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
}
