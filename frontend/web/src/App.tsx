import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LoginForm } from './components/Auth/LoginForm';
import { SignupForm } from './components/Auth/SignupForm';
import { MainDashboard } from './components/Dashboard/MainDashboard';
import { EnergyDashboard } from './components/Dashboard/EnergyDashboard';
import { DeviceList } from './components/Device/DeviceList';
import { AutomationBuilder } from './components/Automation/AutomationBuilder';
import { SceneBuilder } from './components/Scene/SceneBuilder';
import { useAuth } from './hooks/useAuth';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

export const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route path="/signup" element={<SignupForm />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <MainDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/energy"
          element={
            <PrivateRoute>
              <EnergyDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/devices"
          element={
            <PrivateRoute>
              <DeviceList />
            </PrivateRoute>
          }
        />
        <Route
          path="/automations"
          element={
            <PrivateRoute>
              <AutomationBuilder />
            </PrivateRoute>
          }
        />
        <Route
          path="/scenes"
          element={
            <PrivateRoute>
              <SceneBuilder />
            </PrivateRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
};
