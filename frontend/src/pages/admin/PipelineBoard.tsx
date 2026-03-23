import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Typography, Button, Tag, Spin, Empty, Modal, Input, Space, Card,
  message, Badge, Tooltip, Row, Col, Statistic, Select, Drawer, Timeline, Divider,
} from "antd";
import {
  ArrowLeftOutlined, UserOutlined, MailOutlined, CopyOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  PhoneOutlined, TeamOutlined, FileSearchOutlined, TrophyOutlined,
  StarOutlined, ExclamationOutlined,
} from "@ant-design/icons";
import {
  DndContext, rectIntersection, PointerSensor, useSensor, useSensors, useDroppable, DragEndEvent,
} from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { adminFetch } from "../../utils/api";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const ACTIVE_STAGES = [
  "APPLIED", "SCREENING", "SHORTLISTED", "PHONE_SCREEN",
  "INTERVIEW", "ASSESSMENT", "FINAL_INTERVIEW", "OFFER", "HIRED",
];

const TERMINAL_STAGES = ["REJECTED", "WITHDRAWN"];

const stageConfig: Record<string, { label: string; color: string; icon: React.ReactNode; short: string }> = {
  APPLIED: { label: "Applied", color: "default", icon: <ClockCircleOutlined />, short: "APP" },
  SCREENING: { label: "Screening", color: "blue", icon: <FileSearchOutlined />, short: "SCR" },
  SHORTLISTED: { label: "Shortlisted", color: "cyan", icon: <StarOutlined />, short: "SHL" },
  PHONE_SCREEN: { label: "Phone Screen", color: "geekblue", icon: <PhoneOutlined />, short: "PHN" },
  INTERVIEW: { label: "Interview", color: "purple", icon: <TeamOutlined />, short: "INT" },
  ASSESSMENT: { label: "Assessment", color: "orange", icon: <FileSearchOutlined />, short: "ASS" },
  FINAL_INTERVIEW: { label: "Final Interview", color: "volcano", icon: <TeamOutlined />, short: "FIN" },
  OFFER: { label: "Offer", color: "gold", icon: <TrophyOutlined />, short: "OFR" },
  HIRED: { label: "Hired", color: "green", icon: <CheckCircleOutlined />, short: "HIR" },
  REJECTED: { label: "Rejected", color: "red", icon: <CloseCircleOutlined />, short: "REJ" },
  WITHDRAWN: { label: "Withdrawn", color: "default", icon: <ExclamationOutlined />, short: "WDN" },
};

interface JobCandidateCard {
  id: string;
  candidateId: string;
  currentStage: string;
  matchScore: number | null;
  notes: string | null;
  stageHistory: any[];
  assignedBy: string | null;
  createdAt: string;
  updatedAt: string;
  candidate: { id: string; name: string; email: string | null; currentRole: string | null; skills: string[]; yearsExp: number | null };
  communications: any[];
}

// Droppable column
function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`pipeline-column__body ${isOver ? "pipeline-column__body--over" : ""}`}
    >
      {children}
    </div>
  );
}

// Sortable candidate card
function SortableCandidateCard({ card, onClick }: { card: JobCandidateCard; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="pipeline-card" onClick={onClick}>
      <div className="pipeline-card__header">
        <Text strong className="pipeline-card__name"><UserOutlined className="pipeline-card__icon" /> {card.candidate.name}</Text>
        {card.matchScore != null && (
          <Tag color={card.matchScore >= 75 ? "green" : card.matchScore >= 50 ? "orange" : "red"} className="pipeline-card__score">
            {card.matchScore}
          </Tag>
        )}
      </div>
      {card.candidate.currentRole && (
        <Text type="secondary" className="pipeline-card__role">{card.candidate.currentRole}</Text>
      )}
      {card.candidate.skills?.length > 0 && (
        <div className="pipeline-card__skills">
          {card.candidate.skills.slice(0, 3).map((s) => <Tag key={s} className="pipeline-card__skill-tag">{s}</Tag>)}
        </div>
      )}
      {card.communications?.length > 0 && (
        <Tooltip title={`${card.communications.length} message(s)`}>
          <MailOutlined className="pipeline-card__mail-icon" />
        </Tooltip>
      )}
    </div>
  );
}

export default function PipelineBoard() {
  const { id: jobId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [board, setBoard] = useState<Record<string, JobCandidateCard[]>>({});
  const [jobTitle, setJobTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Stage change modal
  const [stageModal, setStageModal] = useState<{ card: JobCandidateCard; targetStage: string } | null>(null);
  const [stageNotes, setStageNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  // Email compose modal
  const [emailModal, setEmailModal] = useState<{ card: JobCandidateCard; stage: string } | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // Candidate detail drawer
  const [detailDrawer, setDetailDrawer] = useState<JobCandidateCard | null>(null);
  const [commsHistory, setCommsHistory] = useState<any[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const loadBoard = useCallback(() => {
    if (!jobId) return;
    Promise.all([
      adminFetch(`/pipeline/board/${jobId}`),
      adminFetch(`/jobs/${jobId}`),
    ]).then(([boardData, job]) => {
      setBoard(boardData.board);
      setTotal(boardData.total);
      setJobTitle(job.title);
    }).catch(console.error).finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  // Load email template when compose modal opens
  useEffect(() => {
    if (!emailModal) return;
    setLoadingTemplate(true);
    adminFetch(`/pipeline/template/${emailModal.stage}?jobCandidateId=${emailModal.card.id}`)
      .then((tpl) => {
        setEmailSubject(tpl.subject);
        setEmailBody(tpl.body);
      })
      .catch(() => {
        setEmailSubject("");
        setEmailBody("");
      })
      .finally(() => setLoadingTemplate(false));
  }, [emailModal]);

  // Load comms when detail drawer opens
  useEffect(() => {
    if (!detailDrawer) return;
    adminFetch(`/pipeline/${detailDrawer.id}/communications`).then(setCommsHistory).catch(() => setCommsHistory([]));
  }, [detailDrawer]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const draggedId = String(active.id);
    const targetStage = String(over.id);

    // Find the card
    let card: JobCandidateCard | null = null;
    for (const cards of Object.values(board)) {
      const found = cards.find((c) => c.id === draggedId);
      if (found) { card = found; break; }
    }
    if (!card || card.currentStage === targetStage) return;

    // Open stage change modal
    setStageModal({ card, targetStage });
    setStageNotes("");
    setRejectionReason("");
  };

  const confirmStageChange = async () => {
    if (!stageModal) return;
    try {
      const body: any = { stage: stageModal.targetStage, notes: stageNotes || null };
      if (stageModal.targetStage === "REJECTED") body.rejectionReason = rejectionReason;

      await adminFetch(`/pipeline/${stageModal.card.id}/stage`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      message.success(`Moved to ${stageConfig[stageModal.targetStage]?.label}`);
      setStageModal(null);

      // Ask to compose email if the stage has a template
      if (!["SCREENING", "WITHDRAWN"].includes(stageModal.targetStage)) {
        setEmailModal({ card: stageModal.card, stage: stageModal.targetStage });
      }

      loadBoard();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleCopyEmail = async () => {
    if (!emailModal) return;

    // Save the communication as COPIED
    await adminFetch(`/pipeline/${emailModal.card.id}/communicate`, {
      method: "POST",
      body: JSON.stringify({
        subject: emailSubject,
        body: emailBody,
        status: "COPIED",
        templateKey: emailModal.stage,
      }),
    });

    // Copy to clipboard
    const fullEmail = `Subject: ${emailSubject}\n\n${emailBody}`;
    await navigator.clipboard.writeText(fullEmail);

    // Open mailto link
    const to = emailModal.card.candidate?.email || "";
    if (to) {
      const mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
      window.open(mailtoUrl, "_blank");
    }

    message.success("Email copied to clipboard" + (to ? " and mailto opened" : ""));
    setEmailModal(null);
  };

  if (loading) return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;

  // Stage counts
  const stageCounts: Record<string, number> = {};
  for (const [stage, cards] of Object.entries(board)) {
    stageCounts[stage] = (cards || []).length;
  }

  return (
    <div className="pipeline-page">
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate("/admin/jobs")} style={{ padding: 0, marginBottom: 12 }}>
        Back to Jobs
      </Button>

      <div className="pipeline-header">
        <Title level={3} className="pipeline-header__title">{jobTitle} — Pipeline</Title>
        <Space>
          <Tag>{total} candidates</Tag>
          <Button onClick={loadBoard}>Refresh</Button>
        </Space>
      </div>

      {/* Summary stats */}
      <div className="pipeline-stats">
        {ACTIVE_STAGES.map((stage) => (
          <div key={stage} className="pipeline-stats__item">
            <Badge count={stageCounts[stage] || 0} showZero color={stageConfig[stage]?.color === "default" ? "#d9d9d9" : undefined}>
              <Tag color={stageConfig[stage]?.color}>{stageConfig[stage]?.short}</Tag>
            </Badge>
          </div>
        ))}
        {TERMINAL_STAGES.map((stage) => (
          <div key={stage} className="pipeline-stats__item">
            <Badge count={stageCounts[stage] || 0} showZero>
              <Tag color={stageConfig[stage]?.color}>{stageConfig[stage]?.short}</Tag>
            </Badge>
          </div>
        ))}
      </div>

      {/* Kanban Board */}
      <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragEnd={handleDragEnd}>
        <div className="pipeline-board">
          {ACTIVE_STAGES.map((stage) => {
            const cards = board[stage] || [];
            const cfg = stageConfig[stage];
            return (
              <div key={stage} className="pipeline-column">
                <div className="pipeline-column__header">
                  <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>
                  <Badge count={cards.length} className="pipeline-column__count" />
                </div>
                <DroppableColumn id={stage}>
                  <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    {cards.map((card) => (
                      <SortableCandidateCard key={card.id} card={card} onClick={() => setDetailDrawer(card)} />
                    ))}
                  </SortableContext>
                  {cards.length === 0 && (
                    <div className="pipeline-column__empty">
                      <Text type="secondary" style={{ fontSize: 11 }}>Drop here</Text>
                    </div>
                  )}
                </DroppableColumn>
              </div>
            );
          })}
        </div>
      </DndContext>

      {/* Rejected / Withdrawn below the board */}
      {(stageCounts["REJECTED"] > 0 || stageCounts["WITHDRAWN"] > 0) && (
        <Card size="small" style={{ marginTop: 16 }}>
          <Space>
            {stageCounts["REJECTED"] > 0 && <Tag color="red">Rejected: {stageCounts["REJECTED"]}</Tag>}
            {stageCounts["WITHDRAWN"] > 0 && <Tag>Withdrawn: {stageCounts["WITHDRAWN"]}</Tag>}
          </Space>
        </Card>
      )}

      {/* Stage Change Confirmation Modal */}
      <Modal
        title={`Move to ${stageConfig[stageModal?.targetStage || ""]?.label || ""}`}
        open={!!stageModal}
        onCancel={() => setStageModal(null)}
        onOk={confirmStageChange}
        okText="Confirm Move"
      >
        <div style={{ marginBottom: 12 }}>
          <Text>
            Moving <Text strong>{stageModal?.card.candidate.name}</Text> from{" "}
            <Tag color={stageConfig[stageModal?.card.currentStage || ""]?.color}>
              {stageConfig[stageModal?.card.currentStage || ""]?.label}
            </Tag>
            to{" "}
            <Tag color={stageConfig[stageModal?.targetStage || ""]?.color}>
              {stageConfig[stageModal?.targetStage || ""]?.label}
            </Tag>
          </Text>
        </div>
        <Input.TextArea
          rows={2}
          placeholder="Add a note (optional)"
          value={stageNotes}
          onChange={(e) => setStageNotes(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        {stageModal?.targetStage === "REJECTED" && (
          <Input.TextArea
            rows={2}
            placeholder="Rejection reason (internal, not sent to candidate)"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
        )}
      </Modal>

      {/* Email Compose Modal */}
      <Modal
        title={<><MailOutlined /> Compose Email</>}
        open={!!emailModal}
        onCancel={() => setEmailModal(null)}
        width={600}
        footer={[
          <Button key="skip" onClick={() => setEmailModal(null)}>Skip</Button>,
          <Button key="copy" type="primary" icon={<CopyOutlined />} onClick={handleCopyEmail}>
            Copy & Open Email
          </Button>,
        ]}
      >
        {loadingTemplate ? <Spin /> : (
          <>
            <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
              To: {emailModal?.card.candidate?.email || "No email on file"}
            </Text>
            <Input
              addonBefore="Subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <TextArea
              rows={10}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: "block" }}>
              Edit as needed, then click "Copy & Open Email" to paste into your email client.
            </Text>
          </>
        )}
      </Modal>

      {/* Candidate Detail Drawer */}
      <Drawer
        title={detailDrawer?.candidate.name}
        open={!!detailDrawer}
        onClose={() => setDetailDrawer(null)}
        width={450}
      >
        {detailDrawer && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Tag color={stageConfig[detailDrawer.currentStage]?.color} icon={stageConfig[detailDrawer.currentStage]?.icon}>
                {stageConfig[detailDrawer.currentStage]?.label}
              </Tag>
              {detailDrawer.matchScore != null && (
                <Tag color={detailDrawer.matchScore >= 75 ? "green" : detailDrawer.matchScore >= 50 ? "orange" : "red"}>
                  Score: {detailDrawer.matchScore}
                </Tag>
              )}
            </div>

            {detailDrawer.candidate.email && (
              <Paragraph><MailOutlined /> {detailDrawer.candidate.email}</Paragraph>
            )}
            {detailDrawer.candidate.currentRole && (
              <Paragraph>Role: {detailDrawer.candidate.currentRole}</Paragraph>
            )}
            {detailDrawer.candidate.skills?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {detailDrawer.candidate.skills.map((s) => <Tag key={s} color="blue">{s}</Tag>)}
              </div>
            )}

            {detailDrawer.notes && (
              <>
                <Divider>Notes</Divider>
                <Paragraph>{detailDrawer.notes}</Paragraph>
              </>
            )}

            <Divider>Quick Actions</Divider>
            <Space wrap>
              <Select
                placeholder="Move to stage..."
                style={{ width: 200 }}
                onChange={(stage) => {
                  setStageModal({ card: detailDrawer, targetStage: stage });
                  setDetailDrawer(null);
                }}
                options={[...ACTIVE_STAGES, ...TERMINAL_STAGES]
                  .filter((s) => s !== detailDrawer.currentStage)
                  .map((s) => ({ value: s, label: stageConfig[s]?.label }))
                }
              />
              <Button icon={<MailOutlined />} onClick={() => {
                setEmailModal({ card: detailDrawer, stage: detailDrawer.currentStage });
                setDetailDrawer(null);
              }}>
                Send Email
              </Button>
            </Space>

            <Divider>Stage History</Divider>
            <Timeline
              items={(Array.isArray(detailDrawer.stageHistory) ? detailDrawer.stageHistory : []).map((h: any) => ({
                color: h.stage === "REJECTED" ? "red" : h.stage === "HIRED" ? "green" : "blue",
                children: (
                  <>
                    <Text strong>{stageConfig[h.stage]?.label || h.stage}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {h.movedBy} — {new Date(h.movedAt).toLocaleString()}
                    </Text>
                    {h.notes && <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>{h.notes}</Paragraph>}
                  </>
                ),
              }))}
            />

            {commsHistory.length > 0 && (
              <>
                <Divider>Communications</Divider>
                <Timeline
                  items={commsHistory.map((c: any) => ({
                    dot: <MailOutlined />,
                    children: (
                      <>
                        <Text strong>{c.subject}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {c.sentBy} — {new Date(c.createdAt).toLocaleString()} — <Tag>{c.status}</Tag>
                        </Text>
                      </>
                    ),
                  }))}
                />
              </>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
