import React from 'react';
import { Card, LoadingSpinner, EmptyState } from '../components/shared/Cards';
import { useServices } from '../hooks/useApi';
import { getSelectedClusterContext } from '../utils/clusterContext';

export const Services: React.FC = () => {
  const { data: services, isLoading, error } = useServices();
  const { cluster } = getSelectedClusterContext();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <Card title="Error"><div className="p-4 text-red-400">Failed to load services.</div></Card>;

  const hasServices = services && services.length > 0;

  return (
    <Card title="Services Management">
      {!hasServices ? (
        <EmptyState
          title="No Services Discovered"
          message={`${cluster?.clusterName || 'Selected cluster'} has no service catalog data.`}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-gray-800/50 text-xs uppercase text-gray-400">
              <tr>
                <th className="px-4 py-3">Service Name</th>
                <th className="px-4 py-3">Namespace</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Replicas</th>
                <th className="px-4 py-3">CPU Usage</th>
                <th className="px-4 py-3">Memory Usage</th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc: any) => (
                <tr key={svc.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="px-4 py-3 font-medium text-white">{svc.name}</td>
                  <td className="px-4 py-3">{svc.namespace}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                      svc.status === 'healthy' ? 'bg-green-900/30 text-green-400' :
                      svc.status === 'degraded' ? 'bg-yellow-900/30 text-yellow-400' :
                      'bg-red-900/30 text-red-400'
                    }`}>
                      {svc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{svc.replicas}</td>
                  <td className="px-4 py-3">{svc.cpuUsage}%</td>
                  <td className="px-4 py-3">{svc.memoryUsage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
