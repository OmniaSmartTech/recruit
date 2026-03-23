import { useState, useEffect } from "react";
import { Card, Typography, Tag, Spin, Empty, Progress, Row, Col, Divider } from "antd";
import { TrophyOutlined, UserOutlined, CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { shareFetch } from "../utils/api";

const { Title, Text, Paragraph } = Typography;

interface CandidatePreview {
  id: string;
  name: string;
  matchScore: number | null;
  status: string;
  analysis: any;
  createdAt: string;
}

interface JobWithCandidates {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  candidates: CandidatePreview[];
}

export default function SharedView() {
  const [jobs, setJobs] = useState<JobWithCandidates[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CandidatePreview | null>(null);

  useEffect(() => {
    shareFetch("/share/jobs")
      .then(setJobs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!jobs.length) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Empty description="No shortlisted candidates available yet" />
      </div>
    );
  }

  const scoreColor = (s: number) => (s >= 75 ? "green" : s >= 50 ? "orange" : "red");

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <Title level={2} style={{ textAlign: "center", marginBottom: 32 }}>
        <TrophyOutlined style={{ color: "#e74c3c", marginRight: 8 }} />
        Candidate Shortlist
      </Title>

      {jobs.map((job) => (
        <div key={job.id} style={{ marginBottom: 32 }}>
          <Title level={4}>
            {job.title}
            {job.department && <Text type="secondary"> — {job.department}</Text>}
          </Title>
          {job.location && <Text type="secondary">{job.location}</Text>}

          {job.candidates.length === 0 ? (
            <Empty description="No shortlisted candidates yet" style={{ margin: "20px 0" }} />
          ) : (
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              {job.candidates.map((c) => (
                <Col xs={24} sm={12} key={c.id}>
                  <Card
                    hoverable
                    onClick={() => setSelected(selected?.id === c.id ? null : c)}
                    style={{
                      borderLeft: `4px solid ${c.matchScore && c.matchScore >= 75 ? "#10b981" : c.matchScore && c.matchScore >= 50 ? "#f59e0b" : "#ef4444"}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <Text strong style={{ fontSize: 16 }}>
                          <UserOutlined style={{ marginRight: 8 }} />
                          {c.name}
                        </Text>
                        <br />
                        <Tag color={
                          c.status === "SHORTLISTED" ? "blue" :
                          c.status === "INTERVIEWING" ? "orange" :
                          c.status === "OFFERED" ? "green" : "default"
                        }>
                          {c.status}
                        </Tag>
                      </div>
                      {c.matchScore != null && (
                        <div style={{ textAlign: "center" }}>
                          <Progress
                            type="circle"
                            percent={c.matchScore}
                            size={60}
                            strokeColor={scoreColor(c.matchScore)}
                            format={(p) => `${p}`}
                          />
                          <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>Match</div>
                        </div>
                      )}
                    </div>

                    {selected?.id === c.id && c.analysis && (
                      <div style={{ marginTop: 16 }}>
                        <Divider style={{ margin: "12px 0" }} />
                        {c.analysis.candidateSummary && (
                          <Paragraph>{c.analysis.candidateSummary}</Paragraph>
                        )}
                        {c.analysis.strengths?.length > 0 && (
                          <>
                            <Text strong style={{ color: "#10b981" }}>Strengths:</Text>
                            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
                              {c.analysis.strengths.map((s: any, i: number) => (
                                <li key={i}>
                                  <CheckCircleOutlined style={{ color: "#10b981", marginRight: 4 }} />
                                  <strong>{s.area}:</strong> {s.detail}
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                        {c.analysis.gaps?.length > 0 && (
                          <>
                            <Text strong style={{ color: "#f59e0b" }}>Areas to Explore:</Text>
                            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
                              {c.analysis.gaps.filter((g: any) => g.severity !== "LOW").map((g: any, i: number) => (
                                <li key={i}>
                                  <CloseCircleOutlined style={{ color: "#f59e0b", marginRight: 4 }} />
                                  <strong>{g.area}:</strong> {g.detail}
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </div>
      ))}
    </div>
  );
}
