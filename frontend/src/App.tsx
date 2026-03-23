import { Routes, Route, Navigate } from "react-router-dom";
import AdminLogin from "./pages/admin/AdminLogin";
import AuthCallback from "./pages/AuthCallback";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminJobs from "./pages/admin/AdminJobs";
import JobDetail from "./pages/admin/JobDetail";
import CandidateReport from "./pages/admin/CandidateReport";
import AdminShareLinks from "./pages/admin/AdminShareLinks";
import AdminScoringSettings from "./pages/admin/AdminScoringSettings";
import AdminBranding from "./pages/admin/AdminBranding";
import AdminPromptSettings from "./pages/admin/AdminPromptSettings";
import OrgSelector from "./pages/admin/OrgSelector";
import AdminLayout from "./components/AdminLayout";
import ShareEntry from "./pages/ShareEntry";
import SharedView from "./pages/SharedView";
import { getAccessToken, getSelectedOrg, getShareCode } from "./utils/api";

function AdminGuard({ children }: { children: React.ReactNode }) {
  if (!getAccessToken()) return <Navigate to="/admin/login" replace />;
  if (!getSelectedOrg()) return <Navigate to="/admin/select-org" replace />;
  return <>{children}</>;
}

function ShareGuard({ children }: { children: React.ReactNode }) {
  if (!getShareCode()) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public - share code entry */}
      <Route path="/" element={<ShareEntry />} />

      {/* SSO callback */}
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Share link protected routes (hiring managers) */}
      <Route
        path="/shared"
        element={
          <ShareGuard>
            <SharedView />
          </ShareGuard>
        }
      />

      {/* Admin routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/select-org" element={<OrgSelector />} />
      <Route
        path="/admin/*"
        element={
          <AdminGuard>
            <AdminLayout>
              <Routes>
                <Route path="/" element={<AdminDashboard />} />
                <Route path="/jobs" element={<AdminJobs />} />
                <Route path="/jobs/:id" element={<JobDetail />} />
                <Route path="/candidates/:id" element={<CandidateReport />} />
                <Route path="/share-links" element={<AdminShareLinks />} />
                <Route path="/scoring" element={<AdminScoringSettings />} />
                <Route path="/branding" element={<AdminBranding />} />
                <Route path="/prompt-settings" element={<AdminPromptSettings />} />
              </Routes>
            </AdminLayout>
          </AdminGuard>
        }
      />
    </Routes>
  );
}
