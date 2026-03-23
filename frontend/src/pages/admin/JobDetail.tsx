import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card, Typography, Tag, Button, Table, Space, Upload, message,
  Spin, Select, Tooltip, Progress, Modal, Row, Col, Statistic, Dropdown,
} from "antd";
import {
  UploadOutlined, ReloadOutlined, UserOutlined, DeleteOutlined,
  FilePdfOutlined, ArrowLeftOutlined, InboxOutlined, DownOutlined,
} from "@ant-design/icons";
import { adminFetch, adminUpload } from "../../utils/api";

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

interface Candidate {
  id: string;
  name: string;
  email: string | null;
  cvFileName: string | null;
  status: string;
  matchScore: number | null;
  analyisStatus: string;
  createdAt: string;
  analysis: any;
}

interface Job {
  id: string;
  title: string;
  department: string | null;
  description: string;
  status: string;
  location: string | null;
  workMode: string;
  experienceLevel: string | null;
  requirements: { mustHave: string[]; niceToHave: string[] };
  candidates: Candidate[];
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadJob = useCallback(() => {
    if (!id) return;
    adminFetch(`/jobs/${id}`)
      .then(setJob)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadJob();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadJob]);

  // Poll while any candidate is PENDING or ANALYZING
  useEffect(() => {
    if (!job) return;
    const hasPending = job.candidates.some(
      (c) => c.analyisStatus === "PENDING" || c.analyisStatus === "ANALYZING"
    );

    if (hasPending && !pollRef.current) {
      pollRef.current = setInterval(loadJob, 3000);
    } else if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [job, loadJob]);

  const handleUpload = async (fileList: File[]) => {
    if (!fileList.length || !id) return;
    setUploading(true);

    const formData = new FormData();
    fileList.forEach((f) => formData.append("cvs", f));

    try {
      const result = await adminUpload(`/candidates/upload/${id}`, formData);
      message.success(`Uploaded ${result.uploaded} CV(s)${result.failed ? `, ${result.failed} failed` : ""}`);
      loadJob();
    } catch (err: any) {
      message.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const updateStatus = async (candidateId: string, status: string) => {
    try {
      await adminFetch(`/candidates/${candidateId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      loadJob();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const reanalyze = async (candidateId: string) => {
    try {
      await adminFetch(`/candidates/${candidateId}/reanalyze`, { method: "POST" });
      message.info("Re-analysis started");
      loadJob();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const deleteCandidate = (candidateId: string, name: string) => {
    Modal.confirm({
      title: `Delete ${name}?`,
      content: "This will permanently delete this candidate and their analysis.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        await adminFetch(`/candidates/${candidateId}`, { method: "DELETE" });
        message.success("Candidate deleted");
        loadJob();
      },
    });
  };

  if (loading) return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;
  if (!job) return <Text type="danger">Job not found</Text>;

  const completedCandidates = job.candidates.filter((c) => c.analyisStatus === "COMPLETED");
  const avgScore = completedCandidates.length
    ? Math.round(completedCandidates.reduce((s, c) => s + (c.matchScore || 0), 0) / completedCandidates.length)
    : 0;

  const statusOptions = [
    { value: "NEW", label: "New" },
    { value: "SHORTLISTED", label: "Shortlisted" },
    { value: "INTERVIEWING", label: "Interviewing" },
    { value: "OFFERED", label: "Offered" },
    { value: "REJECTED", label: "Rejected" },
    { value: "HIRED", label: "Hired" },
  ];

  const statusColor: Record<string, string> = {
    NEW: "default", SHORTLISTED: "blue", INTERVIEWING: "orange",
    OFFERED: "green", REJECTED: "red", HIRED: "cyan",
  };

  const analysisStatusIcon = (s: string) => {
    if (s === "COMPLETED") return <Tag color="green">Analysed</Tag>;
    if (s === "ANALYZING") return <Tag color="processing">Analysing...</Tag>;
    if (s === "PENDING") return <Tag color="default">Pending</Tag>;
    return <Tag color="red">Failed</Tag>;
  };

  return (
    <div>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate("/admin/jobs")}
        style={{ padding: 0, marginBottom: 16 }}
      >
        Back to Jobs
      </Button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>{job.title}</Title>
          <Space style={{ marginTop: 4 }}>
            {job.department && <Tag>{job.department}</Tag>}
            {job.location && <Tag>{job.location}</Tag>}
            <Tag>{job.workMode}</Tag>
            {job.experienceLevel && <Tag color="blue">{job.experienceLevel}</Tag>}
            <Tag color={job.status === "OPEN" ? "green" : "default"}>{job.status}</Tag>
          </Space>
        </div>
        <Row gutter={16}>
          <Col>
            <Statistic title="Candidates" value={job.candidates.length} />
          </Col>
          <Col>
            <Statistic
              title="Avg Score"
              value={avgScore}
              suffix="/100"
              valueStyle={{ color: avgScore >= 75 ? "#10b981" : avgScore >= 50 ? "#f59e0b" : "#ef4444" }}
            />
          </Col>
        </Row>
      </div>

      {/* Upload Area */}
      <Card style={{ marginBottom: 24 }}>
        <Dragger
          accept=".pdf,.docx,.doc,.txt"
          multiple
          showUploadList={false}
          beforeUpload={(_, fileList) => {
            handleUpload(fileList as unknown as File[]);
            return false;
          }}
          disabled={uploading}
          className="cv-upload-area"
          style={{ border: "none", background: "transparent" }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ fontSize: 40, color: "#e74c3c" }} />
          </p>
          <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 500 }}>
            {uploading ? "Uploading..." : "Drop CVs here or click to upload"}
          </p>
          <p className="ant-upload-hint">
            PDF, DOCX, DOC, or TXT — up to 50 files at once
          </p>
        </Dragger>
      </Card>

      {/* Candidate Table */}
      <Card title={`Candidates (${job.candidates.length})`}>
        <Table
          dataSource={job.candidates}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          columns={[
            {
              title: "Candidate",
              dataIndex: "name",
              render: (name: string, record: Candidate) => (
                <a onClick={() => navigate(`/admin/candidates/${record.id}`)}>
                  <UserOutlined style={{ marginRight: 8 }} />
                  {name}
                </a>
              ),
            },
            {
              title: "Score",
              dataIndex: "matchScore",
              sorter: (a: Candidate, b: Candidate) => (a.matchScore || 0) - (b.matchScore || 0),
              defaultSortOrder: "descend" as const,
              render: (s: number | null) =>
                s != null ? (
                  <Progress
                    percent={s}
                    size="small"
                    strokeColor={s >= 75 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444"}
                    format={(p) => `${p}`}
                    style={{ width: 100 }}
                  />
                ) : (
                  <Text type="secondary">—</Text>
                ),
            },
            {
              title: "Recommendation",
              render: (_: any, record: Candidate) => {
                const rec = record.analysis?.recommendedNextSteps;
                if (!rec) return <Text type="secondary">—</Text>;
                const color = rec === "STRONG_YES" ? "green" : rec === "YES" ? "blue" : rec === "MAYBE" ? "orange" : "red";
                return <Tag color={color}>{rec.replace(/_/g, " ")}</Tag>;
              },
            },
            {
              title: "Analysis",
              dataIndex: "analyisStatus",
              render: analysisStatusIcon,
            },
            {
              title: "Status",
              dataIndex: "status",
              render: (status: string, record: Candidate) => (
                <Select
                  size="small"
                  value={status}
                  style={{ width: 130 }}
                  options={statusOptions}
                  onChange={(val) => updateStatus(record.id, val)}
                  onClick={(e) => e.stopPropagation()}
                />
              ),
            },
            {
              title: "CV",
              dataIndex: "cvFileName",
              render: (f: string) => f ? <Text type="secondary" style={{ fontSize: 12 }}>{f}</Text> : null,
            },
            {
              title: "",
              width: 80,
              render: (_: any, record: Candidate) => (
                <Space onClick={(e) => e.stopPropagation()}>
                  {record.analyisStatus === "FAILED" && (
                    <Tooltip title="Re-analyse">
                      <Button size="small" icon={<ReloadOutlined />} onClick={() => reanalyze(record.id)} />
                    </Tooltip>
                  )}
                  <Tooltip title="Delete">
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteCandidate(record.id, record.name)} />
                  </Tooltip>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
