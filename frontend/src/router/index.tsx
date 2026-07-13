import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { PageWrapper } from '../components/layout/PageWrapper';

// Pages
import { Login } from '../pages/auth/Login';
import { Register } from '../pages/auth/Register';
import { Dashboard } from '../pages/dashboard/Dashboard';
import { LiveMonitoring } from '../pages/monitoring/LiveMonitoring';
import { CameraManagement } from '../pages/cameras/CameraManagement';
import { RecognitionLogs } from '../pages/logs/RecognitionLogs';
import { UnknownFaces } from '../pages/logs/UnknownFaces';
import { ComplaintManagement } from '../pages/complaints/ComplaintManagement';
import { UserManagement } from '../pages/users/UserManagement';
import { Settings } from '../pages/settings/Settings';
import { FileCase } from '../pages/cases/FileCase';
import { AnalyseVideo } from '../pages/analysis/AnalyseVideo';
import { Suspects } from '../pages/suspects/Suspects';

interface ProtectedProps {
  children: React.ReactElement;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, hydrate } = useAuthStore();

  useEffect(() => { hydrate(); }, [hydrate]);

  const token = localStorage.getItem('surveillance_token');

  if (!isAuthenticated && !token) {
    return <Navigate to="/login" replace />;
  }

  // Viewer role checks removed since we only have admin/station

  // Other restricted pages
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/complaints" replace />;
  }

  return <PageWrapper>{children}</PageWrapper>;
};

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Root: admin → Dashboard, station/viewer → complaints */}
        <Route
          path="/"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin only */}
        <Route
          path="/monitoring"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <LiveMonitoring />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cameras"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <CameraManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/logs"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <RecognitionLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/unknown-faces"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UnknownFaces />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suspects"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Suspects />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analyse"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AnalyseVideo />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* Viewer + Admin + Station */}
        <Route
          path="/complaints"
          element={
            <ProtectedRoute allowedRoles={['admin', 'station', 'viewer']}>
              <ComplaintManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/file-case"
          element={
            <ProtectedRoute allowedRoles={['admin', 'station', 'viewer']}>
              <FileCase />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
