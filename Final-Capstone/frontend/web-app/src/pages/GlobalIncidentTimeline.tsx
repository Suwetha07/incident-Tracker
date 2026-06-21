import React from 'react';
import { Card, LoadingSpinner, EmptyState } from '../components/shared/Cards';
import { useIncidents } from '../hooks/useApi';
import { getSelectedClusterContext } from '../utils/clusterContext';

export const GlobalIncidentTimeline: React.FC = () => {
  const { data: incidents, isLoading, error } = useIncidents();
  const { cluster } = getSelectedClusterContext();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <Card title="Error"><div className="p-4 text-red-400">Failed to load incidents for timeline.</div></Card>;

  const hasIncidents = incidents && incidents.length > 0;

  return (
    <Card title="Global Incident Timeline">
      {!hasIncidents ? (
        <EmptyState
          title="No Incident Timeline"
          message={`${cluster?.clusterName || 'Selected cluster'} has no incident events to correlate yet.`}
        />
      ) : (
        <div className="relative border-l border-gray-700 ml-4 space-y-6">
          {incidents.map((incident: any) => (
            <div key={incident.id} className="relative pl-6">
              <span className={`absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-gray-900 ${
                incident.severity === 'critical' ? 'bg-red-500' :
                incident.severity === 'warning' ? 'bg-yellow-500' :
                'bg-blue-500'
              }`} />
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <h4 className="text-sm font-semibold text-white">{incident.title}</h4>
                <time className="text-xs text-gray-500">{new Date(incident.createdAt).toLocaleString()}</time>
              </div>
              <p className="mt-1 text-sm text-gray-400">{incident.description}</p>
              <div className="mt-2 text-xs font-medium text-gray-500">
                Service: <span className="text-blue-400">{incident.service}</span> | Status: <span className="text-yellow-400">{incident.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
