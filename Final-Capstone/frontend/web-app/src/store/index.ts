import { create } from 'zustand';
import type {
  Incident,
  Alert,
  ClusterHealth,
  KPIMetrics,
  User,
} from '../types';

interface AuthState {
  token: string | null;
  user: User | null;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

interface DashboardState {
  incidents: Incident[];
  alerts: Alert[];
  clusterHealth: ClusterHealth | null;
  kpis: KPIMetrics | null;
  selectedIncident: Incident | null;
  selectedCluster: string;
  isDarkMode: boolean;

  setIncidents: (incidents: Incident[]) => void;
  setAlerts: (alerts: Alert[]) => void;
  setClusterHealth: (health: ClusterHealth) => void;
  setKPIs: (kpis: KPIMetrics) => void;
  setSelectedIncident: (incident: Incident | null) => void;
  setSelectedCluster: (cluster: string) => void;
  toggleDarkMode: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token') || null,
  user: null,
  setToken: (token) => {
    localStorage.setItem('token', token);
    set({ token });
  },
  setUser: (user) => set({ user }),
  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null });
  },
}));

export const useDashboardStore = create<DashboardState>((set) => ({
  incidents: [],
  alerts: [],
  clusterHealth: null,
  kpis: null,
  selectedIncident: null,
  selectedCluster: 'default',
  isDarkMode: true,

  setIncidents: (incidents) => set({ incidents }),
  setAlerts: (alerts) => set({ alerts }),
  setClusterHealth: (clusterHealth) => set({ clusterHealth }),
  setKPIs: (kpis) => set({ kpis }),
  setSelectedIncident: (selectedIncident) => set({ selectedIncident }),
  setSelectedCluster: (selectedCluster) => set({ selectedCluster }),
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
}));
