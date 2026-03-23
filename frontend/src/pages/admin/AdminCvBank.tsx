import { useState, useEffect } from "react";
import { Card, Typography, Tag, Space, Badge, Modal, List, Button, Upload, Input, message, Drawer, Divider } from "antd";
import { UserOutlined, FileOutlined, MessageOutlined, UploadOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { adminFetch, adminUpload } from "../../utils/api";
import DataTable, { DataTableColumn } from "../../components/shared/DataTable";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface CandidateRow {
  id: string;
  name: string;
  email: string | null;
  currentRole: string | null;
  skills: string[];
  yearsExp: number | null;
  cvFileName: string | null;
  cvDownloadUrl: string | null;
  isActive: boolean;
  createdAt: string;
  pin: { label: string; type: string } | null;
  _count: { documents: number; notes: number };
}

export default function AdminCvBank() {
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Documents modal
  const [docsModal, setDocsModal] = useState<{ candidateId: string; name: string } | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // Notes drawer
  const [notesDrawer, setNotesDrawer] = useState<{ candidateId: string; name: string } | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const load = () => {
    setLoading(true);
    adminFetch("/admin/candidates").then(setCandidates).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openDocs = (candidateId: string, name: string) => {
    setDocsModal({ candidateId, name });
    setDocsLoading(true);
    adminFetch(`/admin/candidates/${candidateId}/documents`).then(setDocs).catch(console.error).finally(() => setDocsLoading(false));
  };

  const uploadDoc = async (file: File) => {
    if (!docsModal) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      await adminUpload(`/admin/candidates/${docsModal.candidateId}/documents`, formData);
      message.success("Document uploaded");
      adminFetch(`/admin/candidates/${docsModal.candidateId}/documents`).then(setDocs);
      load(); // refresh counts
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const deleteDoc = async (docId: string) => {
    await adminFetch(`/admin/documents/${docId}`, { method: "DELETE" });
    setDocs((prev) => prev.filter((d) => d.id !== docId));
    load();
  };

  const openNotes = (candidateId: string, name: string) => {
    setNotesDrawer({ candidateId, name });
    setNotesLoading(true);
    adminFetch(`/admin/candidates/${candidateId}/notes`).then(setNotes).catch(console.error).finally(() => setNotesLoading(false));
  };

  const addNote = async () => {
    if (!notesDrawer || !newNote.trim()) return;
    setAddingNote(true);
    try {
      await adminFetch(`/admin/candidates/${notesDrawer.candidateId}/notes`, {
        method: "POST", body: JSON.stringify({ content: newNote }),
      });
      setNewNote("");
      adminFetch(`/admin/candidates/${notesDrawer.candidateId}/notes`).then(setNotes);
      load();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setAddingNote(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    await adminFetch(`/admin/notes/${noteId}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    load();
  };

  const columns: DataTableColumn<CandidateRow>[] = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      sortable: true,
      width: 180,
      render: (name: string) => <><UserOutlined className="data-table__cell-icon" /> {name}</>,
    },
    { title: "Email", dataIndex: "email", key: "email", sortable: true, width: 200 },
    { title: "Current Role", dataIndex: "currentRole", key: "currentRole", sortable: true, width: 180 },
    {
      title: "Skills",
      dataIndex: "skills",
      key: "skills",
      width: 250,
      render: (skills: string[]) => (
        <Space wrap size={2}>
          {(skills || []).slice(0, 4).map((s) => <Tag key={s} color="blue">{s}</Tag>)}
          {(skills || []).length > 4 && <Tag>+{skills.length - 4}</Tag>}
        </Space>
      ),
      filterRender: (val) => (val as string[] || []).join(", "),
    },
    {
      title: "Experience",
      dataIndex: "yearsExp",
      key: "yearsExp",
      sortable: true,
      width: 100,
      render: (y: number) => y ? `${y} yrs` : "—",
      filterable: [
        { text: "0-2 years", value: "junior" },
        { text: "3-5 years", value: "mid" },
        { text: "6-10 years", value: "senior" },
        { text: "10+ years", value: "lead" },
      ],
      filterRender: (val) => {
        const y = val as number;
        if (!y) return "unknown";
        if (y <= 2) return "junior";
        if (y <= 5) return "mid";
        if (y <= 10) return "senior";
        return "lead";
      },
    },
    {
      title: "CV File", dataIndex: "cvFileName", key: "cvFileName", width: 150,
      render: (name: string, record: CandidateRow) =>
        name ? (
          record.cvDownloadUrl ? (
            <a href={record.cvDownloadUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              {name}
            </a>
          ) : name
        ) : "—",
    },
    {
      title: "Docs",
      key: "docs",
      width: 70,
      render: (_: unknown, record: CandidateRow) => (
        <Badge count={record._count?.documents || 0} showZero>
          <Button size="small" icon={<FileOutlined />} onClick={(e) => { e.stopPropagation(); openDocs(record.id, record.name); }} />
        </Badge>
      ),
      filterRender: (_, r) => String(r._count?.documents || 0),
      sortable: true,
      sorter: (a, b) => (a._count?.documents || 0) - (b._count?.documents || 0),
    },
    {
      title: "Notes",
      key: "notes",
      width: 70,
      render: (_: unknown, record: CandidateRow) => (
        <Badge count={record._count?.notes || 0} showZero>
          <Button size="small" icon={<MessageOutlined />} onClick={(e) => { e.stopPropagation(); openNotes(record.id, record.name); }} />
        </Badge>
      ),
      sortable: true,
      sorter: (a, b) => (a._count?.notes || 0) - (b._count?.notes || 0),
    },
    {
      title: "Source",
      key: "source",
      width: 150,
      render: (_: unknown, record: CandidateRow) =>
        record.pin ? <Tag>{record.pin.label}</Tag> : <Text type="secondary">Admin</Text>,
      filterRender: (_val, record) => record.pin?.label || "Admin",
    },
    {
      title: "Date",
      dataIndex: "createdAt",
      key: "createdAt",
      sortable: true,
      width: 110,
      render: (d: string) => new Date(d).toLocaleDateString(),
      exportFormatter: (d) => new Date(d as string).toLocaleDateString(),
    },
  ];

  return (
    <div>
      <Title level={3}>CV Bank</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
        All candidates who have uploaded their CVs via applicant PINs.
      </Text>

      <Card>
        <DataTable<CandidateRow>
          columns={columns}
          dataSource={candidates}
          rowKey="id"
          loading={loading}
          onRefresh={load}
          customizable
          tableId="rs-cv-bank"
          exportable
          exportFilename="cv-bank"
          searchPlaceholder="Search candidates..."
          scrollHeight={500}
        />
      </Card>

      {/* Documents Modal */}
      <Modal
        title={<><FileOutlined /> Documents — {docsModal?.name}</>}
        open={!!docsModal}
        onCancel={() => setDocsModal(null)}
        footer={null}
        width={550}
      >
        <Upload
          beforeUpload={(file) => { uploadDoc(file); return false; }}
          showUploadList={false}
          accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
        >
          <Button icon={<UploadOutlined />} type="primary" style={{ marginBottom: 12 }}>
            Upload Document
          </Button>
        </Upload>

        <List
          loading={docsLoading}
          dataSource={docs}
          locale={{ emptyText: "No documents uploaded yet" }}
          renderItem={(doc: any) => (
            <List.Item
              actions={[
                doc.downloadUrl && <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer">Download</a>,
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteDoc(doc.id)} />,
              ]}
            >
              <List.Item.Meta
                title={doc.fileName}
                description={
                  <Space>
                    {doc.label && <Tag>{doc.label}</Tag>}
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {doc.uploadedBy} — {new Date(doc.createdAt).toLocaleDateString()}
                      {doc.fileSize && ` — ${(doc.fileSize / 1024).toFixed(0)} KB`}
                    </Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Modal>

      {/* Notes Drawer */}
      <Drawer
        title={<><MessageOutlined /> Notes — {notesDrawer?.name}</>}
        open={!!notesDrawer}
        onClose={() => setNotesDrawer(null)}
        width={400}
      >
        <div style={{ marginBottom: 16 }}>
          <TextArea
            rows={3}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note... e.g. 'Good candidate but lacked confidence in technical interview'"
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={addNote}
            loading={addingNote}
            disabled={!newNote.trim()}
            style={{ marginTop: 8 }}
          >
            Add Note
          </Button>
        </div>

        <Divider />

        <List
          loading={notesLoading}
          dataSource={notes}
          locale={{ emptyText: "No notes yet" }}
          renderItem={(note: any) => (
            <List.Item
              actions={[
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteNote(note.id)} />,
              ]}
            >
              <List.Item.Meta
                description={
                  <>
                    <Paragraph style={{ margin: 0 }}>{note.content}</Paragraph>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {note.author} — {new Date(note.createdAt).toLocaleString()}
                    </Text>
                  </>
                }
              />
            </List.Item>
          )}
        />
      </Drawer>
    </div>
  );
}
