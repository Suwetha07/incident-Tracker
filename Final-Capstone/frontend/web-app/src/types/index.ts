// Incident types
export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  service: string;
  aiConfidence: number;
  assignedEngineer?: string;
  createdAt: string;
  resolvedAt?: string;
  blastRadius?: string[];
  rootCause?: string;
}

export interface RootCauseAnalysis {
  incidentId: string;
  rootCause: string;
  confidence: number;
  explanation: string;
  evidenceRefs: string[];
  aiModel: string;
}

export interface RecommendedAction {
  id: string;
  title: string;
  description: string;
  type: 'rollback' | 'scale' | 'restart' | 'resource' | 'investigate';
  priority: 'high' | 'medium' | 'low';
  estimatedImpact: string;
}

export interface TimelineEvent {
  timestamp: string;
  event: string;
  service: string;
  severity: 'critical' | 'warning' | 'info';
  details?: Record<string, unknown>;
}

export interface Service {
  id: string;
  name: string;
  namespace: string;
  owner: string;
  status: 'healthy' | 'degraded' | 'critical';
  replicas: number;
  cpuUsage: number;
  memoryUsage: number;
}

export interface Dependency {
  from: string;
  to: string;
  type: 'http' | 'grpc' | 'database' | 'cache' | 'queue';
  confidence: number;
  latency?: number;
}

export interface ClusterNode {
  name: string;
  status: 'Ready' | 'NotReady';
  kubeletVersion: string;
  roles: string;
}

export interface ClusterPod {
  name: string;
  namespace: string;
  status: string;
  nodeName?: string;
  restartCount: number;
}

export interface ClusterHealth {
  cpuUsage: number;
  memoryUsage: number;
  nodeAvailability: number;
  podAvailability: number;
  networkHealth: number;
  healthScore: number;
  nodes?: ClusterNode[];
  pods?: ClusterPod[];
}

export interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  service: string;
  source: string;
  timestamp: string;
  status: 'triggered' | 'acknowledged' | 'resolved';
}

export interface Deployment {
  id: string;
  service: string;
  version: string;
  timestamp: string;
  successRate: number;
  riskScore: number;
  status: 'success' | 'failed' | 'rollback';
  affectedServices?: string[];
}

export interface KnowledgeBase {
  id: string;
  title: string;
  type: 'runbook' | 'rca_report' | 'incident_summary';
  content: string;
  tags: string[];
  createdAt: string;
  relatedIncidents?: string[];
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'super_admin' | 'devops_engineer' | 'sre' | 'developer' | 'viewer';
  lastLogin?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface KPIMetrics {
  activeIncidents: number;
  criticalIncidents: number;
  clusterHealthScore: number;
  aiConfidenceAverage: number;
  mttr: number; // in minutes
  mttd: number; // in minutes
}

export interface ChartData {
  timestamp: string;
  value: number;
  label?: string;
}
