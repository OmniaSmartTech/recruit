import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Typography, Tag, Button, Space, Spin, Progress, Select, Row, Col, Statistic, Empty, Tooltip, App } from "antd";
import { ArrowLeftOutlined, UserOutlined, CheckCircleOutlined, WarningOutlined, TrophyOutlined } from "@ant-design/icons";
import { getPin, pinFetch } from "../utils/api";
import DataTable, { DataTableColumn } from "../components/shared/DataTable";

const { Title, Text, Paragraph } = Typography;

interface ResultRow {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string | null;
  currentRole: string | null;
  yearsExp: number | null;
  skills: string[];
  preFilterScore: number;
  aiScore: number | null;
  analysis: any;
  analysisStatus: string;
  status: string;
}

export default function RecruiterMatchResults() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [matchRun, setMatchRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pin = getPin();
  if (!pin) { navigate("/"); return null; }

  const loadData = () => {
    if (!id) return;
    pinFetch(`/recruiter/matches/${id}`).then(setMatchRun).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, [id]);

  useEffect(() => {
    if (!matchRun) return;
    const isRunning = ["PENDING", "PRE_FILTERING", "ANALYZING"].includes(matchRun.status);
    if (isRunning && !pollRef.current) pollRef.current = setInterval(loadData, 3000);
    else if (!isRunning && pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, [matchRun]);

  const updateStatus = async (resultId: string, status: string) => {
    try { await pinFetch(`/recruiter/results/${resultId}`, { method: "PATCH", body: JSON.stringify({ status }) }); loadData(); } catch {}
  };

  if (loading) return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;
  if (!matchRun) return <Empty description="Match run not found" />;

  const results: ResultRow[] = (matchRun.results || []).filter((r: any) => r.analysisStatus === "COMPLETED");
  const analyzing = (matchRun.results || []).filter((r: any) => ["ANALYZING", "PENDING"].includes(r.analysisStatus));
  const scoreColor = (s: number) => s >= 75 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444";
  const recColor: Record<string, string> = { STRONG_YES: "green", YES: "blue", MAYBE: "orange", NO: "red" };

  const columns: DataTableColumn<ResultRow>[] = [
    { title: "#", key: "rank", width: 50, render: (_: unknown, __: ResultRow, i: number) => <Text strong>{i + 1}</Text> },
    {
      title: "Candidate", dataIndex: "candidateName", key: "candidateName", sortable: true, width: 180,
      render: (name: string) => <><UserOutlined style={{ marginRight: 6 }} />{name}</>,
    },
    { title: "Current Role", dataIndex: "currentRole", key: "currentRole", width: 160 },
    {
      title: "Skills", dataIndex: "skills", key: "skills", width: 200,
      render: (skills: string[]) => (
        <Space wrap size={2}>
          {(skills || []).slice(0, 3).map((s) => <Tag key={s} color="blue">{s}</Tag>)}
          {(skills || []).length > 3 && <Tag>+{skills.length - 3}</Tag>}
        </Space>
      ),
      filterRender: (val) => (val as string[] || []).join(", "),
    },
    {
      title: "AI Score", dataIndex: "aiScore", key: "aiScore", sortable: true, width: 120,
      sorter: (a, b) => (a.aiScore || 0) - (b.aiScore || 0),
      render: (s: number) => s != null ? <Progress percent={s} size="small" strokeColor={scoreColor(s)} format={(p) => `${p}`} style={{ width: 90 }} /> : "—",
    },
    {
      title: "Recommendation", key: "rec", width: 140,
      filterable: [{ text: "Strong Yes", value: "STRONG_YES" }, { text: "Yes", value: "YES" }, { text: "Maybe", value: "MAYBE" }, { text: "No", value: "NO" }],
      render: (_: unknown, r: ResultRow) => { const rec = r.analysis?.recommendedAction; return rec ? <Tag color={recColor[rec]}>{rec.replace(/_/g, " ")}</Tag> : null; },
      filterRender: (_, r) => r.analysis?.recommendedAction || "",
    },
    {
      title: "Status", dataIndex: "status", key: "status", width: 140,
      filterable: [{ text: "New", value: "NEW" }, { text: "Shortlisted", value: "SHORTLISTED" }, { text: "Interviewing", value: "INTERVIEWING" }, { text: "Offered", value: "OFFERED" }, { text: "Rejected", value: "REJECTED" }, { text: "Hired", value: "HIRED" }],
      render: (status: string, record: ResultRow) => (
        <Select size="small" value={status} style={{ width: 130 }}
          options={[{ value: "NEW", label: "New" }, { value: "SHORTLISTED", label: "Shortlisted" }, { value: "INTERVIEWING", label: "Interviewing" }, { value: "OFFERED", label: "Offered" }, { value: "REJECTED", label: "Rejected" }, { value: "HIRED", label: "Hired" }]}
          onChange={(val) => updateStatus(record.id, val)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    { title: "Pre-filter", dataIndex: "preFilterScore", key: "preFilterScore", sortable: true, width: 90 },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: "24px 16px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate("/recruit")} style={{ padding: 0, marginBottom: 16 }}>Back to Dashboard</Button>

        <Title level={3}><TrophyOutlined style={{ color: "#e74c3c", marginRight: 8 }} />{matchRun.job?.title || "Match Results"}</Title>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={8}><Card><Statistic title="Total Scanned" value={matchRun.totalCandidates} /></Card></Col>
          <Col xs={8}><Card><Statistic title="Pre-filtered" value={(matchRun.results || []).length} /></Card></Col>
          <Col xs={8}><Card><Statistic title="Status" value={matchRun.status} valueStyle={{ color: matchRun.status === "COMPLETED" ? "#10b981" : undefined, fontSize: 14 }} /></Card></Col>
        </Row>

        {analyzing.length > 0 && (
          <Card style={{ marginBottom: 16, textAlign: "center" }}><Spin style={{ marginRight: 12 }} /><Text>Analysing {analyzing.length} candidate(s)...</Text></Card>
        )}

        <Card>
          <DataTable<ResultRow>
            columns={columns}
            dataSource={results.sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0))}
            rowKey="id"
            customizable
            tableId="rs-recruiter-results"
            exportable
            exportFilename={`match-${matchRun.job?.title || "results"}`}
            searchPlaceholder="Search candidates..."
            scrollHeight={500}
            expandable={{
              expandedRowRender: (record: ResultRow) => {
                const a = record.analysis || {};
                return (
                  <div style={{ padding: 8 }}>
                    {a.summary && <Paragraph>{a.summary}</Paragraph>}
                    {a.scoreBreakdown && (
                      <Row gutter={16} style={{ marginBottom: 16 }}>
                        {Object.entries(a.scoreBreakdown).map(([key, val]: [string, any]) => (
                          <Col xs={6} key={key} style={{ textAlign: "center" }}>
                            <Progress type="circle" percent={val.score} size={60} strokeColor={scoreColor(val.score)} format={(p) => `${p}`} />
                            <div style={{ marginTop: 4, textTransform: "capitalize", fontSize: 12, fontWeight: 500 }}>{key}</div>
                            {val.reasoning && (
                              <Tooltip title={val.reasoning}>
                                <div className="score-reasoning-clamp">{val.reasoning}</div>
                              </Tooltip>
                            )}
                          </Col>
                        ))}
                      </Row>
                    )}
                    {a.strengths?.length > 0 && <div style={{ marginTop: 16, borderTop: "1px solid #f0f0f0", paddingTop: 12 }} />}
                    {a.strengths?.map((s: any, i: number) => (
                      <div key={i}><CheckCircleOutlined style={{ color: "#10b981", marginRight: 4 }} /><strong>{s.area}:</strong> {s.detail}</div>
                    ))}
                    {a.gaps?.map((g: any, i: number) => (
                      <div key={i}><WarningOutlined style={{ color: "#f59e0b", marginRight: 4 }} /><Tag color={g.severity === "HIGH" ? "red" : "orange"}>{g.severity}</Tag> {g.area}: {g.detail}</div>
                    ))}
                    {a.mustHaveChecklist?.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <Text strong>Requirements:</Text>
                        {a.mustHaveChecklist.map((item: any, i: number) => (
                          <div key={i}>
                            {item.met ? <CheckCircleOutlined style={{ color: "#10b981", marginRight: 4 }} /> : <span style={{ color: "#ef4444", marginRight: 4 }}>✗</span>}
                            {item.requirement} {item.evidence && <Text type="secondary" style={{ fontSize: 11 }}>— {item.evidence}</Text>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              },
            }}
          />
        </Card>
      </div>
    </div>
  );
}
