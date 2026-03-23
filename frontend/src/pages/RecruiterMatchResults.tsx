import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card, Typography, Tag, Button, Table, Space, Spin, Progress,
  Select, Collapse, List, Row, Col, Statistic, Empty,
} from "antd";
import {
  ArrowLeftOutlined, UserOutlined, CheckCircleOutlined,
  CloseCircleOutlined, WarningOutlined, TrophyOutlined,
} from "@ant-design/icons";
import { getPin, pinFetch } from "../utils/api";

const { Title, Text, Paragraph } = Typography;

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
    pinFetch(`/recruiter/matches/${id}`)
      .then(setMatchRun)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [id]);

  // Poll while analyzing
  useEffect(() => {
    if (!matchRun) return;
    const isRunning = matchRun.status === "PENDING" || matchRun.status === "PRE_FILTERING" || matchRun.status === "ANALYZING";
    if (isRunning && !pollRef.current) {
      pollRef.current = setInterval(loadData, 3000);
    } else if (!isRunning && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [matchRun]);

  const updateStatus = async (resultId: string, status: string) => {
    try {
      await pinFetch(`/recruiter/results/${resultId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      loadData();
    } catch {}
  };

  if (loading) return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;
  if (!matchRun) return <Empty description="Match run not found" />;

  const results = matchRun.results || [];
  const completed = results.filter((r: any) => r.analysisStatus === "COMPLETED");
  const analyzing = results.filter((r: any) => r.analysisStatus === "ANALYZING" || r.analysisStatus === "PENDING");

  const scoreColor = (s: number) => s >= 75 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444";
  const recColor: Record<string, string> = {
    STRONG_YES: "green", YES: "blue", MAYBE: "orange", NO: "red",
  };
  const statusColor: Record<string, string> = {
    NEW: "default", SHORTLISTED: "blue", INTERVIEWING: "orange",
    OFFERED: "green", REJECTED: "red", HIRED: "cyan",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: "24px 16px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/recruit")}
          style={{ padding: 0, marginBottom: 16 }}
        >
          Back to Dashboard
        </Button>

        <Title level={3}>
          <TrophyOutlined style={{ color: "#e74c3c", marginRight: 8 }} />
          {matchRun.job?.title || "Match Results"}
        </Title>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={8}>
            <Card>
              <Statistic title="Total Scanned" value={matchRun.totalCandidates} />
            </Card>
          </Col>
          <Col xs={8}>
            <Card>
              <Statistic title="Pre-filtered" value={results.length} />
            </Card>
          </Col>
          <Col xs={8}>
            <Card>
              <Statistic
                title="Status"
                value={matchRun.status}
                valueStyle={{
                  color: matchRun.status === "COMPLETED" ? "#10b981" :
                    matchRun.status === "ANALYZING" ? "#3b82f6" : undefined,
                  fontSize: 16,
                }}
              />
            </Card>
          </Col>
        </Row>

        {analyzing.length > 0 && (
          <Card style={{ marginBottom: 16, textAlign: "center" }}>
            <Spin style={{ marginRight: 12 }} />
            <Text>Analysing {analyzing.length} candidate(s)...</Text>
          </Card>
        )}

        <Card title={`Ranked Candidates (${completed.length})`}>
          <Table
            dataSource={completed.sort((a: any, b: any) => (b.aiScore || 0) - (a.aiScore || 0))}
            rowKey="id"
            pagination={{ pageSize: 20 }}
            expandable={{
              expandedRowRender: (record: any) => {
                const a = record.analysis || {};
                return (
                  <div style={{ padding: "8px 0" }}>
                    {a.summary && <Paragraph>{a.summary}</Paragraph>}

                    {a.scoreBreakdown && (
                      <Row gutter={16} style={{ marginBottom: 16 }}>
                        {Object.entries(a.scoreBreakdown).map(([key, val]: [string, any]) => (
                          <Col xs={6} key={key}>
                            <div style={{ textAlign: "center" }}>
                              <Progress
                                type="circle"
                                percent={val.score}
                                size={60}
                                strokeColor={scoreColor(val.score)}
                                format={(p) => `${p}`}
                              />
                              <div style={{ marginTop: 4, textTransform: "capitalize", fontSize: 12 }}>{key}</div>
                            </div>
                          </Col>
                        ))}
                      </Row>
                    )}

                    {a.strengths?.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <Text strong style={{ color: "#10b981" }}><CheckCircleOutlined /> Strengths:</Text>
                        <ul style={{ paddingLeft: 20, marginTop: 4 }}>
                          {a.strengths.map((s: any, i: number) => (
                            <li key={i}><strong>{s.area}:</strong> {s.detail}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {a.gaps?.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <Text strong style={{ color: "#f59e0b" }}><WarningOutlined /> Gaps:</Text>
                        <ul style={{ paddingLeft: 20, marginTop: 4 }}>
                          {a.gaps.map((g: any, i: number) => (
                            <li key={i}>
                              <Tag color={g.severity === "HIGH" ? "red" : g.severity === "MEDIUM" ? "orange" : "default"}>
                                {g.severity}
                              </Tag>
                              <strong>{g.area}:</strong> {g.detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {a.mustHaveChecklist?.length > 0 && (
                      <div>
                        <Text strong>Requirements:</Text>
                        <List
                          size="small"
                          dataSource={a.mustHaveChecklist}
                          renderItem={(item: any) => (
                            <List.Item style={{ padding: "4px 0" }}>
                              {item.met ? (
                                <CheckCircleOutlined style={{ color: "#10b981", marginRight: 8 }} />
                              ) : (
                                <CloseCircleOutlined style={{ color: "#ef4444", marginRight: 8 }} />
                              )}
                              {item.requirement}
                              {item.evidence && <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>({item.evidence})</Text>}
                            </List.Item>
                          )}
                        />
                      </div>
                    )}
                  </div>
                );
              },
            }}
            columns={[
              {
                title: "#",
                width: 50,
                render: (_: any, __: any, index: number) => <Text strong>{index + 1}</Text>,
              },
              {
                title: "Candidate",
                dataIndex: "candidateName",
                render: (name: string) => <><UserOutlined style={{ marginRight: 8 }} />{name}</>,
              },
              { title: "Current Role", dataIndex: "currentRole" },
              {
                title: "AI Score",
                dataIndex: "aiScore",
                render: (s: number) => s != null ? (
                  <Progress
                    percent={s}
                    size="small"
                    strokeColor={scoreColor(s)}
                    format={(p) => `${p}`}
                    style={{ width: 100 }}
                  />
                ) : <Text type="secondary">—</Text>,
              },
              {
                title: "Recommendation",
                render: (_: any, record: any) => {
                  const rec = record.analysis?.recommendedAction;
                  if (!rec) return null;
                  return <Tag color={recColor[rec] || "default"}>{rec.replace(/_/g, " ")}</Tag>;
                },
              },
              {
                title: "Status",
                dataIndex: "status",
                render: (status: string, record: any) => (
                  <Select
                    size="small"
                    value={status}
                    style={{ width: 130 }}
                    options={[
                      { value: "NEW", label: "New" },
                      { value: "SHORTLISTED", label: "Shortlisted" },
                      { value: "INTERVIEWING", label: "Interviewing" },
                      { value: "OFFERED", label: "Offered" },
                      { value: "REJECTED", label: "Rejected" },
                      { value: "HIRED", label: "Hired" },
                    ]}
                    onChange={(val) => updateStatus(record.id, val)}
                  />
                ),
              },
              {
                title: "Pre-filter",
                dataIndex: "preFilterScore",
                render: (s: number) => <Text type="secondary">{s}</Text>,
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
