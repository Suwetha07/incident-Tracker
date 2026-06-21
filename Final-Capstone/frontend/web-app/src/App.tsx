import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { Layout } from './components/layout/Layout';
import { ToastContainer } from './components/shared/Toast';
import { Card, EmptyState } from './components/shared/Cards';
import { getSelectedClusterContext } from './utils/clusterContext';

import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Incidents } from './pages/Incidents';
import { IncidentDetails } from './pages/IncidentDetails';
import { AIAnalysis } from './pages/AIAnalysis';
import { ClusterHealth } from './pages/ClusterHealth';
import { DependencyGraph } from './pages/DependencyGraph';
import { DeploymentAnalysis } from './pages/DeploymentAnalysis';
import { RootCauseAnalysis } from './pages/RootCauseAnalysis';
import { Users } from './pages/Users';
import { OrgSetup } from './pages/OrgSetup';
import { ClusterConnect } from './pages/ClusterConnect';
import { Profile } from './pages/Profile';
import { Services } from './pages/Services';
import { GlobalIncidentTimeline as IncidentTimeline } from './pages/GlobalIncidentTimeline';
import {
  Notifications,
  Settings,
} from './pages/Placeholders';

const queryClient = new QueryClient();

const isAuthenticated = () => Boolean(localStorage.getItem('token'));

const RequiresConnectedCluster: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { cluster, workspace } = getSelectedClusterContext();
  const isConnected = cluster?.connectionStatus === 'Connected';

  if (isConnected) {
    return <>{children}</>;
  }

  return (
    <Card title="Cluster Connection Required">
      <EmptyState
        title="Connect a Cluster First"
        message={
          workspace?.workspace
            ? 'Use Cluster Connect to connect an AKS cluster before opening this feature.'
            : 'Create a workspace, then use Cluster Connect before opening this feature.'
        }
      />
    </Card>
  );
};

const ProtectedApp: React.FC = () => {
  if (!isAuthenticated()) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/org-setup" element={<OrgSetup />} />
        <Route path="/cluster-connect" element={<ClusterConnect />} />
        <Route path="/incidents" element={<RequiresConnectedCluster><Incidents /></RequiresConnectedCluster>} />
        <Route path="/incident-details/:id" element={<RequiresConnectedCluster><IncidentDetails /></RequiresConnectedCluster>} />
        <Route path="/ai-analysis" element={<RequiresConnectedCluster><AIAnalysis /></RequiresConnectedCluster>} />
        <Route path="/cluster-health" element={<RequiresConnectedCluster><ClusterHealth /></RequiresConnectedCluster>} />
        <Route path="/services" element={<RequiresConnectedCluster><Services /></RequiresConnectedCluster>} />
        <Route path="/dependency-graph" element={<RequiresConnectedCluster><DependencyGraph /></RequiresConnectedCluster>} />
        <Route path="/timeline" element={<RequiresConnectedCluster><IncidentTimeline /></RequiresConnectedCluster>} />
        <Route path="/deployments" element={<RequiresConnectedCluster><DeploymentAnalysis /></RequiresConnectedCluster>} />
        <Route path="/rca" element={<RequiresConnectedCluster><RootCauseAnalysis /></RequiresConnectedCluster>} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/users" element={<Users />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastContainer />
      <BrowserRouter>
        <Routes>
          <Route
            path="/auth"
            element={isAuthenticated() ? <Navigate to="/dashboard" replace /> : <Auth />}
          />
          <Route path="/*" element={<ProtectedApp />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
