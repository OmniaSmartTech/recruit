import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card, Typography, Tag, Button, Space, Spin, Empty, Rate, Input,
  Select, message, Divider, Row, Col, Badge,
} from "antd";
import {
  ArrowLeftOutlined, UserOutlined, CalendarOutlined, CheckCircleOutlined,
  VideoCameraOutlined, PhoneOutlined, TeamOutlined, SendOutlined,
} from "@ant-design/icons";
import { getPin, pinFetch } from "../utils/api";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const typeIcons: Record<string, React.ReactNode> = {
  VIDEO: <VideoCameraOutlined />,
  PHONE: <PhoneOutlined />,
  IN_PERSON: <TeamOutlined />,
  ASSESSMENT: <CalendarOutlined />,
};

export default function InterviewerPortal() {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  // Feedback form state per interview
  const [feedbackForms, setFeedbackForms] = useState<Record<string, any>>({});

  const pin = getPin();
  if (!pin) { navigate("/"); return null; }

  useEffect(() => {
    pinFetch("/interviews/my").then(setInterviews).catch(console.error).finally(() => setLoading(false));
  }, []);

  const updateFeedback = (interviewId: string, field: string, value: any) => {
    setFeedbackForms((prev) => ({
      ...prev,
      [interviewId]: { ...prev[interviewId], [field]: value },
    }));
  };

  const submitFeedback = async (interviewId: string) => {
    setSubmitting(interviewId);
    try {
      const form = feedbackForms[interviewId] || {};
      await pinFetch(`/interviews/${interviewId}/feedback`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      message.success("Feedback submitted — thank you!");
      // Reload
      pinFetch("/interviews/my").then(setInterviews);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: "24px 16px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate("/")} style={{ padding: 0, marginBottom: 16 }}>
          Back
        </Button>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/logo-dark.png" alt="RecruitSmart" style={{ height: 40, marginBottom: 12 }} />
          <Title level={3}>Interview Portal</Title>
          <Text type="secondary">Review candidates and submit your feedback</Text>
        </div>

        {interviews.length === 0 ? (
          <Empty description="No interviews assigned to you" />
        ) : (
          interviews.map((interview) => {
            const candidate = interview.jobCandidate?.candidate;
            const job = interview.jobCandidate?.job;
            const hasSubmitted = interview.feedback?.length > 0;
            const form = feedbackForms[interview.id] || {};

            return (
              <Card key={interview.id} style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col flex="auto">
                    <Space>
                      {typeIcons[interview.type] || <CalendarOutlined />}
                      <Title level={5} style={{ margin: 0 }}>{interview.title}</Title>
                      <Tag color={interview.status === "COMPLETED" ? "green" : interview.status === "CANCELLED" ? "red" : "blue"}>
                        {interview.status}
                      </Tag>
                    </Space>
                    <div style={{ marginTop: 8 }}>
                      <Text strong><UserOutlined /> {candidate?.name}</Text>
                      {candidate?.currentRole && <Text type="secondary"> — {candidate.currentRole}</Text>}
                    </div>
                    <Text type="secondary">Position: {job?.title}</Text>
                    {interview.scheduledAt && (
                      <div><CalendarOutlined /> {new Date(interview.scheduledAt).toLocaleString()}{interview.durationMinutes && ` (${interview.durationMinutes} min)`}</div>
                    )}
                    {interview.meetingLink && (
                      <div><a href={interview.meetingLink} target="_blank" rel="noopener noreferrer">Join meeting</a></div>
                    )}
                    {candidate?.skills?.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        {candidate.skills.slice(0, 6).map((s: string) => <Tag key={s} color="blue">{s}</Tag>)}
                      </div>
                    )}
                  </Col>
                </Row>

                {interview.notes && (
                  <div style={{ marginTop: 12, padding: 8, background: "#f6f6f6", borderRadius: 6 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Recruiter notes:</Text>
                    <Paragraph style={{ margin: 0 }}>{interview.notes}</Paragraph>
                  </div>
                )}

                {hasSubmitted ? (
                  <div style={{ marginTop: 16, padding: 12, background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
                    <CheckCircleOutlined style={{ color: "#10b981", marginRight: 8 }} />
                    <Text strong style={{ color: "#10b981" }}>Feedback submitted</Text>
                  </div>
                ) : (
                  <>
                    <Divider>Your Feedback</Divider>
                    <Row gutter={[16, 12]}>
                      <Col xs={12} sm={8}>
                        <Text type="secondary">Technical Skills</Text>
                        <br /><Rate value={form.technicalSkills} onChange={(v) => updateFeedback(interview.id, "technicalSkills", v)} />
                      </Col>
                      <Col xs={12} sm={8}>
                        <Text type="secondary">Problem Solving</Text>
                        <br /><Rate value={form.problemSolving} onChange={(v) => updateFeedback(interview.id, "problemSolving", v)} />
                      </Col>
                      <Col xs={12} sm={8}>
                        <Text type="secondary">Communication</Text>
                        <br /><Rate value={form.communication} onChange={(v) => updateFeedback(interview.id, "communication", v)} />
                      </Col>
                      <Col xs={12} sm={8}>
                        <Text type="secondary">Cultural Fit</Text>
                        <br /><Rate value={form.culturalFit} onChange={(v) => updateFeedback(interview.id, "culturalFit", v)} />
                      </Col>
                      <Col xs={12} sm={8}>
                        <Text type="secondary">Leadership</Text>
                        <br /><Rate value={form.leadership} onChange={(v) => updateFeedback(interview.id, "leadership", v)} />
                      </Col>
                      <Col xs={12} sm={8}>
                        <Text type="secondary">Overall</Text>
                        <br /><Rate value={form.overallRating} onChange={(v) => updateFeedback(interview.id, "overallRating", v)} />
                      </Col>
                    </Row>
                    <TextArea rows={2} placeholder="Strengths observed..." value={form.strengths || ""} onChange={(e) => updateFeedback(interview.id, "strengths", e.target.value)} style={{ marginTop: 12 }} />
                    <TextArea rows={2} placeholder="Concerns or areas to explore..." value={form.concerns || ""} onChange={(e) => updateFeedback(interview.id, "concerns", e.target.value)} style={{ marginTop: 8 }} />
                    <TextArea rows={2} placeholder="Additional notes..." value={form.notes || ""} onChange={(e) => updateFeedback(interview.id, "notes", e.target.value)} style={{ marginTop: 8 }} />
                    <Select
                      placeholder="Your recommendation"
                      value={form.recommendation}
                      onChange={(v) => updateFeedback(interview.id, "recommendation", v)}
                      style={{ width: 200, marginTop: 8 }}
                      options={[
                        { value: "STRONG_YES", label: "Strong Yes" },
                        { value: "YES", label: "Yes" },
                        { value: "MAYBE", label: "Maybe" },
                        { value: "NO", label: "No" },
                      ]}
                    />
                    <br />
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      loading={submitting === interview.id}
                      onClick={() => submitFeedback(interview.id)}
                      style={{ marginTop: 12 }}
                    >
                      Submit Feedback
                    </Button>
                  </>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
