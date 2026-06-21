import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { userLocalStorage as localStorage } from '../utils/clusterContext';
import { Card } from '../components/shared/Cards';
import { showToast } from '../utils/toast';

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none';

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
  apiUrl: string;
  prometheus: string;
  grafana: string;
  loki: string;
  connectionStatus: 'Not Connected' | 'Validating' | 'Connected' | 'Agent Pending' | 'Agent Connected' | 'Connection Failed';
  clusterType?: 'Public AKS Cluster' | 'Private AKS Cluster';
  connectionMethod?: 
    | 'Upload kubeconfig' 
    | 'Service Principal' 
    | 'Microsoft Entra ID Login' 
    | 'Microsoft Entra ID Login + Telemetry Agent' 
    | 'Same VNet Connectivity' 
    | 'Service Principal + Same VNet';
  agentToken?: string;
  agentConnected?: boolean;
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

const emptyWorkspace: WorkspaceForm = {
  orgName: '',
  orgId: '',
  workspace: '',
  env: 'Production',
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

export const OrgSetup: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<WorkspaceForm>(emptyWorkspace);
  const [workspaces, setWorkspaces] = useState<SavedWorkspace[]>(getSavedWorkspaces);
  const [showWorkspaceForm, setShowWorkspaceForm] = useState(false);
  const [focusedWorkspaceId, setFocusedWorkspaceId] = useState('');
  const [message, setMessage] = useState('');
  const [activeClusterName, setActiveClusterName] = useState(localStorage.getItem('selectedCluster') || '');
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  const syncCluster = async (workspaceId: string, clusterName: string) => {
    setIsSyncing(clusterName);
    showToast({
      type: 'info',
      title: 'Syncing Cluster',
      message: `Fetching live cluster state for ${clusterName}...`,
    });

    try {
      // Invalidate queries to fetch fresh live data from Kubernetes API
      await queryClient.invalidateQueries({ queryKey: ['cluster-health'] });
      await queryClient.invalidateQueries({ queryKey: ['incidents'] });
      await queryClient.invalidateQueries({ queryKey: ['kpis'] });
      await queryClient.invalidateQueries({ queryKey: ['alerts'] });

      // Update the lastSyncTime timestamp in the workspace/cluster records
      const updatedWorkspaces = workspaces.map((w) => {
        if (w.id === workspaceId) {
          return {
            ...w,
            clusters: w.clusters.map((c) => {
              if (c.clusterName === clusterName) {
                return {
                  ...c,
                  lastSyncTime: new Date().toISOString(),
                  connectionStatus: 'Connected' as const,
                };
              }
              return c;
            }),
          };
        }
        return w;
      });

      persistWorkspaces(updatedWorkspaces);
      
      // Update selected cluster / active workspace in localStorage if it was the selected one
      const currentSelected = localStorage.getItem('selectedCluster');
      if (currentSelected === clusterName) {
        const activeWorkspace = updatedWorkspaces.find((w) => w.id === workspaceId);
        const activeCluster = activeWorkspace?.clusters.find((c) => c.clusterName === clusterName);
        if (activeWorkspace) localStorage.setItem('workspace', JSON.stringify(activeWorkspace));
        if (activeCluster) localStorage.setItem('cluster', JSON.stringify(activeCluster));
      }

      showToast({
        type: 'success',
        title: 'Sync Completed',
        message: `Successfully synchronized with live cluster ${clusterName}.`,
      });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Sync Failed',
        message: 'Could not connect to the cluster. Please verify credentials.',
      });
    } finally {
      setIsSyncing(null);
    }
  };



  const tableRows = useMemo(() => {
    const rows: {
      workspaceId: string;
      workspaceName: string;
      orgName: string;
      orgId: string;
      env: string;
      cluster?: ClusterForm;
    }[] = [];

    workspaces.forEach((workspace) => {
      if (workspace.clusters.length === 0) {
        rows.push({
          workspaceId: workspace.id,
          workspaceName: workspace.workspace,
          orgName: workspace.orgName,
          orgId: workspace.orgId,
          env: workspace.env,
        });
      } else {
        workspace.clusters.forEach((cluster) => {
          rows.push({
            workspaceId: workspace.id,
            workspaceName: workspace.workspace,
            orgName: workspace.orgName,
            orgId: workspace.orgId,
            env: workspace.env,
            cluster,
          });
        });
      }
    });

    return rows;
  }, [workspaces]);

  const persistWorkspaces = (nextWorkspaces: SavedWorkspace[]) => {
    localStorage.setItem('workspaces', JSON.stringify(nextWorkspaces));
    setWorkspaces(nextWorkspaces);
    window.dispatchEvent(new Event('workspaces-updated'));
  };

  const createWorkspace = () => {
    setMessage('');

    if (!form.workspace || !form.orgName || !form.orgId) {
      setMessage('Enter workspace name, organization name, and organization ID.');
      showToast({
        type: 'error',
        title: 'Workspace details missing',
        message: 'Workspace name, organization name, and organization ID are required.',
      });
      return;
    }

    const savedWorkspace: SavedWorkspace = {
      ...form,
      id: `${form.orgId}-${Date.now()}`,
      createdAt: new Date().toISOString(),
      clusters: [],
    };
    const nextWorkspaces = [savedWorkspace, ...workspaces];

    persistWorkspaces(nextWorkspaces);
    localStorage.setItem('workspace', JSON.stringify(savedWorkspace));
    setForm(emptyWorkspace);
    setShowWorkspaceForm(false);
    setFocusedWorkspaceId(savedWorkspace.id);
    setMessage('Workspace created. You can now connect your cluster.');
    showToast({
      type: 'success',
      title: 'Workspace created',
      message: `${savedWorkspace.workspace} is ready.`,
    });
  };

  const openClusterForm = (workspaceId: string) => {
    localStorage.setItem('clusterConnectWorkspaceId', workspaceId);
    showToast({
      type: 'info',
      title: 'Connect your cluster',
      message: 'Enter AKS and service principal details.',
    });
    navigate('/cluster-connect');
  };

  const editCluster = (workspaceId: string, selectedCluster: ClusterForm) => {
    localStorage.setItem('clusterConnectWorkspaceId', workspaceId);
    localStorage.setItem('clusterConnectClusterName', selectedCluster.clusterName);
    showToast({
      type: 'info',
      title: 'Editing cluster',
      message: selectedCluster.clusterDisplayName || selectedCluster.clusterName,
    });
    navigate('/cluster-connect');
  };

  const removeWorkspace = (workspaceId: string) => {
    const workspaceToRemove = workspaces.find((workspace) => workspace.id === workspaceId);
    const selectedCluster = localStorage.getItem('selectedCluster');
    const nextWorkspaces = workspaces.filter((workspace) => workspace.id !== workspaceId);
    const removedSelectedWorkspace =
      workspaceToRemove?.clusters.some((item) => item.clusterName === selectedCluster);

    if (removedSelectedWorkspace) {
      setFocusedWorkspaceId('');
      localStorage.removeItem('workspace');
      localStorage.removeItem('cluster');
      localStorage.removeItem('selectedCluster');
    }
    persistWorkspaces(nextWorkspaces);
    setMessage('Workspace removed.');
    showToast({
      type: 'success',
      title: 'Workspace removed',
      message: workspaceToRemove?.workspace || 'Workspace deleted',
    });
  };

  const removeCluster = (workspaceId: string, clusterName: string) => {
    const nextWorkspaces = workspaces.map((workspace) =>
      workspace.id === workspaceId
        ? {
            ...workspace,
            clusters: workspace.clusters.filter((item) => item.clusterName !== clusterName),
          }
        : workspace
    );

    if (localStorage.getItem('selectedCluster') === clusterName) {
      localStorage.removeItem('cluster');
      localStorage.removeItem('selectedCluster');
      setActiveClusterName('');
    }
    persistWorkspaces(nextWorkspaces);
    setMessage(`${clusterName} removed.`);
    showToast({
      type: 'success',
      title: 'Cluster removed',
      message: clusterName,
    });
  };

  const selectCluster = (workspace: SavedWorkspace, selectedCluster: ClusterForm) => {
    localStorage.setItem('workspace', JSON.stringify(workspace));
    localStorage.setItem('cluster', JSON.stringify(selectedCluster));
    localStorage.setItem('selectedCluster', selectedCluster.clusterName);
    setActiveClusterName(selectedCluster.clusterName);
    window.dispatchEvent(new Event('workspaces-updated'));
    setMessage(`${selectedCluster.clusterDisplayName || selectedCluster.clusterName} selected.`);
    showToast({
      type: 'success',
      title: 'Cluster selected',
      message: selectedCluster.clusterDisplayName || selectedCluster.clusterName,
    });
  };

  const visibleWorkspaces = focusedWorkspaceId
    ? workspaces.filter((workspace) => workspace.id === focusedWorkspaceId)
    : workspaces;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <>
          <Card title="Create Workspace">
            {!showWorkspaceForm ? (
              <div className="flex justify-end">
                <button
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  onClick={() => setShowWorkspaceForm(true)}
                >
                  Create Workspace
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block text-sm text-gray-300">
                  Workspace Name
                  <input
                    className={inputClass}
                    value={form.workspace}
                    onChange={(e) => setForm({ ...form, workspace: e.target.value })}
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="block text-sm text-gray-300">
                    Organization Name
                    <input className={inputClass} value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })} />
                  </label>
                  <label className="block text-sm text-gray-300">
                    Organization ID
                    <input className={inputClass} value={form.orgId} onChange={(e) => setForm({ ...form, orgId: e.target.value })} />
                  </label>
                  <label className="block text-sm text-gray-300">
                    Environment Type
                    <select className={inputClass} value={form.env} onChange={(e) => setForm({ ...form, env: e.target.value })}>
                      <option>Production</option>
                      <option>Staging</option>
                      <option>Development</option>
                    </select>
                  </label>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                    onClick={() => {
                      setForm(emptyWorkspace);
                      setShowWorkspaceForm(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={createWorkspace}>
                    Save Workspace
                  </button>
                </div>
              </div>
            )}
          </Card>

          <Card title="Created Workspaces">

            {message && (
              <div className="mb-4 rounded-lg border border-blue-700 bg-blue-900/20 p-3 text-sm text-blue-200">
                {message}
              </div>
            )}

            {visibleWorkspaces.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300 border-collapse">
                  <thead className="bg-gray-800/60 text-xs uppercase tracking-wider text-gray-400 border-b border-gray-700">
                    <tr>
                      <th className="px-6 py-4">Workspace</th>
                      <th className="px-6 py-4">Cluster Name</th>
                      <th className="px-6 py-4">Namespace</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Last Synced</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 bg-gray-900/10">
                    {tableRows.map((row, idx) => {
                      const isSelected = row.cluster && activeClusterName === row.cluster.clusterName;

                      return (
                        <tr key={idx} className={`hover:bg-gray-800/20 transition-colors ${isSelected ? 'bg-blue-600/5' : ''}`}>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-white block">{row.workspaceName}</span>
                            <span className="text-xs text-gray-500 block">{row.orgName} | {row.env}</span>
                          </td>
                          <td className="px-6 py-4 font-medium">
                            {row.cluster ? (row.cluster.clusterDisplayName || row.cluster.clusterName) : (
                              <span className="text-gray-500 italic">Not connected</span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-gray-400">
                            {row.cluster ? 'default' : <span className="text-gray-600">N/A</span>}
                          </td>
                          <td className="px-6 py-4">
                            {row.cluster ? (
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                                  row.cluster.connectionStatus === 'Connected' || row.cluster.connectionStatus === 'Agent Connected'
                                    ? 'bg-green-950/40 text-green-400 border-green-800/60'
                                    : row.cluster.connectionStatus === 'Connection Failed'
                                    ? 'bg-red-950/40 text-red-400 border-red-800/60'
                                    : 'bg-yellow-950/40 text-yellow-400 border-yellow-800/60'
                                }`}
                              >
                                {row.cluster.connectionStatus}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border bg-gray-800/30 text-gray-400 border-gray-700/60">
                                Not Connected
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-400 font-mono">
                            {row.cluster ? displayDate(row.cluster.lastSyncTime || row.cluster.lastValidationTime) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {row.cluster ? (
                                <>
                                  <button
                                    onClick={() => {
                                      if (isSelected) {
                                        syncCluster(row.workspaceId, row.cluster!.clusterName);
                                      } else {
                                        selectCluster(workspaces.find(w => w.id === row.workspaceId)!, row.cluster!);
                                      }
                                    }}
                                    disabled={isSyncing === row.cluster!.clusterName}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all ${
                                      isSelected
                                        ? 'bg-blue-600/20 border-blue-600 text-blue-300 hover:bg-blue-600/30'
                                        : 'bg-gray-800/40 border-gray-750 text-gray-300 hover:bg-gray-850'
                                    }`}
                                  >
                                    {isSelected ? (isSyncing === row.cluster!.clusterName ? 'Syncing...' : 'Sync') : 'Select'}
                                  </button>
                                  <button
                                    onClick={() => editCluster(row.workspaceId, row.cluster!)}
                                    className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-gray-700 transition-all"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => removeCluster(row.workspaceId, row.cluster!.clusterName)}
                                    className="rounded-lg bg-red-950/20 border border-red-900/40 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-950/40 transition-all"
                                  >
                                    Remove
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => openClusterForm(row.workspaceId)}
                                    className="rounded-lg bg-blue-600/15 border border-blue-600/30 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-600/25 transition-all"
                                  >
                                    Connect Cluster
                                  </button>
                                  <button
                                    onClick={() => removeWorkspace(row.workspaceId)}
                                    className="rounded-lg bg-red-950/20 border border-red-900/40 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-950/40 transition-all"
                                  >
                                    Remove Workspace
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-700 p-8 text-center">
                <p className="text-sm text-gray-400">No workspace created yet.</p>
              </div>
            )}
          </Card>
      </>
    </div>
  );
};
