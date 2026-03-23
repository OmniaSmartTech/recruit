import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Typography, Tag, Button, Space, Spin, Progress, Row, Col, Statistic, Select, Tooltip } from "antd";
import { ArrowLeftOutlined, UserOutlined, CheckCircleOutlined, WarningOutlined, TrophyOutlined } from "@ant-design/icons";
import { adminFetch } from "../../utils/api";
import DataTable, { DataTableColumn } from "../../components/shared/DataTable";

const { Title, Text, Paragraph } = Typography;

interface ResultRow {
  id: string;
  candidateId: string;
  candidate: { id: string; name: string; email: string | null; currentRole: string | null; yearsExp: number | null; skills: string[] };
  preFilterScore: number;
  aiScore: number | null;
  analysis: any;
  analysisStatus: string;
  status: string;
}

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [matchRun, setMatchRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = () => {
    if (!id) return;
    adminFetch(`/admin/matches/${id}`).then(setMatchRun).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, [id]);

  useEffect(() => {
    if (!matchRun) return;
    const isRunning = ["PENDING", "PRE_FILTERING", "ANALYZING"].includes(matchRun.status);
    if (isRunning && !pollRef.current) pollRef.current = setInterval(loadData, 3000);
    else if (!isRunning && pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, [matchRun]);

  if (loading) return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;
  if (!matchRun) return <Text type="danger">Not found</Text>;

  const results: ResultRow[] = (matchRun.results || []).filter((r: any) => r.analysisStatus === "COMPLETED");
  const scoreColor = (s: number) => s >= 75 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444";
  const recColor: Record<string, string> = { STRONG_YES: "green", YES: "blue", MAYBE: "orange", NO: "red" };

  const columns: DataTableColumn<ResultRow>[] = [
    {
      title: "#", key: "rank", width: 50,
      render: (_: unknown, __: ResultRow, i: number) => <Text strong>{i + 1}</Text>,
    },
    {
      title: "Candidate", key: "name", sortable: true, width: 180,
      render: (_: unknown, r: ResultRow) => <><UserOutlined style={{ marginRight: 6 }} />{r.candidate?.name}</>,
      filterRender: (_, r) => r.candidate?.name || "",
    },
    {
      title: "Current Role", key: "currentRole", width: 160,
      render: (_: unknown, r: ResultRow) => r.candidate?.currentRole || "—",
      filterRender: (_, r) => r.candidate?.currentRole || "",
    },
    {
      title: "Skills", key: "skills", width: 200,
      render: (_: unknown, r: ResultRow) => (
        <Space wrap size={2}>
          {(r.candidate?.skills || []).slice(0, 3).map((s) => <Tag key={s} color="blue">{s}</Tag>)}
          {(r.candidate?.skills || []).length > 3 && <Tag>+{r.candidate.skills.length - 3}</Tag>}
        </Space>
      ),
      filterRender: (_, r) => (r.candidate?.skills || []).join(", "),
    },
    {
      title: "AI Score", dataIndex: "aiScore", key: "aiScore", sortable: true, width: 120,
      sorter: (a, b) => (a.aiScore || 0) - (b.aiScore || 0),
      render: (s: number) => s != null ? (
        <Progress percent={s} size="small" strokeColor={scoreColor(s)} format={(p) => `${p}`} style={{ width: 90 }} />
      ) : "—",
      exportFormatter: (val) => (val as number) ?? 0,
    },
    {
      title: "Recommendation", key: "rec", width: 140,
      filterable: [
        { text: "Strong Yes", value: "STRONG_YES" }, { text: "Yes", value: "YES" },
        { text: "Maybe", value: "MAYBE" }, { text: "No", value: "NO" },
      ],
      render: (_: unknown, r: ResultRow) => {
        const rec = r.analysis?.recommendedAction;
        return rec ? <Tag color={recColor[rec]}>{rec.replace(/_/g, " ")}</Tag> : null;
      },
      filterRender: (_, r) => r.analysis?.recommendedAction || "",
    },
    {
      title: "Pre-filter", dataIndex: "preFilterScore", key: "preFilterScore", sortable: true, width: 100,
    },
  ];

  return (
    <div>
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate("/admin/matches")} style={{ padding: 0, marginBottom: 16 }}>Back to Matches</Button>

      <Title level={3}><TrophyOutlined style={{ color: "#e74c3c", marginRight: 8 }} />{matchRun.job?.title}</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={6}><Card><Statistic title="Total CVs" value={matchRun.totalCandidates} /></Card></Col>
        <Col xs={6}><Card><Statistic title="Pre-filtered" value={(matchRun.results || []).length} /></Card></Col>
        <Col xs={6}><Card><Statistic title="AI Analysed" value={results.length} /></Card></Col>
        <Col xs={6}><Card><Statistic title="Status" value={matchRun.status} valueStyle={{ fontSize: 14, color: matchRun.status === "COMPLETED" ? "#10b981" : undefined }} /></Card></Col>
      </Row>

      {matchRun.status === "ANALYZING" && (
        <Card style={{ marginBottom: 16, textAlign: "center" }}><Spin style={{ marginRight: 12 }} /><Text>AI analysis in progress...</Text></Card>
      )}

      <Card>
        <DataTable<ResultRow>
          columns={columns}
          dataSource={results.sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0))}
          rowKey="id"
          loading={false}
          customizable
          tableId="rs-match-results"
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
                              <div style={{ fontSize: 10, color: "#999", lineHeight: "14px", marginTop: 4, cursor: "help", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>{val.reasoning}</div>
                            </Tooltip>
                          )}
                        </Col>
                      ))}
                    </Row>
                  )}
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
  );
}
