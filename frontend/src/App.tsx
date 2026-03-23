import { Routes, Route, Navigate } from "react-router-dom";
import AdminLogin from "./pages/admin/AdminLogin";
import AuthCallback from "./pages/AuthCallback";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminJobs from "./pages/admin/AdminJobs";
import AdminPins from "./pages/admin/AdminPins";
import AdminCvBank from "./pages/admin/AdminCvBank";
import AdminMatches from "./pages/admin/AdminMatches";
import MatchDetail from "./pages/admin/MatchDetail";
import AdminShareLinks from "./pages/admin/AdminShareLinks";
import PipelineBoard from "./pages/admin/PipelineBoard";
import AdminStageTemplates from "./pages/admin/AdminStageTemplates";
import AdminScoringSettings from "./pages/admin/AdminScoringSettings";
import AdminBranding from "./pages/admin/AdminBranding";
import AdminPromptSettings from "./pages/admin/AdminPromptSettings";
import OrgSelector from "./pages/admin/OrgSelector";
import AdminLayout from "./components/AdminLayout";
import PinEntry from "./pages/PinEntry";
import ApplicantForm from "./pages/ApplicantForm";
import RecruiterDashboard from "./pages/RecruiterDashboard";
import RecruiterMatchResults from "./pages/RecruiterMatchResults";
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
      {/* Public - PIN entry (routes to applicant or recruiter based on PIN type) */}
      <Route path="/" element={<PinEntry />} />

      {/* Applicant flow (APPLICANT PIN) */}
      <Route path="/apply" element={<ApplicantForm />} />

      {/* Recruiter flow (RECRUITER PIN) */}
      <Route path="/recruit" element={<RecruiterDashboard />} />
      <Route path="/recruit/match/:id" element={<RecruiterMatchResults />} />

      {/* Share link flow */}
      <Route path="/shared" element={
        <ShareGuard><SharedView /></ShareGuard>
      } />

      {/* SSO callback */}
      <Route path="/auth/callback" element={<AuthCallback />} />

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
                <Route path="/pins" element={<AdminPins />} />
                <Route path="/cv-bank" element={<AdminCvBank />} />
                <Route path="/matches" element={<AdminMatches />} />
                <Route path="/matches/:id" element={<MatchDetail />} />
                <Route path="/pipeline/:id" element={<PipelineBoard />} />
                <Route path="/stage-templates" element={<AdminStageTemplates />} />
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
