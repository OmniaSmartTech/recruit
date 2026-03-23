import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card, Typography, Tag, Button, Table, Space, Spin, Progress,
  Select, List, Row, Col, Statistic,
} from "antd";
import {
  ArrowLeftOutlined, UserOutlined, CheckCircleOutlined,
  CloseCircleOutlined, WarningOutlined, TrophyOutlined,
} from "@ant-design/icons";
import { adminFetch } from "../../utils/api";

const { Title, Text, Paragraph } = Typography;

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [matchRun, setMatchRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = () => {
    if (!id) return;
    adminFetch(`/admin/matches/${id}`)
      .then(setMatchRun)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [id]);

  useEffect(() => {
    if (!matchRun) return;
    const isRunning = ["PENDING", "PRE_FILTERING", "ANALYZING"].includes(matchRun.status);
    if (isRunning && !pollRef.current) {
      pollRef.current = setInterval(loadData, 3000);
    } else if (!isRunning && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [matchRun]);

  if (loading) return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;
  if (!matchRun) return <Text type="danger">Not found</Text>;

  const results = matchRun.results || [];
  const completed = results.filter((r: any) => r.analysisStatus === "COMPLETED");
  const scoreColor = (s: number) => s >= 75 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444";
  const recColor: Record<string, string> = { STRONG_YES: "green", YES: "blue", MAYBE: "orange", NO: "red" };

  return (
    <div>
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate("/admin/matches")} style={{ padding: 0, marginBottom: 16 }}>
        Back to Matches
      </Button>

      <Title level={3}>
        <TrophyOutlined style={{ color: "#e74c3c", marginRight: 8 }} />
        {matchRun.job?.title}
      </Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={6}><Card><Statistic title="Total CVs" value={matchRun.totalCandidates} /></Card></Col>
        <Col xs={6}><Card><Statistic title="Pre-filtered" value={results.length} /></Card></Col>
        <Col xs={6}><Card><Statistic title="AI Analysed" value={completed.length} /></Card></Col>
        <Col xs={6}><Card><Statistic title="Status" value={matchRun.status} valueStyle={{ fontSize: 14, color: matchRun.status === "COMPLETED" ? "#10b981" : undefined }} /></Card></Col>
      </Row>

      {matchRun.status === "ANALYZING" && (
        <Card style={{ marginBottom: 16, textAlign: "center" }}>
          <Spin style={{ marginRight: 12 }} />
          <Text>AI analysis in progress...</Text>
        </Card>
      )}

      <Card title={`Results (${completed.length})`}>
        <Table
          dataSource={completed.sort((a: any, b: any) => (b.aiScore || 0) - (a.aiScore || 0))}
          rowKey="id"
          expandable={{
            expandedRowRender: (record: any) => {
              const a = record.analysis || {};
              return (
                <div style={{ padding: 8 }}>
                  {a.summary && <Paragraph>{a.summary}</Paragraph>}
                  {a.strengths?.map((s: any, i: number) => (
                    <div key={i}><CheckCircleOutlined style={{ color: "#10b981", marginRight: 4 }} /><strong>{s.area}:</strong> {s.detail}</div>
                  ))}
                  {a.gaps?.map((g: any, i: number) => (
                    <div key={i}><WarningOutlined style={{ color: "#f59e0b", marginRight: 4 }} /><Tag color={g.severity === "HIGH" ? "red" : "orange"}>{g.severity}</Tag> {g.area}: {g.detail}</div>
                  ))}
                </div>
              );
            },
          }}
          columns={[
            { title: "#", width: 50, render: (_: any, __: any, i: number) => i + 1 },
            {
              title: "Candidate",
              render: (_: any, r: any) => <><UserOutlined style={{ marginRight: 8 }} />{r.candidate?.name}</>,
            },
            { title: "Role", render: (_: any, r: any) => r.candidate?.currentRole },
            {
              title: "AI Score",
              dataIndex: "aiScore",
              render: (s: number) => s != null ? (
                <Progress percent={s} size="small" strokeColor={scoreColor(s)} format={(p) => `${p}`} style={{ width: 100 }} />
              ) : "—",
            },
            {
              title: "Rec",
              render: (_: any, r: any) => {
                const rec = r.analysis?.recommendedAction;
                return rec ? <Tag color={recColor[rec]}>{rec.replace(/_/g, " ")}</Tag> : null;
              },
            },
            { title: "Pre-filter", dataIndex: "preFilterScore" },
          ]}
        />
      </Card>
    </div>
  );
}
