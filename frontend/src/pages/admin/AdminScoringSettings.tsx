import { useState, useEffect } from "react";
import { Card, Typography, Slider, Row, Col, Button, message, Spin, Space } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { adminFetch } from "../../utils/api";

const { Title, Text } = Typography;

export default function AdminScoringSettings() {
  const [weights, setWeights] = useState({
    weightSkills: 35,
    weightExperience: 30,
    weightQualifications: 20,
    weightCulturalFit: 15,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminFetch("/admin/scoring")
      .then((data) => {
        setWeights({
          weightSkills: data.weightSkills ?? 35,
          weightExperience: data.weightExperience ?? 30,
          weightQualifications: data.weightQualifications ?? 20,
          weightCulturalFit: data.weightCulturalFit ?? 15,
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const total = weights.weightSkills + weights.weightExperience +
    weights.weightQualifications + weights.weightCulturalFit;

  const handleSave = async () => {
    if (total !== 100) {
      message.error("Weights must add up to 100%");
      return;
    }
    setSaving(true);
    try {
      await adminFetch("/admin/scoring", {
        method: "PUT",
        body: JSON.stringify(weights),
      });
      message.success("Scoring weights saved");
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;

  const sliders = [
    { key: "weightSkills", label: "Skills Match", desc: "Technical and professional skills alignment" },
    { key: "weightExperience", label: "Experience Relevance", desc: "Years, domain, seniority fit" },
    { key: "weightQualifications", label: "Qualifications", desc: "Education, certifications, training" },
    { key: "weightCulturalFit", label: "Cultural Fit", desc: "Team size, company types, work style" },
  ];

  return (
    <div>
      <Title level={3}>Scoring Weights</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        Adjust how each dimension contributes to the overall match score. Weights must total 100%.
      </Text>

      <Card>
        {sliders.map((s) => (
          <div key={s.key} style={{ marginBottom: 24 }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Text strong>{s.label}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>{s.desc}</Text>
              </Col>
              <Col>
                <Text strong style={{ fontSize: 18 }}>
                  {weights[s.key as keyof typeof weights]}%
                </Text>
              </Col>
            </Row>
            <Slider
              min={0}
              max={100}
              value={weights[s.key as keyof typeof weights]}
              onChange={(val) => setWeights((prev) => ({ ...prev, [s.key]: val }))}
              trackStyle={{ backgroundColor: "#e74c3c" }}
              handleStyle={{ borderColor: "#e74c3c" }}
            />
          </div>
        ))}

        <Row justify="space-between" align="middle" style={{ marginTop: 16, padding: "16px 0", borderTop: "1px solid #f0f0f0" }}>
          <Col>
            <Text strong style={{ fontSize: 16 }}>
              Total: {total}%
            </Text>
            {total !== 100 && (
              <Text type="danger" style={{ marginLeft: 12 }}>
                Must equal 100%
              </Text>
            )}
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              disabled={total !== 100}
              onClick={handleSave}
            >
              Save Weights
            </Button>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
