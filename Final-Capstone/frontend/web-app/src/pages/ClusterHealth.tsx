import React, { useState, useMemo } from 'react';
import { Card, EmptyState, LoadingSpinner } from '../components/shared/Cards';
import { useClusterHealth } from '../hooks/useApi';
import {
  getSelectedClusterContext,
  normalizeUrl,
} from '../utils/clusterContext';

const HealthBar: React.FC<{ value: number; color: string }> = ({ value, color }) => (
  <div className="mt-3 h-2 rounded-full bg-gray-700">
    <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
  </div>
);

export const ClusterHealth: React.FC = () => {
  const { data: health, isLoading, isError } = useClusterHealth();
  const { workspace, cluster } = getSelectedClusterContext();

  const [selectedNamespace, setSelectedNamespace] = useState('all');

  const namespaces = useMemo(() => {
    const list = health?.pods ? Array.from(new Set(health.pods.map((p) => p.namespace))) : [];
    if (!list.includes('default')) {
      list.push('default');
    }
    return list.sort();
  }, [health?.pods]);

  const filteredPods = useMemo(() => {
    if (!health?.pods) return [];
    if (selectedNamespace === 'all') return health.pods;
    return health.pods.filter((p) => p.namespace === selectedNamespace);
  }, [health?.pods, selectedNamespace]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const isClusterOffline = isError || !health;

  const cpuUsage = isClusterOffline ? 0 : (health?.cpuUsage ?? 0);
  const memoryUsage = isClusterOffline ? 0 : (health?.memoryUsage ?? 0);
  const nodeAvailability = isClusterOffline ? 0 : (health?.nodeAvailability ?? 0);
  const podAvailability = isClusterOffline ? 0 : (health?.podAvailability ?? 0);
  const networkHealth = isClusterOffline ? 0 : (health?.networkHealth ?? 0);

  return (
    <div className="space-y-6">
      <Card title="Selected Cluster">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <p className="text-2xl font-bold text-white">{cluster?.clusterName || 'No cluster selected'}</p>
            <p className="mt-1 text-sm text-gray-400">
              {workspace?.orgName || 'Organization not set'} | {workspace?.workspace || 'Workspace not set'}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {cluster?.provider || 'Provider not set'} | {cluster?.region || 'Region not set'} | {cluster?.environment || 'Environment not set'}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 text-sm text-gray-400 md:grid-cols-2">
          <p>API: {normalizeUrl(cluster?.apiUrl) || 'Not configured'}</p>
          <p>Auth: {cluster?.authMethod === 'Service Principal' ? 'Kubeconfig / Entra ID' : cluster?.authMethod || 'Not configured'}</p>
          <p className="md:col-span-2">Prometheus: {cluster?.prometheus || 'Not configured'}</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card title="CPU Usage">
          <p className="text-3xl font-bold text-white">{isClusterOffline ? 'N/A' : `${cpuUsage}%`}</p>
          <HealthBar value={cpuUsage} color="bg-blue-500" />
        </Card>
        <Card title="Memory Usage">
          <p className="text-3xl font-bold text-white">{isClusterOffline ? 'N/A' : `${memoryUsage}%`}</p>
          <HealthBar value={memoryUsage} color="bg-purple-500" />
        </Card>
        <Card title="Node Availability">
          <p className="text-3xl font-bold text-white">{isClusterOffline ? 'N/A' : `${nodeAvailability}%`}</p>
          <HealthBar value={nodeAvailability} color="bg-green-500" />
        </Card>
        <Card title="Pod Availability">
          <p className="text-3xl font-bold text-white">{isClusterOffline ? 'N/A' : `${podAvailability}%`}</p>
          <HealthBar value={podAvailability} color="bg-yellow-500" />
        </Card>
        <Card title="Network Health">
          <p className="text-3xl font-bold text-white">{isClusterOffline ? 'N/A' : `${networkHealth}%`}</p>
          <HealthBar value={networkHealth} color="bg-red-500" />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card title="Node Health Status">
          {!isClusterOffline && health?.nodes && health.nodes.length > 0 ? (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-gray-800/50 text-xs uppercase tracking-wider text-gray-400 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Node Name</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Kubelet Version</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {health.nodes.map((node) => (
                    <tr key={node.name} className="hover:bg-gray-800/30">
                      <td className="px-4 py-3 font-medium text-white">{node.name}</td>
                      <td className="px-4 py-3 text-gray-400">{node.roles}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            node.status === 'Ready'
                              ? 'bg-green-900/30 text-green-400 border border-green-850'
                              : 'bg-red-900/30 text-red-400 border border-red-850'
                          }`}
                        >
                          {node.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{node.kubeletVersion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title={isClusterOffline ? 'Cluster Not Connected' : (cluster?.authMethod === 'Kubeconfig Upload' ? 'Connecting to Cluster...' : 'Cluster Not Connected')}
              message={isClusterOffline ? 'The Kubernetes API server is unreachable. If you deleted the resource group in Azure, this cluster is offline.' : (cluster?.authMethod === 'Kubeconfig Upload' ? 'Retrieving nodes from the Kubernetes API server...' : 'Upload a Kubeconfig file to validate and query the cluster status.')}
            />
          )}
        </Card>

      </div>

      <Card title="Pod Status Distribution">
        {!isClusterOffline && health?.pods && health.pods.length > 0 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
              <div className="flex flex-wrap gap-4">
                <div className="rounded-lg bg-gray-800/40 px-4 py-2 border border-gray-800">
                  <span className="text-gray-400">Total Pods:</span>{' '}
                  <span className="font-bold text-white">{filteredPods.length}</span>
                </div>
                <div className="rounded-lg bg-green-900/20 px-4 py-2 border border-green-800">
                  <span className="text-green-400">Running/Succeeded:</span>{' '}
                  <span className="font-bold text-green-300">
                    {filteredPods.filter((p) => p.status === 'Running' || p.status === 'Succeeded').length}
                  </span>
                </div>
                <div className="rounded-lg bg-yellow-900/20 px-4 py-2 border border-yellow-800">
                  <span className="text-yellow-400">Pending:</span>{' '}
                  <span className="font-bold text-yellow-300">
                    {filteredPods.filter((p) => p.status === 'Pending').length}
                  </span>
                </div>
                <div className="rounded-lg bg-red-900/20 px-4 py-2 border border-red-800">
                  <span className="text-red-400">Failed/Unknown:</span>{' '}
                  <span className="font-bold text-red-300">
                    {filteredPods.filter((p) => p.status !== 'Running' && p.status !== 'Succeeded' && p.status !== 'Pending').length}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-450">Namespace:</span>
                <select
                  value={selectedNamespace}
                  onChange={(e) => setSelectedNamespace(e.target.value)}
                  className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none transition-colors"
                >
                  <option value="all">All Namespaces</option>
                  {namespaces.map((ns) => (
                    <option key={ns} value={ns}>
                      {ns}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-gray-800/50 text-xs uppercase tracking-wider text-gray-400 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Namespace</th>
                    <th className="px-4 py-3">Pod Name</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Node</th>
                    <th className="px-4 py-3">Restarts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredPods.map((pod) => (
                    <tr key={pod.name} className="hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{pod.namespace}</td>
                      <td className="px-4 py-3 font-medium text-white truncate max-w-md" title={pod.name}>{pod.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            pod.status === 'Running'
                              ? 'bg-green-900/30 text-green-400 border border-green-800'
                              : pod.status === 'Succeeded'
                              ? 'bg-blue-900/30 text-blue-400 border border-blue-800'
                              : pod.status === 'Pending'
                              ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-800'
                              : 'bg-red-900/30 text-red-400 border border-red-800'
                          }`}
                        >
                          {pod.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 truncate max-w-xs" title={pod.nodeName || 'N/A'}>{pod.nodeName || 'N/A'}</td>
                      <td className="px-4 py-3 text-gray-400">{pod.restartCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            title={isClusterOffline ? 'Cluster Not Connected' : (cluster?.authMethod === 'Kubeconfig Upload' ? 'Connecting to Cluster...' : 'Cluster Not Connected')}
            message={isClusterOffline ? 'The Kubernetes API server is unreachable. If you deleted the resource group in Azure, this cluster is offline.' : (cluster?.authMethod === 'Kubeconfig Upload' ? 'Retrieving pods from the Kubernetes API server...' : 'Upload a Kubeconfig file to validate and query the cluster status.')}
          />
        )}
      </Card>

    </div>
  );
};
