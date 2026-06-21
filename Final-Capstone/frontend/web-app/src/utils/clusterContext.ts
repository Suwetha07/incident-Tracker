export type ClusterConfig = {
  clusterName?: string;
  provider?: string;
  region?: string;
  environment?: string;
  apiUrl?: string;
  prometheus?: string;
  grafana?: string;
  loki?: string;
  authMethod?: string;
  kubeconfigFileName?: string;
  connectionStatus?: string;
};

export type WorkspaceConfig = {
  id?: string;
  orgName?: string;
  orgId?: string;
  workspace?: string;
  env?: string;
  clusters?: ClusterConfig[];
};

const getCurrentUsername = (): string => {
  try {
    const userRaw = localStorage.getItem('user');
    if (userRaw) {
      const parsed = JSON.parse(userRaw);
      return parsed.username || '';
    }
  } catch (e) {}
  return '';
};

export const getUserStorageKey = (key: string): string => {
  const username = getCurrentUsername();
  return username ? `${username}:${key}` : key;
};

const encrypt = (text: string): string => {
  const key = "antigravity-secure-key";
  const result = [];
  for (let i = 0; i < text.length; i++) {
    result.push(String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length)));
  }
  try {
    return "enc:" + btoa(result.join(''));
  } catch (e) {
    return text;
  }
};

const decrypt = (cipherText: string): string => {
  if (!cipherText || !cipherText.startsWith("enc:")) return cipherText;
  try {
    const base64Part = cipherText.substring(4);
    const key = "antigravity-secure-key";
    const text = atob(base64Part);
    const result = [];
    for (let i = 0; i < text.length; i++) {
      result.push(String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length)));
    }
    return result.join('');
  } catch (e) {
    return cipherText;
  }
};

export const userLocalStorage = {
  getItem: (key: string) => {
    const val = localStorage.getItem(getUserStorageKey(key));
    if (val && (key === 'workspaces' || key === 'workspace' || key === 'cluster')) {
      return decrypt(val);
    }
    return val;
  },
  setItem: (key: string, value: string) => {
    let valToStore = value;
    if (key === 'workspaces' || key === 'workspace' || key === 'cluster') {
      valToStore = encrypt(value);
    }
    localStorage.setItem(getUserStorageKey(key), valToStore);
  },
  removeItem: (key: string) => localStorage.removeItem(getUserStorageKey(key)),
};

export const getWorkspaces = (): WorkspaceConfig[] => {
  const raw = userLocalStorage.getItem('workspaces');
  if (!raw) return [];

  try {
    return JSON.parse(raw) as WorkspaceConfig[];
  } catch {
    return [];
  }
};

export const getSelectedClusterContext = () => {
  const workspaces = getWorkspaces();
  const selectedClusterName = userLocalStorage.getItem('selectedCluster');
  const storedCluster = userLocalStorage.getItem('cluster');
  const parsedStoredCluster = storedCluster ? (JSON.parse(storedCluster) as ClusterConfig) : null;

  for (const workspace of workspaces) {
    const cluster = workspace.clusters?.find(
      (item) => item.clusterName === selectedClusterName
    );
    if (cluster) return { workspace, cluster };
  }

  if (parsedStoredCluster) {
    return {
      workspace: JSON.parse(userLocalStorage.getItem('workspace') || '{}') as WorkspaceConfig,
      cluster: parsedStoredCluster,
    };
  }

  const firstWorkspace = workspaces.find((workspace) => workspace.clusters?.length);
  const firstCluster = firstWorkspace?.clusters?.[0];

  return {
    workspace: firstWorkspace || null,
    cluster: firstCluster || null,
  };
};

export const getClusterCount = () =>
  getWorkspaces().reduce(
    (total, workspace) => total + (workspace.clusters?.length || 0),
    0
  );

export const getClusterReadiness = (cluster: ClusterConfig | null) => {
  if (!cluster) return { configured: 0, total: 4, score: 0 };

  const checks = [
    Boolean(cluster.apiUrl),
    Boolean(cluster.authMethod),
    Boolean(cluster.prometheus),
    Boolean(cluster.grafana),
  ];
  const configured = checks.filter(Boolean).length;

  return {
    configured,
    total: checks.length,
    score: Math.round((configured / checks.length) * 100),
  };
};

export const normalizeUrl = (url?: string) => {
  if (!url) return '';
  return url.startsWith('http://') || url.startsWith('https://')
    ? url
    : `https://${url}`;
};
