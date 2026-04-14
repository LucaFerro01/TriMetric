import type { ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getToken } from './api/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import AuthError from './pages/AuthError';
import Dashboard from './pages/Dashboard';
import Activities from './pages/Activities';
import ActivityDetail from './pages/ActivityDetail';
import Analytics from './pages/Analytics';
import Upload from './pages/Upload';
import Profile from './pages/Profile';

function RequireAuth({ children }: { children: ReactElement }) {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<Login />} />
        <Route path="/auth/error" element={<AuthError />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="activities" element={<Activities />} />
          <Route path="activities/:id" element={<ActivityDetail />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="upload" element={<Upload />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
