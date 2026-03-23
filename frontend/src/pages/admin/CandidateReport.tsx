import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card, Typography, Tag, Button, Space, Spin, Progress, Divider,
  Row, Col, List, Descriptions, Dropdown, message, Tabs,
} from "antd";
import {
  ArrowLeftOutlined, FilePdfOutlined, CheckCircleOutlined,
  CloseCircleOutlined, WarningOutlined, UserOutlined,
  QuestionCircleOutlined, DownOutlined, ReloadOutlined,
} from "@ant-design/icons";
import { adminFetch } from "../../utils/api";

const { Title, Text, Paragraph } = Typography;

export default function CandidateReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<any>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = () => {
      adminFetch(`/candidates/${id}`)
        .then(setCandidate)
        .catch(console.error)
        .finally(() => setLoading(false));
    };
    load();

    // Poll if still analyzing
    const interval = setInterval(() => {
      adminFetch(`/candidates/${id}`).then((c) => {
        setCandidate(c);
        if (c.analyisStatus !== "PENDING" && c.analyisStatus !== "ANALYZING") {
          clearInterval(interval);
        }
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [id]);

  const loadInterviewQuestions = async () => {
    if (!id) return;
    setLoadingQuestions(true);
    try {
      const q = await adminFetch(`/candidates/${id}/interview-questions`);
      setQuestions(q);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const downloadPdf = (type: string) => {
    const token = localStorage.getItem("recruitsmart_access_token");
    const org = JSON.parse(localStorage.getItem("recruitsmart_org") || "{}");
    window.open(
      `/api/candidates/${id}/pdf?type=${type}&token=${token}&org=${org.recruitsmartOrgId || ""}`,
      "_blank"
    );
  };

  if (loading) return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;
  if (!candidate) return <Text type="danger">Candidate not found</Text>;

  const analysis = candidate.analysis || {};
  const job = candidate.job || {};

  if (candidate.analyisStatus === "PENDING" || candidate.analyisStatus === "ANALYZING") {
    return (
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <Spin size="large" />
        <Title level={4} style={{ marginTop: 24 }}>Analysing {candidate.name}'s CV...</Title>
        <Text type="secondary">This typically takes 15-30 seconds</Text>
      </div>
    );
  }

  if (candidate.analyisStatus === "FAILED") {
    return (
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <WarningOutlined style={{ fontSize: 48, color: "#ef4444" }} />
        <Title level={4} style={{ marginTop: 16, color: "#ef4444" }}>Analysis Failed</Title>
        <Text type="secondary">There was an error processing this CV.</Text>
        <br />
        <Button
          icon={<ReloadOutlined />}
          style={{ marginTop: 16 }}
          onClick={async () => {
            await adminFetch(`/candidates/${id}/reanalyze`, { method: "POST" });
            setCandidate({ ...candidate, analyisStatus: "PENDING" });
          }}
        >
          Retry Analysis
        </Button>
      </div>
    );
  }

  const scoreColor = (s: number) => (s >= 75 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444");
  const recColor: Record<string, string> = {
    STRONG_YES: "green", YES: "blue", MAYBE: "orange", NO: "red",
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ padding: 0, marginBottom: 16 }}
      >
        Back
      </Button>

      {/* Header */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={24} align="middle">
          <Col>
            <div
              className={`score-circle ${(candidate.matchScore || 0) >= 75 ? "score-high" : (candidate.matchScore || 0) >= 50 ? "score-medium" : "score-low"}`}
              style={{ width: 100, height: 100, fontSize: 28 }}
            >
              {candidate.matchScore}
              <small>/ 100</small>
            </div>
          </Col>
          <Col flex="auto">
            <Title level={3} style={{ margin: 0 }}>
              <UserOutlined style={{ marginRight: 8 }} />
              {candidate.name}
            </Title>
            <Text type="secondary">
              Applying for: <strong>{job.title}</strong>
            </Text>
            <br />
            {analysis.currentRole && <Text>{analysis.currentRole}</Text>}
            <br />
            {analysis.recommendedNextSteps && (
              <Tag color={recColor[analysis.recommendedNextSteps] || "default"} style={{ marginTop: 8, fontSize: 14, padding: "4px 12px" }}>
                {analysis.recommendedNextSteps.replace(/_/g, " ")}
              </Tag>
            )}
          </Col>
          <Col>
            <Space direction="vertical">
              <Dropdown menu={{
                items: [
                  { key: "internal", label: "Internal Report", onClick: () => downloadPdf("internal") },
                  { key: "external", label: "Client Report", onClick: () => downloadPdf("external") },
                ],
              }}>
                <Button icon={<FilePdfOutlined />}>
                  Download PDF <DownOutlined />
                </Button>
              </Dropdown>
              <Button
                loading={loadingQuestions}
                icon={<QuestionCircleOutlined />}
                onClick={loadInterviewQuestions}
              >
                Interview Questions
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Summary */}
      {analysis.candidateSummary && (
        <Card title="Summary" style={{ marginBottom: 16 }}>
          <Paragraph>{analysis.candidateSummary}</Paragraph>
          {analysis.yearsExperience && (
            <Text type="secondary">Years of experience: ~{analysis.yearsExperience}</Text>
          )}
          {analysis.educationSummary && (
            <>
              <br />
              <Text type="secondary">Education: {analysis.educationSummary}</Text>
            </>
          )}
          {analysis.careerProgression && (
            <>
              <br />
              <Text type="secondary">Career: {analysis.careerProgression}</Text>
            </>
          )}
        </Card>
      )}

      {/* Score Breakdown */}
      {analysis.scoreBreakdown && (
        <Card title="Score Breakdown" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            {Object.entries(analysis.scoreBreakdown).map(([key, val]: [string, any]) => (
              <Col xs={12} sm={6} key={key}>
                <div style={{ textAlign: "center" }}>
                  <Progress
                    type="circle"
                    percent={val.score}
                    size={80}
                    strokeColor={scoreColor(val.score)}
                    format={(p) => `${p}`}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Text strong style={{ textTransform: "capitalize" }}>{key}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>Weight: {val.weight}%</Text>
                  </div>
                </div>
                {val.reasoning && (
                  <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
                    {val.reasoning}
                  </Paragraph>
                )}
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* Requirements Checklist */}
      {analysis.mustHaveChecklist?.length > 0 && (
        <Card title="Requirements Checklist" style={{ marginBottom: 16 }}>
          <List
            size="small"
            dataSource={[
              ...(analysis.mustHaveChecklist || []).map((r: any) => ({ ...r, type: "Must Have" })),
              ...(analysis.niceToHaveChecklist || []).map((r: any) => ({ ...r, type: "Nice to Have" })),
            ]}
            renderItem={(item: any) => (
              <List.Item>
                <Space>
                  {item.met ? (
                    <CheckCircleOutlined style={{ color: "#10b981" }} />
                  ) : (
                    <CloseCircleOutlined style={{ color: "#ef4444" }} />
                  )}
                  <div>
                    <Text strong>{item.requirement}</Text>
                    <Tag style={{ marginLeft: 8, fontSize: 11 }}>{item.type}</Tag>
                    {item.evidence && (
                      <Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }}>
                        {item.evidence}
                      </Paragraph>
                    )}
                  </div>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {/* Strengths */}
        {analysis.strengths?.length > 0 && (
          <Col xs={24} sm={12}>
            <Card title={<><CheckCircleOutlined style={{ color: "#10b981", marginRight: 8 }} />Strengths</>}>
              {analysis.strengths.map((s: any, i: number) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <Text strong>{s.area}</Text>
                  <Paragraph type="secondary" style={{ margin: 0 }}>{s.detail}</Paragraph>
                </div>
              ))}
            </Card>
          </Col>
        )}

        {/* Gaps */}
        {analysis.gaps?.length > 0 && (
          <Col xs={24} sm={12}>
            <Card title={<><WarningOutlined style={{ color: "#f59e0b", marginRight: 8 }} />Gaps & Risks</>}>
              {analysis.gaps.map((g: any, i: number) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <Space>
                    <Tag color={g.severity === "HIGH" ? "red" : g.severity === "MEDIUM" ? "orange" : "default"}>
                      {g.severity}
                    </Tag>
                    <Text strong>{g.area}</Text>
                  </Space>
                  <Paragraph type="secondary" style={{ margin: 0 }}>{g.detail}</Paragraph>
                </div>
              ))}
            </Card>
          </Col>
        )}
      </Row>

      {/* Key Skills */}
      {analysis.keySkills?.length > 0 && (
        <Card title="Key Skills" style={{ marginBottom: 16 }}>
          <Space wrap>
            {analysis.keySkills.map((skill: string, i: number) => (
              <Tag key={i} color="blue">{skill}</Tag>
            ))}
          </Space>
        </Card>
      )}

      {/* Red Flags */}
      {analysis.redFlags?.length > 0 && (
        <Card
          title={<><WarningOutlined style={{ color: "#ef4444", marginRight: 8 }} />Red Flags</>}
          style={{ marginBottom: 16, borderLeft: "4px solid #ef4444" }}
        >
          <List
            size="small"
            dataSource={analysis.redFlags}
            renderItem={(flag: string) => (
              <List.Item>
                <Text>{flag}</Text>
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* Interview Focus Areas */}
      {analysis.interviewFocusAreas?.length > 0 && (
        <Card title="Interview Focus Areas" style={{ marginBottom: 16 }}>
          <List
            size="small"
            dataSource={analysis.interviewFocusAreas}
            renderItem={(area: string) => (
              <List.Item>
                <QuestionCircleOutlined style={{ color: "#e74c3c", marginRight: 8 }} />
                {area}
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* Salary Estimate */}
      {analysis.salaryEstimate && (
        <Card title="Salary Expectation Estimate" style={{ marginBottom: 16 }}>
          <Text>{analysis.salaryEstimate}</Text>
        </Card>
      )}

      {/* AI-Generated Interview Questions */}
      {questions && (
        <Card title="AI-Generated Interview Questions" style={{ marginBottom: 16 }}>
          <Tabs items={[
            {
              key: "technical",
              label: "Technical",
              children: (
                <List
                  dataSource={questions.technicalQuestions || []}
                  renderItem={(q: any) => (
                    <List.Item>
                      <div>
                        <Text strong>{q.question}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>Purpose: {q.purpose}</Text>
                        <br />
                        <Text type="success" style={{ fontSize: 12 }}>Look for: {q.lookFor}</Text>
                      </div>
                    </List.Item>
                  )}
                />
              ),
            },
            {
              key: "behavioural",
              label: "Behavioural",
              children: (
                <List
                  dataSource={questions.behaviouralQuestions || []}
                  renderItem={(q: any) => (
                    <List.Item>
                      <div>
                        <Text strong>{q.question}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>Purpose: {q.purpose}</Text>
                        <br />
                        <Text type="success" style={{ fontSize: 12 }}>Look for: {q.lookFor}</Text>
                      </div>
                    </List.Item>
                  )}
                />
              ),
            },
            {
              key: "gaps",
              label: "Gap Probing",
              children: (
                <List
                  dataSource={questions.gapProbing || []}
                  renderItem={(q: any) => (
                    <List.Item>
                      <div>
                        <Text strong>{q.question}</Text>
                        <br />
                        <Tag color="orange" style={{ fontSize: 11 }}>Gap: {q.gap}</Tag>
                        <br />
                        <Text type="success" style={{ fontSize: 12 }}>Look for: {q.lookFor}</Text>
                      </div>
                    </List.Item>
                  )}
                />
              ),
            },
            {
              key: "cultural",
              label: "Cultural Fit",
              children: (
                <List
                  dataSource={questions.culturalFit || []}
                  renderItem={(q: any) => (
                    <List.Item>
                      <div>
                        <Text strong>{q.question}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>Purpose: {q.purpose}</Text>
                        <br />
                        <Text type="success" style={{ fontSize: 12 }}>Look for: {q.lookFor}</Text>
                      </div>
                    </List.Item>
                  )}
                />
              ),
            },
          ]} />
        </Card>
      )}
    </div>
  );
}
