import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Incident,
  RootCauseAnalysis,
  RecommendedAction,
  TimelineEvent,
  ClusterHealth,
  KPIMetrics,
  Alert,
  Deployment,
  User,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Generic API caller with token
const apiCall = async (
  endpoint: string,
  options?: RequestInit
) => {
  const token = localStorage.getItem('token');
  
  // Inject active cluster metadata to headers so python backends can read them
  const activeClusterRaw = localStorage.getItem('cluster');
  const clusterHeaders: Record<string, string> = {};
  if (activeClusterRaw) {
    try {
      const activeCluster = JSON.parse(activeClusterRaw);
      if (activeCluster.prometheus) {
        clusterHeaders['X-Prometheus-URL'] = activeCluster.prometheus;
      }
      if (activeCluster.clusterName) {
        clusterHeaders['X-Cluster-Name'] = activeCluster.clusterName;
      }
    } catch (e) {}
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...clusterHeaders,
    ...options?.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
};

// ===== Incidents =====
export const useIncidents = () =>
  useQuery<Incident[]>({
    queryKey: ['incidents'],
    queryFn: () => apiCall('/incidents-service/incidents'),
  });

export const useIncident = (id: string) =>
  useQuery<Incident>({
    queryKey: ['incident', id],
    queryFn: () => apiCall(`/incidents-service/incidents/${id}`),
  });

export const useCreateIncident = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Incident>) =>
      apiCall('/incidents-service/incidents', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
  });
};

export const useUpdateIncident = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Incident>;
    }) =>
      apiCall(`/incidents-service/incidents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
  });
};

// ===== RCA & Analysis =====
export const useRCA = (incidentId: string) =>
  useQuery<RootCauseAnalysis>({
    queryKey: ['rca', incidentId],
    queryFn: () =>
      apiCall(`/analysis-service/incidents/${incidentId}/rca`),
  });

export const useRecommendedActions = (incidentId: string) =>
  useQuery<RecommendedAction[]>({
    queryKey: ['recommendations', incidentId],
    queryFn: () =>
      apiCall(
        `/analysis-service/incidents/${incidentId}/recommendations`
      ),
  });

export const useIncidentTimeline = (incidentId: string) =>
  useQuery<TimelineEvent[]>({
    queryKey: ['timeline', incidentId],
    queryFn: () =>
      apiCall(`/incidents-service/incidents/${incidentId}/timeline`),
  });

export const useChat = () => {
  return useMutation({
    mutationFn: (data: { message: string; cluster_name?: string }) =>
      apiCall('/analysis-service/chat', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
};

// ===== Cluster Health =====
export const useClusterHealth = () =>
  useQuery<ClusterHealth>({
    queryKey: ['cluster-health'],
    queryFn: () => apiCall('/telemetry-store/cluster-health'),
    refetchInterval: 30000,
  });

export const useKPIs = () =>
  useQuery<KPIMetrics>({
    queryKey: ['kpis'],
    queryFn: () => apiCall('/incidents-service/kpis'),
    refetchInterval: 60000,
  });

// ===== Services =====
export const useServices = () =>
  useQuery({
    queryKey: ['services'],
    queryFn: () =>
      apiCall('/dependency-service/services'),
  });

export const useServiceDependencies = (serviceId: string) =>
  useQuery({
    queryKey: ['dependencies', serviceId],
    queryFn: () =>
      apiCall(`/dependency-service/services/${serviceId}/dependencies`),
  });

// ===== Dependency Graph =====
export const useDependencyGraph = () =>
  useQuery({
    queryKey: ['dependency-graph'],
    queryFn: () =>
      apiCall('/dependency-service/graph'),
  });

// ===== Alerts =====
export const useAlerts = () =>
  useQuery<Alert[]>({
    queryKey: ['alerts'],
    queryFn: () => apiCall('/incidents-service/alerts'),
    refetchInterval: 15000,
  });

// ===== Deployments =====
export const useDeployments = () =>
  useQuery<Deployment[]>({
    queryKey: ['deployments'],
    queryFn: () =>
      apiCall('/ingest-service/deployments'),
  });

// ===== Knowledge Base =====
export const useKnowledgeBase = (query?: string) =>
  useQuery({
    queryKey: ['knowledge-base', query],
    queryFn: () =>
      apiCall(
        `/analysis-service/knowledge-base${query ? `?q=${query}` : ''}`
      ),
  });

// ===== Users =====
export const useUsers = () =>
  useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => apiCall('/auth/users'),
  });

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userData: Partial<User>) =>
      apiCall('/auth/users', {
        method: 'POST',
        body: JSON.stringify(userData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

// ===== Auth =====
export const useLogin = () =>
  useMutation({
    mutationFn: async (credentials: {
      email: string;
      password: string;
    }) => {
      const data = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      localStorage.setItem('token', data.access_token);
      return data;
    },
  });
