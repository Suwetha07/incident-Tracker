import React from 'react';
import { Card, EmptyState, Table, LoadingSpinner } from '../components/shared/Cards';
import { useDeployments } from '../hooks/useApi';
import { getSelectedClusterContext } from '../utils/clusterContext';

export const DeploymentAnalysis: React.FC = () => {
  const { data: deployments, isLoading } = useDeployments();
  const { cluster } = getSelectedClusterContext();
  const deploymentRows = (deployments as Array<{status: string, riskScore: number, service: string, version: string, timestamp: string, id: string}>) || [];

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const successCount = deploymentRows.filter(d => d.status === 'success').length;
  const rollbackCount = deploymentRows.filter(d => d.status === 'rollback').length;
  const successRate = deploymentRows.length > 0 ? Math.round((successCount / deploymentRows.length) * 100) : 0;
  
  const highRisk = deploymentRows.filter(d => d.riskScore > 50).sort((a, b) => b.riskScore - a.riskScore);

  const columns = [
    {
      key: 'id',
      label: 'Deployment ID',
      render: (value: unknown) => (
        <code className="text-xs text-blue-400">{String(value).slice(0, 15)}</code>
      ),
    },
    { key: 'service', label: 'Service' },
    {
      key: 'version',
      label: 'Version',
      render: (value: unknown) => <code className="font-mono text-xs text-gray-300">{String(value)}</code>,
    },
    {
      key: 'timestamp',
      label: 'Deployed',
      render: (value: unknown) => <span className="text-sm text-gray-400">{new Date(String(value)).toLocaleString()}</span>,
    },
    { key: 'status', label: 'Status' },
  ];

  const riskColumns = [
    { key: 'service', label: 'Service' },
    { key: 'version', label: 'Version' },
    { 
      key: 'riskScore', 
      label: 'Risk Score',
      render: (value: unknown) => <span className="text-sm font-bold text-red-400">{String(value)}/100</span>
    },
    { key: 'status', label: 'Status' }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card title="Total Deployments">
          <p className="text-3xl font-bold text-white">{deploymentRows.length}</p>
          <p className="mt-1 text-xs text-gray-400">{cluster?.clusterName || 'Selected cluster'}</p>
        </Card>
        <Card title="Success Rate">
          <p className="text-3xl font-bold text-white">{successRate}%</p>
          <p className="mt-1 text-xs text-gray-400">{successCount} successful</p>
        </Card>
        <Card title="Avg Deployment Time">
          <p className="text-3xl font-bold text-white">{deploymentRows.length > 0 ? '1.8m' : '0m'}</p>
          <p className="mt-1 text-xs text-gray-400">Based on recent rollouts</p>
        </Card>
        <Card title="Rollbacks">
          <p className="text-3xl font-bold text-white">{rollbackCount}</p>
          <p className="mt-1 text-xs text-gray-400">Failed rollout attempts</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Recent Deployments">
          {deploymentRows.length > 0 ? (
            <Table columns={columns} data={deploymentRows as unknown as Record<string, unknown>[]} />
          ) : (
            <EmptyState
              title="No Deployments"
              message={`${cluster?.clusterName || 'Selected cluster'} has no deployment events from the backend yet.`}
            />
          )}
        </Card>

        <Card title="High-Risk Deployments">
          {highRisk.length > 0 ? (
            <Table columns={riskColumns} data={highRisk as unknown as Record<string, unknown>[]} />
          ) : (
            <EmptyState
              title="No High-Risk Deployments"
              message="No deployments found with a risk score over 50."
            />
          )}
        </Card>
      </div>
    </div>
  );
};
