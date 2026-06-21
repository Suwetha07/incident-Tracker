import React from 'react';
import { Card, EmptyState, LoadingSpinner } from '../components/shared/Cards';
import { useDependencyGraph } from '../hooks/useApi';
import { getSelectedClusterContext } from '../utils/clusterContext';

export const DependencyGraph: React.FC = () => {
  const { data, isLoading } = useDependencyGraph();
  const { cluster } = getSelectedClusterContext();
  const hasGraphData = Boolean(data);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <Card title="Service Dependency Graph">
        {hasGraphData ? (
          <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-6">
            <pre className="overflow-auto text-xs text-gray-300">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        ) : (
          <EmptyState
            title="No Dependency Graph"
            message={`${cluster?.clusterName || 'Selected cluster'} has no discovered service dependencies yet.`}
          />
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card title="Healthy Services">
          <p className="text-3xl font-bold text-white">0</p>
        </Card>
        <Card title="Degraded Services">
          <p className="text-3xl font-bold text-white">0</p>
        </Card>
        <Card title="Critical Services">
          <p className="text-3xl font-bold text-white">0</p>
        </Card>
        <Card title="Dependencies">
          <p className="text-3xl font-bold text-white">0</p>
        </Card>
      </div>

      <Card title="Service Details">
        <EmptyState
          title="No Services Discovered"
          message="Service details will appear after the dependency backend scans the selected cluster."
        />
      </Card>

      <Card title="Blast Radius Analysis">
        <EmptyState
          title="No Blast Radius Yet"
          message="Blast radius requires discovered services and incident impact data."
        />
      </Card>
    </div>
  );
};
