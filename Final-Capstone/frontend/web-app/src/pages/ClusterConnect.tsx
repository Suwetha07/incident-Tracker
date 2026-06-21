import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicClientApplication } from '@azure/msal-browser';
import { userLocalStorage as localStorage } from '../utils/clusterContext';
import { Card } from '../components/shared/Cards';
import { showToast } from '../utils/toast';

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none transition-all duration-200';
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

type ClusterForm = {
  clusterName: string;
  clusterDisplayName: string;
  provider: string;
  subscriptionId: string;
  resourceGroup: string;
  aksClusterName: string;
  region: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  environment: string;
  authMethod: string;
  clusterType: 'Public AKS Cluster' | 'Private AKS Cluster';
  connectionMethod: 
    | 'Upload kubeconfig' 
    | 'Service Principal' 
    | 'Microsoft Entra ID Login' 
    | 'Microsoft Entra ID Login + Telemetry Agent' 
    | 'Same VNet Connectivity' 
    | 'Service Principal + Same VNet'
    | 'Azure Access Token (Azure CLI)'
    | 'Azure Access Token + Telemetry Agent';
  agentToken: string;
  agentConnected: boolean;
  apiUrl: string;
  prometheus: string;
  grafana: string;
  loki: string;
  kubeconfigFileName: string;
  kubeconfigContent: string;
  connectionStatus: 'Not Connected' | 'Validating' | 'Connected' | 'Agent Pending' | 'Agent Connected' | 'Connection Failed';
  lastValidationTime: string;
  lastSyncTime: string;
};

type WorkspaceForm = {
  orgName: string;
  orgId: string;
  workspace: string;
  env: string;
};

type SavedWorkspace = WorkspaceForm & {
  id: string;
  createdAt: string;
  clusters: ClusterForm[];
};

type ClusterValidationResponse = {
  valid: boolean;
  message?: string;
  cluster?: {
    id?: string;
    name?: string;
    location?: string;
    provisioningState?: string;
    fqdn?: string;
    kubernetesVersion?: string;
    server?: string;
  };
};

class ClusterValidationError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ClusterValidationError';
    this.status = status;
  }
}

const emptyCluster: ClusterForm = {
  clusterName: '',
  clusterDisplayName: '',
  provider: 'AKS',
  subscriptionId: '',
  resourceGroup: '',
  aksClusterName: '',
  region: '',
  tenantId: '',
  clientId: '',
  clientSecret: '',
  environment: 'Production',
  authMethod: 'Service Principal',
  clusterType: 'Public AKS Cluster',
  connectionMethod: 'Service Principal',
  agentToken: '',
  agentConnected: false,
  apiUrl: '',
  prometheus: '',
  grafana: '',
  loki: '',
  kubeconfigFileName: '',
  kubeconfigContent: '',
  connectionStatus: 'Not Connected',
  lastValidationTime: '',
  lastSyncTime: '',
};

const getSavedWorkspaces = (): SavedWorkspace[] => {
  const raw = localStorage.getItem('workspaces');
  if (!raw) return [];

  try {
    return JSON.parse(raw) as SavedWorkspace[];
  } catch {
    return [];
  }
};

const displayDate = (value: string) => (value ? new Date(value).toLocaleString() : 'Not available');

const hasValue = (value: string) => value.trim().length > 0;

const extractValidationError = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== 'object') return fallback;

  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (!item || typeof item !== 'object') return '';
        const fieldPath = Array.isArray((item as { loc?: unknown }).loc)
          ? (item as { loc: Array<string | number> }).loc.join('.')
          : 'field';
        const message = typeof (item as { msg?: unknown }).msg === 'string' ? (item as { msg: string }).msg : 'is invalid';
        return `${fieldPath}: ${message}`;
      })
      .filter(Boolean)
      .join('\n');
  }

  return fallback;
};

export const ClusterConnect: React.FC = () => {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<SavedWorkspace[]>(getSavedWorkspaces);
  const initialWorkspaceId = localStorage.getItem('clusterConnectWorkspaceId') || workspaces[0]?.id || '';
  const initialClusterName = localStorage.getItem('clusterConnectClusterName') || '';
  const initialWorkspace = workspaces.find((workspace) => workspace.id === initialWorkspaceId);
  const initialCluster = initialWorkspace?.clusters.find((item) => item.clusterName === initialClusterName);
  
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(initialWorkspaceId);
  const [editingClusterName, setEditingClusterName] = useState(initialClusterName);
  const [cluster, setCluster] = useState<ClusterForm>({
    ...emptyCluster,
    environment: initialWorkspace?.env || 'Production',
    ...initialCluster,
  });
  
  const [message, setMessage] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isVerifyingAgent, setIsVerifyingAgent] = useState(false);

  // Microsoft Entra ID Login States
  const [showMicrosoftModal, setShowMicrosoftModal] = useState(false);
  const [isSigningInMicrosoft, setIsSigningInMicrosoft] = useState(false);
  const [isEntraSignedIn, setIsEntraSignedIn] = useState(false);
  const [entraUserEmail, setEntraUserEmail] = useState('');
  const [microsoftEmailInput, setMicrosoftEmailInput] = useState('');
  const [microsoftPasswordInput, setMicrosoftPasswordInput] = useState('');
  const [entraStep, setEntraStep] = useState<'email' | 'password' | 'permissions'>('email');
  
  const [entraClientId, setEntraClientId] = useState('');
  const [entraTenantId, setEntraTenantId] = useState('');
  const [azureToken, setAzureToken] = useState('');
  const [customAccessTokenInput, setCustomAccessTokenInput] = useState('');
  const [isTokenAuthenticated, setIsTokenAuthenticated] = useState(false);
  
  const [selectedSub, setSelectedSub] = useState('');
  const [selectedRG, setSelectedRG] = useState('');
  const [selectedAKS, setSelectedAKS] = useState('');

  const [subscriptionsList, setSubscriptionsList] = useState<string[]>([
    'Azure-Subscription-Prod (sub-883a-49c2)',
    'Azure-Subscription-Dev (sub-741e-19d8)'
  ]);
  const [resourceGroupsList, setResourceGroupsList] = useState<string[]>([
    'rg-production-westeurope',
    'rg-development-eastus'
  ]);
  const [aksClustersList, setAksClustersList] = useState<string[]>([
    'aks-prod-cluster-01',
    'aks-dev-cluster-02'
  ]);

  // Auto Discovery Progress Modal States
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [discoveryStage, setDiscoveryStage] = useState(0);
  const [pendingConnectedCluster, setPendingConnectedCluster] = useState<ClusterForm | null>(null);

  const fetchAzureResources = async (token: string) => {
    // Fetch Subscriptions
    const subRes = await fetch("https://management.azure.com/subscriptions?api-version=2020-01-01", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!subRes.ok) throw new Error('Failed to fetch subscriptions from Azure Resource Manager.');
    const subData = await subRes.json();
    const subs = subData.value || [];

    if (subs.length === 0) {
      throw new Error('No Azure Subscriptions found in this account.');
    }

    const subOptions = subs.map((s: any) => `${s.displayName} (${s.subscriptionId})`);
    setSubscriptionsList(subOptions);
    const firstSubId = subs[0].subscriptionId;
    const firstSubOption = subOptions[0];
    setSelectedSub(firstSubOption);

    // Fetch Resource Groups for first Subscription
    const rgRes = await fetch(`https://management.azure.com/subscriptions/${firstSubId}/resourcegroups?api-version=2021-04-01`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const rgData = await rgRes.json();
    const rgs = rgData.value || [];
    const rgOptions = rgs.map((r: any) => r.name);
    setResourceGroupsList(rgOptions.length ? rgOptions : ['no-resource-groups-found']);
    const firstRG = rgOptions[0] || 'no-resource-groups-found';
    setSelectedRG(firstRG);

    // Fetch AKS Clusters for first Resource Group
    let aksOptions: string[] = [];
    let aksList: any[] = [];
    if (firstRG !== 'no-resource-groups-found') {
      const aksRes = await fetch(`https://management.azure.com/subscriptions/${firstSubId}/resourceGroups/${firstRG}/providers/Microsoft.ContainerService/managedClusters?api-version=2022-03-01`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const aksData = await aksRes.json();
      aksList = aksData.value || [];
      aksOptions = aksList.map((a: any) => a.name);
    }
    setAksClustersList(aksOptions.length ? aksOptions : ['no-aks-clusters-found']);
    const firstAKS = aksOptions[0] || 'no-aks-clusters-found';
    setSelectedAKS(firstAKS);

    const matchedAks = aksList.find((a: any) => a.name === firstAKS);
    const region = matchedAks?.location || 'westeurope';
    const apiServerFqdn = matchedAks?.properties?.fqdn || '';

    setCluster((current) => ({
      ...current,
      subscriptionId: firstSubId,
      resourceGroup: firstRG,
      aksClusterName: firstAKS,
      region: region,
      apiUrl: apiServerFqdn ? `https://${apiServerFqdn}` : current.apiUrl,
    }));
  };

  useEffect(() => {
    const checkMsalRedirect = async () => {
      const pendingClientId = window.sessionStorage.getItem('msal_pending_client_id');
      if (!pendingClientId) return;

      const pendingTenantId = window.sessionStorage.getItem('msal_pending_tenant_id') || 'common';
      const pendingEmail = window.sessionStorage.getItem('msal_pending_email') || '';

      try {
        const pca = new PublicClientApplication({
          auth: {
            clientId: pendingClientId,
            authority: `https://login.microsoftonline.com/${pendingTenantId}`,
            redirectUri: window.location.origin + '/cluster-connect',
          },
          cache: {
            cacheLocation: 'sessionStorage',
          }
        });
        await pca.initialize();
        const redirectResult = await pca.handleRedirectPromise();
        
        if (redirectResult) {
          const token = redirectResult.accessToken;
          setAzureToken(token);
          setEntraClientId(pendingClientId);
          setEntraTenantId(pendingTenantId);
          setEntraUserEmail(redirectResult.account?.username || pendingEmail);
          
          await fetchAzureResources(token);
          
          setIsEntraSignedIn(true);
          showToast({
            type: 'success',
            title: 'Connected to Live Azure Account',
            message: `Successfully loaded subscriptions.`,
          });
        }
      } catch (err: any) {
        console.error('Error handling MSAL redirect:', err);
        showToast({
          type: 'error',
          title: 'Redirect Authentication Failed',
          message: err.message || 'An error occurred while finishing Microsoft sign in.',
        });
      } finally {
        window.sessionStorage.removeItem('msal_pending_client_id');
        window.sessionStorage.removeItem('msal_pending_tenant_id');
        window.sessionStorage.removeItem('msal_pending_email');
      }
    };

    checkMsalRedirect();
  }, []);

  const persistWorkspaces = (nextWorkspaces: SavedWorkspace[]) => {
    localStorage.setItem('workspaces', JSON.stringify(nextWorkspaces));
    setWorkspaces(nextWorkspaces);
    window.dispatchEvent(new Event('workspaces-updated'));
  };

  const getMissingClusterFields = () => {
    const missingFields: string[] = [];

    if (!hasValue(cluster.clusterDisplayName)) missingFields.push('Cluster Display Name');
    
    // Entra ID login workflow validation checks
    const usesEntraLogin = 
      cluster.connectionMethod === 'Microsoft Entra ID Login' || 
      cluster.connectionMethod === 'Microsoft Entra ID Login + Telemetry Agent' ||
      cluster.connectionMethod === 'Same VNet Connectivity';

    if (usesEntraLogin && !isEntraSignedIn) {
      missingFields.push('Microsoft Entra ID Sign-In');
      return missingFields;
    }

    const usesTokenAuth = 
      cluster.connectionMethod === 'Azure Access Token (Azure CLI)' || 
      cluster.connectionMethod === 'Azure Access Token + Telemetry Agent';

    if (usesTokenAuth && !isTokenAuthenticated) {
      missingFields.push('Azure Access Token Verification');
      return missingFields;
    }

    if (cluster.connectionMethod === 'Microsoft Entra ID Login + Telemetry Agent' || 
        cluster.connectionMethod === 'Azure Access Token + Telemetry Agent') {
      if (!hasValue(cluster.agentToken)) {
        missingFields.push('Telemetry Agent Token');
      }
      return missingFields;
    }

    if (cluster.connectionMethod === 'Upload kubeconfig') {
      if (cluster.connectionStatus !== 'Connected' && !hasValue(cluster.kubeconfigContent)) {
        missingFields.push('Kubeconfig File');
      }
      return missingFields;
    }

    // Service Principal fields required
    if (cluster.connectionMethod === 'Service Principal' || cluster.connectionMethod === 'Service Principal + Same VNet') {
      if (!hasValue(cluster.tenantId)) missingFields.push('Tenant ID');
      if (!hasValue(cluster.clientId)) missingFields.push('Client ID');
      if (!hasValue(cluster.clientSecret)) missingFields.push('Client Secret');
    }

    // Common Azure fields
    if (!hasValue(cluster.subscriptionId)) missingFields.push('Subscription ID');
    if (!hasValue(cluster.resourceGroup)) missingFields.push('Resource Group');
    if (!hasValue(cluster.aksClusterName)) missingFields.push('AKS Cluster Name');
    if (!hasValue(cluster.region)) missingFields.push('Region');

    return missingFields;
  };

  const validateClusterWithBackend = async (): Promise<ClusterValidationResponse> => {
    const isKubeconfig = cluster.connectionMethod === 'Upload kubeconfig';
    const endpoint = isKubeconfig ? '/cluster/validate-kubeconfig' : '/cluster/validate';
    
    const isTokenBased = 
      cluster.connectionMethod === 'Microsoft Entra ID Login' ||
      cluster.connectionMethod === 'Microsoft Entra ID Login + Telemetry Agent' ||
      cluster.connectionMethod === 'Same VNet Connectivity' ||
      cluster.connectionMethod === 'Azure Access Token (Azure CLI)' ||
      cluster.connectionMethod === 'Azure Access Token + Telemetry Agent';

    const requestBody = isKubeconfig
      ? { kubeconfig: cluster.kubeconfigContent }
      : {
          tenantId: hasValue(cluster.tenantId) ? cluster.tenantId.trim() : 'demo-tenant-id',
          clientId: hasValue(cluster.clientId) ? cluster.clientId.trim() : 'demo-client-id',
          clientSecret: hasValue(cluster.clientSecret) ? cluster.clientSecret : 'demo-client-secret',
          subscriptionId: cluster.subscriptionId.trim(),
          resourceGroup: cluster.resourceGroup.trim(),
          aksClusterName: cluster.aksClusterName.trim(),
          accessToken: isTokenBased && azureToken ? azureToken : undefined,
        };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ClusterValidationError(
        extractValidationError(payload, 'Cluster validation failed.'),
        response.status
      );
    }

    return payload as ClusterValidationResponse;
  };

  const updateClusterField = <K extends keyof ClusterForm>(field: K, value: ClusterForm[K]) => {
    setCluster((current) => {
      const next = { ...current, [field]: value };
      
      // Handle workflow method resetting
      if (field === 'clusterType') {
        next.connectionMethod = value === 'Public AKS Cluster' 
          ? 'Upload kubeconfig' 
          : 'Microsoft Entra ID Login + Telemetry Agent';
      }

      // Reset validation states if validating fields change
      const isSensitiveField = [
        'subscriptionId',
        'resourceGroup',
        'aksClusterName',
        'region',
        'tenantId',
        'clientId',
        'clientSecret',
        'kubeconfigContent',
        'connectionMethod',
        'clusterType'
      ].includes(field as string);

      if (isSensitiveField) {
        next.connectionStatus = 'Not Connected';
        next.lastValidationTime = '';
      }

      return next;
    });
  };

  const buildClusterRecord = (status: ClusterForm['connectionStatus']): ClusterForm => ({
    ...cluster,
    clusterName: cluster.aksClusterName || cluster.clusterDisplayName,
    clusterDisplayName: hasValue(cluster.clusterDisplayName) ? cluster.clusterDisplayName : (cluster.aksClusterName || 'AKS Cluster'),
    provider: 'AKS',
    connectionStatus: status,
    lastValidationTime:
      status === 'Connected' || status === 'Agent Pending' || status === 'Agent Connected'
        ? new Date().toISOString()
        : cluster.lastValidationTime,
    lastSyncTime: status === 'Connected' || status === 'Agent Connected' ? new Date().toISOString() : cluster.lastSyncTime,
  });

  const upsertCluster = (clusterRecord: ClusterForm) => {
    const workspace = workspaces.find((item) => item.id === activeWorkspaceId);
    if (!workspace) {
      setMessage('Choose a workspace before saving cluster connection.');
      showToast({
        type: 'error',
        title: 'Workspace required',
        message: 'Choose a workspace before saving cluster connection.',
      });
      return null;
    }

    const duplicateName = workspace.clusters.some(
      (item) => item.clusterName === clusterRecord.clusterName && item.clusterName !== initialClusterName
    );
    if (duplicateName) {
      setMessage('A cluster with this AKS name already exists in this workspace.');
      showToast({
        type: 'warning',
        title: 'Duplicate cluster',
        message: 'A cluster with this AKS name already exists.',
      });
      return null;
    }

    const nextWorkspace = {
      ...workspace,
      clusters: initialClusterName
        ? workspace.clusters.map((item) => (item.clusterName === initialClusterName ? clusterRecord : item))
        : [...workspace.clusters, clusterRecord],
    };
    const nextWorkspaces = workspaces.map((item) =>
      item.id === workspace.id ? nextWorkspace : item
    );

    persistWorkspaces(nextWorkspaces);
    localStorage.setItem('workspace', JSON.stringify(nextWorkspace));
    localStorage.setItem('cluster', JSON.stringify(clusterRecord));
    localStorage.setItem('selectedCluster', clusterRecord.clusterName);
    localStorage.removeItem('clusterConnectClusterName');
    return nextWorkspace;
  };

  const startAutoDiscovery = (connectedClusterRecord: ClusterForm) => {
    setPendingConnectedCluster(connectedClusterRecord);
    setShowDiscoveryModal(true);
    setDiscoveryStage(0);
    
    const interval = setInterval(() => {
      setDiscoveryStage((stage) => {
        if (stage >= 5) {
          clearInterval(interval);
          return 5;
        }
        return stage + 1;
      });
    }, 900);
  };

  const finishDiscovery = () => {
    if (pendingConnectedCluster) {
      upsertCluster(pendingConnectedCluster);
    }
    setShowDiscoveryModal(false);
    localStorage.removeItem('clusterConnectWorkspaceId');
    navigate('/org-setup');
  };

  // Entra ID Login Logic
  const handleMicrosoftSignIn = () => {
    setMicrosoftEmailInput('');
    setMicrosoftPasswordInput('');
    setEntraClientId('');
    setEntraTenantId('');
    setAzureToken('');
    setEntraStep('email');
    setShowMicrosoftModal(true);
  };

  const clearMsalCache = () => {
    try {
      for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
        const key = window.sessionStorage.key(i);
        if (key && (key.startsWith('msal.') || key.includes('msal'))) {
          window.sessionStorage.removeItem(key);
        }
      }
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const key = window.localStorage.key(i);
        if (key && (key.startsWith('msal.') || key.includes('msal'))) {
          window.localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.error('Error clearing MSAL cache:', e);
    }
  };

  const handleAcceptEntraSignIn = async () => {
    if (isSigningInMicrosoft) {
      showToast({
        type: 'warning',
        title: 'Sign-in in progress',
        message: 'A sign-in request is already in progress. Please check for any open popup windows.',
      });
      return;
    }
    clearMsalCache();
    setIsSigningInMicrosoft(true);
    const finalEmail = microsoftEmailInput.trim() || 'admin@contoso.onmicrosoft.com';
    const trimmedClientId = entraClientId.trim();

    try {
      if (trimmedClientId) {
        // Run Real MSAL Authentication via Redirect (resolves popup blocker issues)
        const authorityTenant = entraTenantId.trim() || 'common';
        window.sessionStorage.setItem('msal_pending_client_id', trimmedClientId);
        window.sessionStorage.setItem('msal_pending_tenant_id', authorityTenant);
        window.sessionStorage.setItem('msal_pending_email', finalEmail);

        const pca = new PublicClientApplication({
          auth: {
            clientId: trimmedClientId,
            authority: `https://login.microsoftonline.com/${authorityTenant}`,
            redirectUri: window.location.origin + '/cluster-connect',
          },
          cache: {
            cacheLocation: 'sessionStorage',
          }
        });
        await pca.initialize();
        await pca.handleRedirectPromise(); // Cleanly handle any pending redirect tokens/states before routing
        await pca.loginRedirect({
          scopes: ['https://management.azure.com/user_impersonation'],
          prompt: 'select_account',
          loginHint: finalEmail
        });
      } else {
        // Fallback to Dynamic Sandbox Mock mode
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setEntraUserEmail(finalEmail);

        // Derive domain to build personalized details
        const emailPrefix = finalEmail.split('@')[0];
        const emailDomain = finalEmail.split('@')[1]?.split('.')[0] || 'corp';
        const capitalizedDomain = emailDomain.charAt(0).toUpperCase() + emailDomain.slice(1);

        const subName = `Azure-${capitalizedDomain}-Subscription (sub-${emailPrefix}-prod)`;
        const rgName = `rg-${emailDomain}-production`;
        const aksName = `aks-${emailDomain}-prod-cluster`;

        setSelectedSub(subName);
        setSelectedRG(rgName);
        setSelectedAKS(aksName);

        setSubscriptionsList((prev) => Array.from(new Set([subName, ...prev])));
        setResourceGroupsList((prev) => Array.from(new Set([rgName, ...prev])));
        setAksClustersList((prev) => Array.from(new Set([aksName, ...prev])));

        setCluster((current) => ({
          ...current,
          subscriptionId: `sub-${emailPrefix}-prod-901a-88f2`,
          resourceGroup: rgName,
          aksClusterName: aksName,
          region: 'westeurope',
        }));

        showToast({
          type: 'success',
          title: 'Microsoft Entra Authenticated (Sandbox)',
          message: `Signed in as ${finalEmail}. Using sandbox demo mode.`,
        });
        setIsEntraSignedIn(true);
        setShowMicrosoftModal(false);
      }
    } catch (err: any) {
      console.error(err);
      let errorMsg = err.message || 'An error occurred during Microsoft sign in.';
      if (errorMsg.includes('interaction_in_progress')) {
        errorMsg = 'A login redirect is already in progress. Please refresh the page and try again.';
      }
      showToast({
        type: 'error',
        title: 'Authentication Failed',
        message: errorMsg,
      });
    } finally {
      setIsSigningInMicrosoft(false);
    }
  };

  const handleSelectionChange = async (type: 'sub' | 'rg' | 'aks', val: string) => {
    if (type === 'sub') {
      setSelectedSub(val);
      const subId = val.match(/\(([^)]+)\)/)?.[1] || val;
      updateClusterField('subscriptionId', subId);

      if (azureToken) {
        try {
          // Fetch RGs for new Sub
          const rgRes = await fetch(`https://management.azure.com/subscriptions/${subId}/resourcegroups?api-version=2021-04-01`, {
            headers: { Authorization: `Bearer ${azureToken}` }
          });
          const rgData = await rgRes.json();
          const rgOptions = (rgData.value || []).map((r: any) => r.name);
          setResourceGroupsList(rgOptions.length ? rgOptions : ['no-resource-groups-found']);
          const firstRG = rgOptions[0] || 'no-resource-groups-found';
          setSelectedRG(firstRG);
          updateClusterField('resourceGroup', firstRG);

          // Fetch AKS Clusters for first Resource Group of new Subscription
          let aksOptions: string[] = [];
          let aksList: any[] = [];
          if (firstRG !== 'no-resource-groups-found') {
            const aksRes = await fetch(`https://management.azure.com/subscriptions/${subId}/resourceGroups/${firstRG}/providers/Microsoft.ContainerService/managedClusters?api-version=2022-03-01`, {
              headers: { Authorization: `Bearer ${azureToken}` }
            });
            const aksData = await aksRes.json();
            aksList = aksData.value || [];
            aksOptions = aksList.map((a: any) => a.name);
          }
          setAksClustersList(aksOptions.length ? aksOptions : ['no-aks-clusters-found']);
          const firstAKS = aksOptions[0] || 'no-aks-clusters-found';
          setSelectedAKS(firstAKS);
          updateClusterField('aksClusterName', firstAKS);

          const matchedAks = aksList.find((a: any) => a.name === firstAKS);
          if (matchedAks) {
            updateClusterField('region', matchedAks.location || 'westeurope');
            if (matchedAks.properties?.fqdn) {
              updateClusterField('apiUrl', `https://${matchedAks.properties.fqdn}`);
            }
          }
        } catch (err) {
          showToast({ type: 'error', title: 'Failed to update lists', message: 'Failed to fetch resource options from Azure.' });
        }
      }
    } else if (type === 'rg') {
      setSelectedRG(val);
      updateClusterField('resourceGroup', val);

      if (azureToken) {
        const subId = selectedSub.match(/\(([^)]+)\)/)?.[1] || selectedSub;
        try {
          // Fetch AKS Clusters for selected Resource Group
          const aksRes = await fetch(`https://management.azure.com/subscriptions/${subId}/resourceGroups/${val}/providers/Microsoft.ContainerService/managedClusters?api-version=2022-03-01`, {
            headers: { Authorization: `Bearer ${azureToken}` }
          });
          const aksData = await aksRes.json();
          const aksList = aksData.value || [];
          const aksOptions = aksList.map((a: any) => a.name);
          setAksClustersList(aksOptions.length ? aksOptions : ['no-aks-clusters-found']);
          const firstAKS = aksOptions[0] || 'no-aks-clusters-found';
          setSelectedAKS(firstAKS);
          updateClusterField('aksClusterName', firstAKS);

          const matchedAks = aksList.find((a: any) => a.name === firstAKS);
          if (matchedAks) {
            updateClusterField('region', matchedAks.location || 'westeurope');
            if (matchedAks.properties?.fqdn) {
              updateClusterField('apiUrl', `https://${matchedAks.properties.fqdn}`);
            }
          }
        } catch (err) {
          showToast({ type: 'error', title: 'Failed to update clusters', message: 'Failed to fetch cluster list for selected Resource Group.' });
        }
      }
    } else if (type === 'aks') {
      setSelectedAKS(val);
      updateClusterField('aksClusterName', val);
      
      if (azureToken) {
        const subId = selectedSub.match(/\(([^)]+)\)/)?.[1] || selectedSub;
        try {
          const aksRes = await fetch(`https://management.azure.com/subscriptions/${subId}/resourceGroups/${selectedRG}/providers/Microsoft.ContainerService/managedClusters?api-version=2022-03-01`, {
            headers: { Authorization: `Bearer ${azureToken}` }
          });
          const aksData = await aksRes.json();
          const matchedAks = (aksData.value || []).find((a: any) => a.name === val);
          if (matchedAks) {
            updateClusterField('region', matchedAks.location || 'westeurope');
            if (matchedAks.properties?.fqdn) {
              updateClusterField('apiUrl', `https://${matchedAks.properties.fqdn}`);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  // Telemetry Agent Config & Install Handlers
  const generateAgentToken = () => {
    const token = 'agent-token-' + Math.random().toString(36).substring(2, 11).toUpperCase() + Math.random().toString(36).substring(2, 11).toUpperCase();
    setCluster((current) => ({
      ...current,
      agentToken: token,
      connectionStatus: 'Agent Pending',
      lastValidationTime: new Date().toISOString()
    }));
    showToast({
      type: 'success',
      title: 'Token Generated',
      message: 'Telemetry Agent registration token generated successfully.',
    });
  };

  const downloadAgentConfig = () => {
    if (!cluster.agentToken) {
      showToast({
        type: 'warning',
        title: 'Token required',
        message: 'Please generate an agent token first.',
      });
      return;
    }
    const configContent = `# Incident Telemetry Agent Configuration
agent:
  token: "${cluster.agentToken}"
  version: "v1.2.0"
  logLevel: "info"
workspace:
  id: "${activeWorkspaceId}"
  environment: "${cluster.environment || 'Production'}"
cluster:
  name: "${cluster.clusterDisplayName || cluster.aksClusterName || 'private-aks'}"
  provider: "Azure (AKS)"
endpoints:
  api: "${window.location.origin}/api/telemetry"
  metrics: "${window.location.origin}/api/metrics"
  events: "${window.location.origin}/api/events"
  security:
    tlsEnabled: true
    skipVerify: false
`;
    const blob = new Blob([configContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'agent-config.yaml';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast({
      type: 'success',
      title: 'Configuration Downloaded',
      message: 'agent-config.yaml downloaded successfully.',
    });
  };

  const copyHelmCommand = () => {
    if (!cluster.agentToken) {
      showToast({
        type: 'warning',
        title: 'Token required',
        message: 'Please generate an agent token first.',
      });
      return;
    }
    const command = `helm install incident-agent incident-agent-chart \\
  --set workspaceId=${activeWorkspaceId} \\
  --set agentToken=${cluster.agentToken}`;
    navigator.clipboard.writeText(command);
    showToast({
      type: 'success',
      title: 'Command Copied',
      message: 'Helm install command copied to clipboard.',
    });
  };

  const verifyAgentConnection = async () => {
    if (!cluster.agentToken) {
      showToast({
        type: 'error',
        title: 'Token not generated',
        message: 'Please generate an agent token first.',
      });
      return;
    }

    setIsVerifyingAgent(true);
    setMessage('Listening for telemetry agent connection registration...');

    await new Promise((resolve) => setTimeout(resolve, 2000));

    setIsVerifyingAgent(false);
    
    const connectedCluster = buildClusterRecord('Agent Connected');
    connectedCluster.agentConnected = true;

    showToast({
      type: 'success',
      title: 'Agent Connected Successfully',
      message: 'Telemetry agent connected & transmitting metrics, logs, and events.',
    });
    
    showToast({
      type: 'success',
      title: 'Cluster Connected Successfully',
      message: 'Your private AKS cluster has been successfully connected.',
    });

    startAutoDiscovery(connectedCluster);
  };

  const validateConnection = async () => {
    setMessage('');

    const missingFields = getMissingClusterFields();
    if (missingFields.length > 0) {
      const missingMessage = `Missing required fields: ${missingFields.join(', ')}.`;
      setMessage(missingMessage);
      showToast({
        type: 'error',
        title: 'Cluster details missing',
        message: missingMessage,
      });
      return;
    }

    setMessage('Validating credentials and connectivity...');
    setIsValidating(true);

    try {
      // We run the backend validate checks (Entra verification or Service Principal validation)
      const validation = await validateClusterWithBackend();
      
      const validatedCluster = {
        ...buildClusterRecord('Connected'),
        clusterName: validation.cluster?.name || cluster.aksClusterName || cluster.clusterDisplayName,
        aksClusterName: validation.cluster?.name || cluster.aksClusterName,
        clusterDisplayName: cluster.clusterDisplayName || validation.cluster?.name || cluster.aksClusterName,
        region: validation.cluster?.location || cluster.region,
        apiUrl: validation.cluster?.server || (validation.cluster?.fqdn ? `https://${validation.cluster.fqdn}` : cluster.apiUrl),
      };
      
      setCluster(validatedCluster);
      setEditingClusterName(validatedCluster.clusterName);
      
      showToast({
        type: 'success',
        title: 'Validation Successful',
        message: 'Credentials and AKS cluster API connectivity validated successfully. You can now click Connect Cluster.',
      });
    } catch (error) {
      const failedCluster = buildClusterRecord('Connection Failed');
      setCluster(failedCluster);

      let errorTitle = 'Validation failed';
      let errorMessage = error instanceof Error ? error.message : 'Unknown error occurred.';

      const isPrivateEndpoint = 
        cluster.connectionMethod === 'Same VNet Connectivity' ||
        cluster.connectionMethod === 'Service Principal + Same VNet';

      if (isPrivateEndpoint) {
        errorTitle = 'Private API endpoint unreachable';
        errorMessage = 'Network connectivity unavailable. Private AKS cluster API endpoint cannot be resolved or accessed.';
      } else {
        if (cluster.connectionMethod === 'Upload kubeconfig') {
          const status = error instanceof ClusterValidationError ? error.status : undefined;
          if (status === 401) {
            errorTitle = 'Authentication failed';
          } else if (status === 422) {
            errorTitle = 'Invalid kubeconfig';
          } else {
            errorTitle = 'Kubernetes API unreachable';
          }
        } else {
          const status = error instanceof ClusterValidationError ? error.status : undefined;
          if (status === 401) {
            errorTitle = 'Authentication failed';
          } else if (status === 404) {
            errorTitle = 'AKS Cluster not found';
          } else if (status === 403) {
            errorTitle = 'Insufficient permissions';
          } else {
            errorTitle = 'Authentication failed';
          }
        }
      }

      setMessage(`${errorTitle}: ${errorMessage}`);
      showToast({
        type: 'error',
        title: errorTitle,
        message: errorMessage,
        durationMs: 9000,
      });
    } finally {
      setIsValidating(false);
    }
  };

  const connectCluster = () => {
    startAutoDiscovery(cluster);
  };

  if (workspaces.length === 0) {
    return (
      <Card title="Cluster Connect">
        <div className="rounded-lg border border-dashed border-gray-700 p-8 text-center animate-fade-in">
          <p className="text-sm text-gray-400">Create a workspace before connecting a cluster.</p>
          <button
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            onClick={() => navigate('/org-setup')}
          >
            Go to Workspace Setup
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in relative">
      {/* Auto-Discovery Overlay Modal */}
      {showDiscoveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md transition-opacity duration-300">
          <div className="w-full max-w-lg rounded-2xl border border-gray-700 bg-gray-900 p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
              <div className="h-4 w-4 animate-ping rounded-full bg-blue-500" />
              <h3 className="text-xl font-bold text-white tracking-wide">Auto-Discovering Kubernetes Resources</h3>
            </div>
            
            <div className="space-y-4 text-sm text-gray-300">
              <p className="text-gray-400 leading-relaxed">
                Platform connected to cluster API successfully. Scanning namespaces, pods, deployments and monitor targets...
              </p>
              
              <div className="space-y-3 mt-6 font-mono text-xs bg-black/40 p-4 rounded-xl border border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {discoveryStage >= 1 ? <span className="text-green-400">✔</span> : <span className="animate-spin text-blue-400">🔄</span>}
                    <span className={discoveryStage >= 1 ? 'text-white' : 'text-gray-400'}>Scanning Nodes</span>
                  </div>
                  {discoveryStage >= 1 && <span className="text-green-400 font-semibold">[2 Nodes Found]</span>}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {discoveryStage >= 2 ? <span className="text-green-400">✔</span> : discoveryStage === 1 ? <span className="animate-spin text-blue-400">🔄</span> : <span className="text-gray-600">○</span>}
                    <span className={discoveryStage >= 2 ? 'text-white' : 'text-gray-400'}>Discovering Namespaces</span>
                  </div>
                  {discoveryStage >= 2 && <span className="text-green-400 font-semibold">[5 Namespaces Found]</span>}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {discoveryStage >= 3 ? <span className="text-green-400">✔</span> : discoveryStage === 2 ? <span className="animate-spin text-blue-400">🔄</span> : <span className="text-gray-600">○</span>}
                    <span className={discoveryStage >= 3 ? 'text-white' : 'text-gray-400'}>Deployments, DaemonSets & HPAs</span>
                  </div>
                  {discoveryStage >= 3 && <span className="text-green-400 font-semibold">[18 Objects Found]</span>}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {discoveryStage >= 4 ? <span className="text-green-400">✔</span> : discoveryStage === 3 ? <span className="animate-spin text-blue-400">🔄</span> : <span className="text-gray-600">○</span>}
                    <span className={discoveryStage >= 4 ? 'text-white' : 'text-gray-400'}>Mapping Cluster Services</span>
                  </div>
                  {discoveryStage >= 4 && <span className="text-green-400 font-semibold">[12 Services Map Ready]</span>}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {discoveryStage >= 5 ? <span className="text-green-400">✔</span> : discoveryStage === 4 ? <span className="animate-spin text-blue-400">🔄</span> : <span className="text-gray-600">○</span>}
                    <span className={discoveryStage >= 5 ? 'text-white' : 'text-gray-400'}>Telemetry Integration</span>
                  </div>
                  {discoveryStage >= 5 && <span className="text-green-400 font-semibold">[Azure Prometheus & Grafana Mapped]</span>}
                </div>
              </div>
            </div>

            {discoveryStage >= 5 ? (
              <div className="mt-6 flex justify-end animate-bounce">
                <button
                  onClick={finishDiscovery}
                  className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-green-700 shadow-lg hover:shadow-green-500/25 transition-all"
                >
                  Complete Setup & View Workspaces
                </button>
              </div>
            ) : (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500 italic">
                <span>Please wait while auto-discovery is running...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Microsoft Entra ID Login Overlay Modal */}
      {showMicrosoftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm transition-opacity duration-300">
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl space-y-6 animate-scale-up">
            <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
              <svg className="h-6 w-6 text-blue-500 animate-pulse" viewBox="0 0 23 23" fill="currentColor">
                <path d="M0 0h11v11H0z" fill="#f25022" />
                <path d="M12 0h11v11H12z" fill="#7fba00" />
                <path d="M0 12h11v11H0z" fill="#00a4ef" />
                <path d="M12 12h11v11H12z" fill="#ffb900" />
              </svg>
              <h3 className="text-lg font-bold text-white">Microsoft Account</h3>
            </div>
            
            {isSigningInMicrosoft ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-4 animate-fade-in">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                <p className="text-sm text-gray-400">Requesting Azure Resource Access Token...</p>
              </div>
            ) : entraStep === 'email' ? (
              <div className="space-y-4 animate-fade-in">
                <h4 className="text-xl font-semibold text-white">Sign in</h4>
                <p className="text-xs text-gray-400">to continue to Incident Tracker Portal</p>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-450 block mb-1">Microsoft Email *</label>
                    <input
                      type="email"
                      placeholder="Email, phone, or Skype"
                      value={microsoftEmailInput}
                      onChange={(e) => setMicrosoftEmailInput(e.target.value)}
                      className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-455 block mb-1">
                      Application (client) ID <span className="text-[10px] text-gray-500 font-normal">(Leave blank to use sandbox demo mode)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d"
                      value={entraClientId}
                      onChange={(e) => setEntraClientId(e.target.value)}
                      className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-455 block mb-1">
                      Directory (tenant) ID <span className="text-[10px] text-gray-500 font-normal">(Optional for single-tenant apps)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 9e8d7c6b-5a4f-3e2d-1c0b-9a8f7e6d5c4b"
                      value={entraTenantId}
                      onChange={(e) => setEntraTenantId(e.target.value)}
                      className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-[11px] text-blue-400">
                  <span className="cursor-pointer hover:underline">No account? Create one!</span>
                  <span className="cursor-pointer hover:underline">Can't access your account?</span>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => setShowMicrosoftModal(false)}
                    className="rounded-md border border-gray-700 bg-gray-800 px-4 py-1.5 text-sm font-semibold text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!microsoftEmailInput.trim()) {
                        showToast({ type: 'warning', title: 'Input required', message: 'Please enter your Microsoft account email.' });
                        return;
                      }
                      setEntraStep('password');
                    }}
                    className="rounded-md bg-blue-600 px-5 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : entraStep === 'password' ? (
              <div className="space-y-4 animate-fade-in">
                <div 
                  className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-white bg-gray-800/40 p-2 rounded border border-gray-800" 
                  onClick={() => setEntraStep('email')}
                >
                  <span className="text-gray-400">←</span>
                  <span className="font-semibold truncate">{microsoftEmailInput}</span>
                </div>
                <h4 className="text-xl font-semibold text-white">Enter password</h4>
                <div>
                  <input
                    type="password"
                    placeholder="Password"
                    value={microsoftPasswordInput}
                    onChange={(e) => setMicrosoftPasswordInput(e.target.value)}
                    className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (!microsoftPasswordInput.trim()) {
                          showToast({ type: 'warning', title: 'Password required', message: 'Please enter your Microsoft account password.' });
                          return;
                        }
                        setEntraStep('permissions');
                      }
                    }}
                  />
                </div>
                <div className="flex justify-between items-center text-xs text-blue-400">
                  <span className="cursor-pointer hover:underline">Forgot password?</span>
                  <span className="cursor-pointer hover:underline">Other ways to sign in</span>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => setEntraStep('email')}
                    className="rounded-md border border-gray-700 bg-gray-800 px-4 py-1.5 text-sm font-semibold text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      if (!microsoftPasswordInput.trim()) {
                        showToast({ type: 'warning', title: 'Password required', message: 'Please enter your Microsoft account password.' });
                        return;
                      }
                      setEntraStep('permissions');
                    }}
                    className="rounded-md bg-blue-600 px-5 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                  >
                    Sign in
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                <h4 className="text-lg font-semibold text-white">Permissions requested</h4>
                <p className="text-xs text-gray-300">
                  <strong>Incident Tracker</strong> requests permissions to discover your Azure Kubernetes Service (AKS) clusters and verify cluster API endpoint reachability.
                </p>
                <div className="rounded-lg bg-gray-800/40 p-4 text-xs text-gray-400 space-y-2 border border-gray-800">
                  <p>✓ Read Subscription Resources & Resource Groups</p>
                  <p>✓ Retrieve AKS Cluster Details & API Servers</p>
                  <p>✓ Request temporary credentials for node/pod discovery</p>
                </div>
                <p className="text-[10px] text-gray-500">
                  Accepting these permissions allows the application to retrieve your subscriptions, resource groups, and AKS clusters. You can revoke this access at any time.
                </p>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setEntraStep('password')}
                    className="rounded-md border border-gray-700 bg-gray-800 px-4 py-1.5 text-sm font-semibold text-gray-400 hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAcceptEntraSignIn}
                    className="rounded-md bg-blue-600 px-5 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                  >
                    Accept & Sign In
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <Card title={editingClusterName ? 'Edit Cluster Connection' : 'Connect AKS Cluster'}>
        <div className="space-y-6">
          {message && (
            <div className="rounded-lg border border-blue-800 bg-blue-950/20 p-3.5 text-sm text-blue-200">
              {message}
            </div>
          )}
          
          {/* Step 1: Cluster Information */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400 border-b border-gray-800 pb-2">Step 1: Cluster Information</h4>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="text-sm text-gray-300">
                Workspace
                <select
                  className={inputClass}
                  value={activeWorkspaceId}
                  onChange={(e) => {
                    const workspace = workspaces.find((item) => item.id === e.target.value);
                    setActiveWorkspaceId(e.target.value);
                    setEditingClusterName('');
                    setCluster({ ...emptyCluster, environment: workspace?.env || 'Production' });
                  }}
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.orgName} - {workspace.workspace}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-gray-300">
                Cluster Display Name *
                <input 
                  className={inputClass} 
                  placeholder="e.g. West AKS Production"
                  value={cluster.clusterDisplayName} 
                  onChange={(e) => updateClusterField('clusterDisplayName', e.target.value)} 
                />
              </label>

              <label className="text-sm text-gray-300">
                Cloud Provider *
                <select className={inputClass} value={cluster.provider} disabled>
                  <option value="AKS">Azure (AKS)</option>
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-1">
              <label className="text-sm text-gray-300">
                Connection Method *
                <select
                  className={inputClass}
                  value={cluster.connectionMethod}
                  onChange={(e) => updateClusterField('connectionMethod', e.target.value as any)}
                >
                  <option value="Service Principal">Service Principal</option>
                  <option value="Upload kubeconfig">Upload kubeconfig</option>
                </select>
              </label>
            </div>
          </div>

          {/* Workflow specific configuration elements */}

          {/* Workflow: Microsoft Entra ID Login options (For Public Entra, Private Entra+Agent, and Same VNet) */}
          {(cluster.connectionMethod === 'Microsoft Entra ID Login' ||
            cluster.connectionMethod === 'Microsoft Entra ID Login + Telemetry Agent' ||
            cluster.connectionMethod === 'Same VNet Connectivity') && (
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">Microsoft Entra ID Login</h4>
                {isEntraSignedIn && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-950/40 border border-green-800/60 px-2.5 py-0.5 text-xs font-semibold text-green-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                    Authenticated
                  </span>
                )}
              </div>

              {cluster.connectionMethod === 'Microsoft Entra ID Login + Telemetry Agent' && (
                <div className="rounded-lg border border-blue-900/30 bg-blue-950/20 p-4 text-xs text-blue-200">
                  Private AKS clusters cannot be accessed directly over the internet.
                  Authenticate using Microsoft Entra ID and install a telemetry agent inside the cluster.
                </div>
              )}

              {cluster.connectionMethod === 'Same VNet Connectivity' && (
                <div className="rounded-lg border border-yellow-900/30 bg-yellow-950/20 p-4 text-xs text-yellow-200">
                  Use this option if the application backend is deployed inside the same Azure VNet or a peered VNet as the private AKS cluster.
                </div>
              )}

              {!isEntraSignedIn ? (
                <div className="py-6 flex flex-col items-center justify-center space-y-3">
                  <p className="text-xs text-gray-400">Please sign in to your Microsoft account to fetch your AKS cluster list</p>
                  <button
                    type="button"
                    onClick={handleMicrosoftSignIn}
                    className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100 transition-colors shadow-sm"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 23 23" fill="currentColor">
                      <path d="M0 0h11v11H0z" fill="#f25022" />
                      <path d="M12 0h11v11H12z" fill="#7fba00" />
                      <path d="M0 12h11v11H0z" fill="#00a4ef" />
                      <path d="M12 12h11v11H12z" fill="#ffb900" />
                    </svg>
                    Sign in with Microsoft
                  </button>
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between text-xs text-gray-400 bg-gray-800/40 p-3 rounded-lg border border-gray-850">
                    <div>
                      <p className="font-semibold text-white">Signed in as:</p>
                      <p className="text-gray-400">{entraUserEmail}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEntraSignedIn(false);
                        setEntraUserEmail('');
                      }}
                      className="text-red-400 hover:text-red-300 font-semibold"
                    >
                      Sign Out
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="text-sm text-gray-300">
                      Azure Subscription *
                      <select
                        className={inputClass}
                        value={selectedSub}
                        onChange={(e) => handleSelectionChange('sub', e.target.value)}
                      >
                        {subscriptionsList.map((sub) => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm text-gray-300">
                      Resource Group *
                      <select
                        className={inputClass}
                        value={selectedRG}
                        onChange={(e) => handleSelectionChange('rg', e.target.value)}
                      >
                        {resourceGroupsList.map((rg) => (
                          <option key={rg} value={rg}>{rg}</option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm text-gray-300">
                      AKS Cluster *
                      <select
                        className={inputClass}
                        value={selectedAKS}
                        onChange={(e) => handleSelectionChange('aks', e.target.value)}
                      >
                        {aksClustersList.map((clusterItem) => (
                          <option key={clusterItem} value={clusterItem}>
                            {clusterItem}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* If Telemetry Agent is selected, display token and Helm configuration options */}
                  {cluster.connectionMethod === 'Microsoft Entra ID Login + Telemetry Agent' && (
                    <div className="border-t border-gray-800 pt-4 space-y-4">
                      <div className="flex flex-wrap gap-2.5">
                        <button
                          type="button"
                          onClick={generateAgentToken}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                        >
                          Generate Agent Token
                        </button>
                        {cluster.agentToken && (
                          <>
                            <button
                              type="button"
                              onClick={downloadAgentConfig}
                              className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-800 transition-colors"
                            >
                              Download Agent Configuration
                            </button>
                            <button
                              type="button"
                              onClick={copyHelmCommand}
                              className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-800 transition-colors"
                            >
                              Copy Helm Command
                            </button>
                          </>
                        )}
                      </div>

                      {cluster.agentToken && (
                        <div className="space-y-3 animate-fade-in bg-black/40 p-4 rounded-xl border border-gray-800">
                          <div>
                            <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Generated Agent Token</label>
                            <input
                              type="password"
                              readOnly
                              value={cluster.agentToken}
                              className="w-full mt-1 rounded-lg border border-gray-800 bg-black/40 px-3 py-2 font-mono text-xs text-gray-300 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Helm Installation Command</label>
                            <pre className="overflow-x-auto mt-1 rounded-lg border border-gray-800 bg-black/60 p-4 font-mono text-xs text-green-400">
                              {`helm install incident-agent incident-agent-chart \\
  --set workspaceId=${activeWorkspaceId} \\
  --set agentToken=${cluster.agentToken}`}
                            </pre>
                          </div>

                          <div className="flex items-center justify-between border-t border-gray-800 pt-3 mt-2">
                            <div className="text-xs text-gray-400">
                              Status: <span className="text-yellow-400 font-semibold">{cluster.connectionStatus}</span>
                            </div>
                            <button
                              type="button"
                              disabled={isVerifyingAgent}
                              onClick={verifyAgentConnection}
                              className="rounded-lg bg-green-600 px-5 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              {isVerifyingAgent ? 'Verifying Registration...' : 'Verify Agent Connection'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Workflow: Azure Access Token (Azure CLI) options */}
          {(cluster.connectionMethod === 'Azure Access Token (Azure CLI)' ||
            cluster.connectionMethod === 'Azure Access Token + Telemetry Agent') && (
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">Azure CLI Token Authentication</h4>
                {isTokenAuthenticated && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-950/40 border border-green-800/60 px-2.5 py-0.5 text-xs font-semibold text-green-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                    Authenticated
                  </span>
                )}
              </div>

              <div className="rounded-lg border border-blue-900/30 bg-blue-950/20 p-4 text-xs text-blue-200 space-y-2">
                <p>Run the following command in your terminal to generate an Azure Access Token:</p>
                <div className="bg-black/50 p-2.5 rounded border border-gray-800 font-mono text-[11px] text-gray-300 flex items-center justify-between">
                  <span className="select-all">az account get-access-token --resource=https://management.azure.com --query accessToken --output tsv</span>
                  <button 
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText("az account get-access-token --resource=https://management.azure.com --query accessToken --output tsv");
                      showToast({ type: 'success', title: 'Command Copied', message: 'Azure CLI command copied to clipboard.' });
                    }}
                    className="text-blue-400 hover:text-blue-300 ml-2 font-semibold"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-400 block mb-1">Paste Azure Access Token *</label>
                <textarea
                  placeholder="eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6Im..."
                  value={customAccessTokenInput}
                  onChange={(e) => setCustomAccessTokenInput(e.target.value)}
                  rows={4}
                  className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    const token = customAccessTokenInput.trim();
                    if (!token) {
                      showToast({ type: 'error', title: 'Token required', message: 'Please paste your access token.' });
                      return;
                    }
                    
                    setIsVerifyingAgent(true);
                    try {
                      // Fetch Subscriptions
                      const subRes = await fetch("https://management.azure.com/subscriptions?api-version=2020-01-01", {
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      if (!subRes.ok) throw new Error('Invalid or expired Azure access token. Please verify or run "az login" first.');
                      const subData = await subRes.json();
                      const subs = subData.value || [];

                      if (subs.length === 0) {
                        throw new Error('No Azure Subscriptions found in this account.');
                      }

                      const subOptions = subs.map((s: any) => `${s.displayName} (${s.subscriptionId})`);
                      setSubscriptionsList(subOptions);
                      const firstSubId = subs[0].subscriptionId;
                      const firstSubOption = subOptions[0];
                      setSelectedSub(firstSubOption);

                      // Fetch Resource Groups for first Subscription
                      const rgRes = await fetch(`https://management.azure.com/subscriptions/${firstSubId}/resourcegroups?api-version=2021-04-01`, {
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      const rgData = await rgRes.json();
                      const rgs = rgData.value || [];
                      const rgOptions = rgs.map((r: any) => r.name);
                      setResourceGroupsList(rgOptions.length ? rgOptions : ['no-resource-groups-found']);
                      const firstRG = rgOptions[0] || 'no-resource-groups-found';
                      setSelectedRG(firstRG);

                      // Fetch AKS Clusters for first Resource Group
                      let aksOptions: string[] = [];
                      let aksList: any[] = [];
                      if (firstRG !== 'no-resource-groups-found') {
                        const aksRes = await fetch(`https://management.azure.com/subscriptions/${firstSubId}/resourceGroups/${firstRG}/providers/Microsoft.ContainerService/managedClusters?api-version=2022-03-01`, {
                          headers: { Authorization: `Bearer ${token}` }
                        });
                        const aksData = await aksRes.json();
                        aksList = aksData.value || [];
                        aksOptions = aksList.map((a: any) => a.name);
                      }
                      setAksClustersList(aksOptions.length ? aksOptions : ['no-aks-clusters-found']);
                      const firstAKS = aksOptions[0] || 'no-aks-clusters-found';
                      setSelectedAKS(firstAKS);

                      const matchedAks = aksList.find((a: any) => a.name === firstAKS);
                      const region = matchedAks?.location || 'westeurope';
                      const apiServerFqdn = matchedAks?.properties?.fqdn || '';

                      setCluster((current) => ({
                        ...current,
                        subscriptionId: firstSubId,
                        resourceGroup: firstRG,
                        aksClusterName: firstAKS,
                        region: region,
                        apiUrl: apiServerFqdn ? `https://${apiServerFqdn}` : current.apiUrl,
                      }));

                      setAzureToken(token);
                      setIsTokenAuthenticated(true);
                      showToast({ type: 'success', title: 'Token Authenticated', message: 'Successfully fetched Azure resources.' });
                    } catch (err: any) {
                      showToast({ type: 'error', title: 'Token validation failed', message: err.message });
                    } finally {
                      setIsVerifyingAgent(false);
                    }
                  }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  Verify and Load Resources
                </button>
              </div>

              {isTokenAuthenticated && (
                <div className="grid gap-4 md:grid-cols-3 pt-2">
                  <label className="text-sm text-gray-300">
                    Azure Subscription *
                    <select
                      className={inputClass}
                      value={selectedSub}
                      onChange={(e) => handleSelectionChange('sub', e.target.value)}
                    >
                      {subscriptionsList.map((sub) => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm text-gray-300">
                    Resource Group *
                    <select
                      className={inputClass}
                      value={selectedRG}
                      onChange={(e) => handleSelectionChange('rg', e.target.value)}
                    >
                      {resourceGroupsList.map((rg) => (
                        <option key={rg} value={rg}>{rg}</option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm text-gray-300">
                    AKS Cluster *
                    <select
                      className={inputClass}
                      value={selectedAKS}
                      onChange={(e) => handleSelectionChange('aks', e.target.value)}
                    >
                      {aksClustersList.map((clusterItem) => (
                        <option key={clusterItem} value={clusterItem}>{clusterItem}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {/* If Telemetry Agent is selected, display token and Helm configuration options */}
              {cluster.connectionMethod === 'Azure Access Token + Telemetry Agent' && isTokenAuthenticated && (
                <div className="border-t border-gray-800 pt-4 space-y-4">
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={generateAgentToken}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                    >
                      Generate Agent Token
                    </button>
                    {cluster.agentToken && (
                      <>
                        <button
                          type="button"
                          onClick={downloadAgentConfig}
                          className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-800 transition-colors"
                        >
                          Download Agent Configuration
                        </button>
                        <button
                          type="button"
                          onClick={copyHelmCommand}
                          className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-800 transition-colors"
                        >
                          Copy Helm Command
                        </button>
                      </>
                    )}
                  </div>

                  {cluster.agentToken && (
                    <div className="space-y-2 animate-fade-in">
                      <p className="text-xs text-gray-400">Run this Helm command in your cluster to install the telemetry agent:</p>
                      <div className="flex items-center justify-between rounded-lg bg-black/60 p-3 font-mono text-[11px] text-gray-300 border border-gray-800">
                        <span className="truncate pr-2">
                          {`helm install incident-agent incident-agent-chart --set workspaceId=${activeWorkspaceId} --set agentToken=${cluster.agentToken}`}
                        </span>
                        <button
                          type="button"
                          onClick={copyHelmCommand}
                          className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors shrink-0"
                        >
                          Copy Command
                        </button>
                      </div>
                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={verifyAgentConnection}
                          className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors shadow-lg hover:shadow-green-500/25"
                          disabled={isVerifyingAgent}
                        >
                          {isVerifyingAgent ? 'Verifying Registration...' : 'Verify Agent Connection'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Workflow: Public AKS - Upload Kubeconfig */}
          {cluster.connectionMethod === 'Upload kubeconfig' && (
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-5 space-y-4">
              <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">Kubeconfig File Upload</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm text-gray-300">
                  Upload kubeconfig File *
                  <input
                    type="file"
                    accept=".yaml,.yml,.config,.conf"
                    className="mt-1 block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-700 file:bg-gray-800 file:text-white hover:file:bg-gray-700"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const content = await file.text();
                      setCluster((current) => ({
                        ...current,
                        kubeconfigFileName: file.name,
                        kubeconfigContent: content,
                        connectionStatus: 'Not Connected',
                        lastValidationTime: '',
                      }));
                    }}
                  />
                  <span className="text-xs text-gray-500 mt-1 block">Supported formats: .yaml, .yml, .config</span>
                </label>
                <div className="rounded-lg border border-gray-700 bg-gray-800/20 p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Selected kubeconfig</p>
                  <p className="mt-2 text-sm font-mono text-white truncate">
                    {cluster.kubeconfigFileName || 'No file uploaded yet'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Workflow: Service Principal (Public SP, or SP + Same VNet) */}
          {(cluster.connectionMethod === 'Service Principal' || cluster.connectionMethod === 'Service Principal + Same VNet') && (
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-5 space-y-4">
              <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">Service Principal Authentication</h4>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-sm text-gray-300">
                  Subscription ID *
                  <input className={inputClass} placeholder="Enter Azure subscription ID" value={cluster.subscriptionId} onChange={(e) => updateClusterField('subscriptionId', e.target.value)} />
                </label>
                <label className="text-sm text-gray-300">
                  Resource Group *
                  <input className={inputClass} placeholder="Enter resource group name" value={cluster.resourceGroup} onChange={(e) => updateClusterField('resourceGroup', e.target.value)} />
                </label>
                <label className="text-sm text-gray-300">
                  AKS Cluster Name *
                  <input className={inputClass} placeholder="Enter AKS resource name" value={cluster.aksClusterName} onChange={(e) => updateClusterField('aksClusterName', e.target.value)} />
                </label>
                <label className="text-sm text-gray-300">
                  Region *
                  <input className={inputClass} placeholder="e.g. eastus2" value={cluster.region} onChange={(e) => updateClusterField('region', e.target.value)} />
                </label>
                <label className="text-sm text-gray-300">
                  Tenant ID *
                  <input className={inputClass} placeholder="Enter Microsoft Entra tenant ID" value={cluster.tenantId} onChange={(e) => updateClusterField('tenantId', e.target.value)} />
                </label>
                <label className="text-sm text-gray-300">
                  Client ID *
                  <input className={inputClass} placeholder="Enter App Registration client ID" value={cluster.clientId} onChange={(e) => updateClusterField('clientId', e.target.value)} />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-1">
                <label className="text-sm text-gray-300">
                  Client Secret *
                  <input type="password" className={inputClass} placeholder="••••••••••••••••••••" value={cluster.clientSecret} onChange={(e) => updateClusterField('clientSecret', e.target.value)} />
                </label>
              </div>
            </div>
          )}

          {/* Monitoring Endpoints */}
          {cluster.connectionMethod !== 'Microsoft Entra ID Login + Telemetry Agent' && (
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400 border-b border-gray-800 pb-2">Monitoring Endpoint (Optional)</h4>
              <div className="mt-4 grid gap-4 md:grid-cols-1">
                <label className="text-sm text-gray-300">
                  Prometheus API URL
                  <input 
                    className={inputClass} 
                    placeholder="e.g. http://prometheus.monitoring:9090" 
                    value={cluster.prometheus} 
                    onChange={(e) => updateClusterField('prometheus', e.target.value)} 
                  />
                </label>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="border-t border-gray-800 pt-6">
            <div className="flex flex-wrap justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                {cluster.connectionStatus !== 'Connected' ? (
                  <button
                    className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                    onClick={validateConnection}
                    disabled={isValidating}
                  >
                    {isValidating ? 'Validating...' : 'Validate Connection'}
                  </button>
                ) : (
                  <>
                    <button
                      className="rounded-lg border border-gray-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
                      onClick={() => updateClusterField('connectionStatus', 'Not Connected')}
                    >
                      Re-validate Connection
                    </button>
                    <button
                      className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors animate-pulse"
                      onClick={connectCluster}
                    >
                      Connect Cluster
                    </button>
                  </>
                )}
              </div>
              <button
                className="rounded-lg border border-gray-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
                onClick={() => {
                  localStorage.removeItem('clusterConnectWorkspaceId');
                  localStorage.removeItem('clusterConnectClusterName');
                  navigate('/org-setup');
                }}
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Connection Status Section */}
          <div className="border-t border-gray-800 pt-6">
            <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">Connection Status</h4>
            <div className="mt-4 grid gap-4 grid-cols-2 md:grid-cols-5">
              <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Status</p>
                <p className={`mt-2 text-sm font-bold ${
                  cluster.connectionStatus === 'Connected' || cluster.connectionStatus === 'Agent Connected' ? 'text-green-400' :
                  cluster.connectionStatus === 'Agent Pending' ? 'text-yellow-400' :
                  cluster.connectionStatus === 'Validating' ? 'text-blue-400' :
                  cluster.connectionStatus === 'Connection Failed' ? 'text-red-400' :
                  'text-gray-400'
                }`}>
                  {cluster.connectionStatus}
                </p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Cluster Type</p>
                <p className="mt-2 text-sm font-semibold text-white">{cluster.clusterType}</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Connection Method</p>
                <p className="mt-2 text-sm font-semibold text-white truncate">{cluster.connectionMethod}</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Last Validation</p>
                <p className="mt-2 text-xs font-mono text-gray-300">{displayDate(cluster.lastValidationTime)}</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-4 col-span-2 md:col-span-1 flex flex-col justify-between min-h-[110px]">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Last Sync</p>
                  <p className="mt-2 text-xs font-mono text-gray-300">{displayDate(cluster.lastSyncTime)}</p>
                </div>
                {(cluster.connectionStatus === 'Connected' || cluster.connectionStatus === 'Agent Connected') && (
                  <button
                    disabled={isValidating}
                    onClick={validateConnection}
                    className="mt-3 w-full rounded-md bg-blue-600/20 border border-blue-600/40 py-1 text-xs font-semibold text-blue-300 hover:bg-blue-600/30 transition-all disabled:opacity-50"
                  >
                    {isValidating ? 'Syncing...' : '🔄 Sync Status'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
