import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import MainLayout from "./layouts/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthPage from "./pages/AuthPage";
import VacanciesPage from "./pages/VacanciesPage";
import CandidateQuestionnairePage from "./pages/CandidateQuestionnairePage";
import CandidateStatusPage from "./pages/CandidateStatusPage";
import ManagerDashboardPage from "./pages/ManagerDashboardPage";
import ManagerCandidateDetailPage from "./pages/ManagerCandidateDetailPage";
import HrDashboardPage from "./pages/HrDashboardPage";
import HrVacancyCreatePage from "./pages/HrVacancyCreatePage";
import HrVacancyDetailPage from "./pages/HrVacancyDetailPage";
import HrCandidateReviewPage from "./pages/HrCandidateReviewPage";
import ProfilePage from "./pages/ProfilePage";
import HrApprovedPage from "./pages/HrApprovedPage";
import HrReportsPage from "./pages/HrReportsPage";
import HrReportVacancyCandidatesPage from "./pages/HrReportVacancyCandidatesPage";
import HrReportCandidateAnalysisPage from "./pages/HrReportCandidateAnalysisPage";
import HrCandidateDossierPage from "./pages/HrCandidateDossierPage";
import HrStatisticsPage from "./pages/HrStatisticsPage";

function RootRedirect() {
  const { isAuthenticated, isLoading, getDefaultRoute } = useAuthStore();

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <Navigate to={getDefaultRoute()} replace />;
}

function App() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <Routes>
      {/* Public */}
      <Route path="/auth" element={<MainLayout />}>
        <Route index element={<AuthPage />} />
      </Route>

      <Route path="/" element={<MainLayout />}>
        <Route index element={<RootRedirect />} />

        {/* Profile (all authenticated users) */}
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* Candidate routes */}
        <Route
          path="vacancies"
          element={
            <ProtectedRoute allowedRoles={["candidate"]}>
              <VacanciesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="questionnaire/:vacancyId"
          element={
            <ProtectedRoute allowedRoles={["candidate"]}>
              <CandidateQuestionnairePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="status"
          element={
            <ProtectedRoute allowedRoles={["candidate"]}>
              <CandidateStatusPage />
            </ProtectedRoute>
          }
        />

        {/* Manager routes */}
        <Route
          path="manager"
          element={
            <ProtectedRoute allowedRoles={["manager"]}>
              <ManagerDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="manager/candidate/:id"
          element={
            <ProtectedRoute allowedRoles={["manager"]}>
              <ManagerCandidateDetailPage />
            </ProtectedRoute>
          }
        />

        {/* HR routes */}
        <Route
          path="hr"
          element={
            <ProtectedRoute allowedRoles={["hr"]}>
              <HrDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="hr/vacancies/create"
          element={
            <ProtectedRoute allowedRoles={["hr"]}>
              <HrVacancyCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="hr/vacancies/:id"
          element={
            <ProtectedRoute allowedRoles={["hr"]}>
              <HrVacancyDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="hr/candidates/:id"
          element={
            <ProtectedRoute allowedRoles={["hr"]}>
              <HrCandidateReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="hr/approved"
          element={
            <ProtectedRoute allowedRoles={["hr"]}>
              <HrApprovedPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="hr/statistics"
          element={
            <ProtectedRoute allowedRoles={["hr"]}>
              <HrStatisticsPage />
            </ProtectedRoute>
          }
        />

        {/* HR Reports routes */}
        <Route
          path="hr/reports"
          element={
            <ProtectedRoute allowedRoles={["hr"]}>
              <HrReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="hr/reports/vacancy/:id"
          element={
            <ProtectedRoute allowedRoles={["hr"]}>
              <HrReportVacancyCandidatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="hr/reports/candidate/:id"
          element={
            <ProtectedRoute allowedRoles={["hr"]}>
              <HrReportCandidateAnalysisPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="hr/reports/candidate/:id/dossier"
          element={
            <ProtectedRoute allowedRoles={["hr"]}>
              <HrCandidateDossierPage />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
