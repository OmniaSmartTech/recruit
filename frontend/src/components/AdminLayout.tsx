import { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Layout, Menu, Typography, Space, Avatar, Dropdown, Button } from "antd";
import type { MenuProps } from "antd";
import {
  DashboardOutlined,
  FileSearchOutlined,
  KeyOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  LogoutOutlined,
  SettingOutlined,
  BgColorsOutlined,
  RobotOutlined,
  SwapOutlined,
  UserOutlined,
  QuestionCircleOutlined,
  ShareAltOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import { clearAuth, getUserData, getSelectedOrg } from "../utils/api";

const { Header: AntHeader } = Layout;
const { Sider, Content } = Layout;
const { Text } = Typography;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUserData();
  const org = getSelectedOrg();

  const username = useMemo(() => {
    return user?.name || user?.email?.split("@")[0] || "Admin";
  }, [user]);

  const sideMenuItems: MenuProps["items"] = [
    {
      key: "grp-main",
      label: "Recruitment",
      type: "group" as const,
      children: [
        { key: "/admin", icon: <DashboardOutlined />, label: "Dashboard" },
        { key: "/admin/jobs", icon: <FileSearchOutlined />, label: "Jobs" },
        { key: "/admin/pins", icon: <KeyOutlined />, label: "PINs" },
        { key: "/admin/cv-bank", icon: <TeamOutlined />, label: "CV Bank" },
        { key: "/admin/matches", icon: <ThunderboltOutlined />, label: "Match Runs" },
      ],
    },
    {
      key: "grp-sharing",
      label: "Sharing",
      type: "group" as const,
      children: [
        { key: "/admin/share-links", icon: <ShareAltOutlined />, label: "Share Links" },
      ],
    },
    {
      key: "grp-config",
      label: "Configuration",
      type: "group" as const,
      children: [
        { key: "/admin/scoring", icon: <BarChartOutlined />, label: "Scoring Weights" },
        { key: "/admin/branding", icon: <BgColorsOutlined />, label: "Branding" },
        { key: "/admin/prompt-settings", icon: <RobotOutlined />, label: "AI Prompt" },
      ],
    },
  ];

  const profileMenuItems: MenuProps["items"] = [
    { key: "user-info", label: <div className="rs-header__user-info"><Text className="rs-header__user-email">{user?.email}</Text></div>, disabled: true },
    { type: "divider" as const },
    ...(org ? [{
      key: "org-info", label: <div className="rs-header__org-info"><Text className="rs-header__org-name">{org.name}</Text></div>, disabled: true,
    }, {
      key: "switch-org", icon: <SwapOutlined />, label: "Switch Organisation",
      onClick: () => { localStorage.removeItem("recruitsmart_org"); navigate("/admin/select-org", { replace: true }); },
    }, { type: "divider" as const }] : []),
    { key: "support", icon: <QuestionCircleOutlined />, label: "Open support ticket", onClick: () => { window.open("https://fix.aione.uk/public/submit?product=recruitsmart", "_blank", "noopener"); } },
    { type: "divider" as const },
    { key: "logout", icon: <LogoutOutlined />, label: <span className="rs-header__logout-text">Sign out</span>, onClick: () => { clearAuth(); navigate("/admin/login"); } },
  ];

  return (
    <Layout className="admin-layout">
      <AntHeader className="rs-header" role="banner">
        <div className="rs-header__inner">
          <div className="rs-header__brand" onClick={() => navigate("/admin")}>
            <div className="rs-header__logo"><img src="/favicon.png" alt="RecruitSmart" /></div>
            <div className="rs-header__title-wrap">
              <Text className="rs-header__title">RecruitSmart</Text>
              <Text className="rs-header__subtitle">Admin</Text>
            </div>
          </div>
          <div className="rs-header__actions">
            <Dropdown menu={{ items: profileMenuItems }} trigger={["click"]}>
              <Button type="text" className="rs-header__btn rs-header__user-btn" shape="round">
                <Space size="small">
                  <Avatar className="rs-header__avatar" size={28} icon={<UserOutlined />} />
                  <Text className="rs-header__username">{username}</Text>
                </Space>
              </Button>
            </Dropdown>
          </div>
        </div>
      </AntHeader>
      <Layout>
        <Sider collapsible theme="light" width={240} breakpoint="lg" collapsedWidth={80} className="rs-sidemenu">
          <Menu mode="inline" selectedKeys={[location.pathname]} items={sideMenuItems} onClick={(e) => navigate(e.key)} style={{ paddingTop: 8 }} />
        </Sider>
        <Content className="admin-content">{children}</Content>
      </Layout>
    </Layout>
  );
}
