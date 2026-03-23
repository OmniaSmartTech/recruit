import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card, Typography, Button, List, Tag, Space, Spin, Empty, Modal, message, Statistic, Row, Col,
} from "antd";
import {
  ArrowLeftOutlined, ThunderboltOutlined, FileSearchOutlined,
  HistoryOutlined, TeamOutlined,
} from "@ant-design/icons";
import { getPin, pinFetch } from "../utils/api";

const { Title, Text } = Typography;

export default function RecruiterDashboard() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState<string | null>(null);

  const pin = getPin();
  if (!pin) { navigate("/"); return null; }

  useEffect(() => {
    Promise.all([
      pinFetch("/recruiter/jobs"),
      pinFetch("/recruiter/matches"),
    ])
      .then(([j, m]) => { setJobs(j); setMatches(m); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const runMatch = async (jobId: string, jobTitle: string) => {
    Modal.confirm({
      title: `Run match for "${jobTitle}"?`,
      content: "This will scan the CV bank, pre-filter candidates, and run AI analysis on the top matches.",
      okText: "Run Match",
      onOk: async () => {
        setMatching(jobId);
        try {
          const result = await pinFetch(`/recruiter/match/${jobId}`, { method: "POST" });
          message.success(`${result.preFilterPassed} of ${result.totalCandidates} candidates matched. AI analysis running...`);
          navigate(`/recruit/match/${result.matchRunId}`);
        } catch (err: any) {
          message.error(err.message);
        } finally {
          setMatching(null);
        }
      },
    });
  };

  if (loading) return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: "24px 16px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/")}
          style={{ padding: 0, marginBottom: 16 }}
        >
          Back
        </Button>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/logo-dark.png" alt="RecruitSmart" style={{ height: 40, marginBottom: 12 }} />
          <Title level={3}><TeamOutlined /> Recruiter Dashboard</Title>
        </div>

        {/* Open Jobs */}
        <Card
          title={<><FileSearchOutlined /> Open Jobs</>}
          style={{ marginBottom: 24 }}
        >
          {jobs.length === 0 ? (
            <Empty description="No open jobs. Ask your admin to create one." />
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
                    title={<Text strong>{job.title}</Text>}
                    description={
                      <Space>
                        {job.department && <Tag>{job.department}</Tag>}
                        {job.location && <Tag>{job.location}</Tag>}
                        <Tag>{job.workMode}</Tag>
                        {job.experienceLevel && <Tag color="blue">{job.experienceLevel}</Tag>}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>

        {/* Past Match Runs */}
        <Card title={<><HistoryOutlined /> Match History</>}>
          {matches.length === 0 ? (
            <Empty description="No matches run yet" />
          ) : (
            <List
              dataSource={matches}
              renderItem={(run: any) => (
                <List.Item
                  actions={[
                    <Button onClick={() => navigate(`/recruit/match/${run.id}`)}>
                      View Results
                    </Button>,
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
                        <Text type="secondary">
                          {run._count?.results || 0} candidates analysed
                        </Text>
                        <Text type="secondary">
                          {new Date(run.createdAt).toLocaleDateString()}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
