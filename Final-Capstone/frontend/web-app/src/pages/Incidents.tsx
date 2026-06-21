import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, AlertBadge, StatusBadge, Table, LoadingSpinner, EmptyState } from '../components/shared/Cards';
import { useIncidents } from '../hooks/useApi';
import { getSelectedClusterContext } from '../utils/clusterContext';

export const Incidents: React.FC = () => {
  const navigate = useNavigate();
  const { data: incidents, isLoading } = useIncidents();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { cluster } = getSelectedClusterContext();

  const filteredIncidents = useMemo(() => {
    if (!incidents) return [];

    return incidents.filter((incident) => {
      const matchStatus =
        statusFilter === 'all' || incident.status === statusFilter;
      const matchSeverity =
        severityFilter === 'all' ||
        incident.severity === severityFilter;
      const matchSearch =
        incident.title
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        incident.service
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      return matchStatus && matchSeverity && matchSearch;
    });
  }, [incidents, statusFilter, severityFilter, searchQuery]);

  const columns = [
    {
      key: 'id',
      label: 'Incident ID',
      render: (value: unknown) => (
        <code className="text-xs text-blue-400">
          {String(value).slice(0, 8)}...
        </code>
      ),
    },
    {
      key: 'title',
      label: 'Title',
      render: (value: unknown) => (
        <p className="font-medium text-white">{String(value)}</p>
      ),
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (value: unknown) => (
        <AlertBadge severity={value as 'critical' | 'warning' | 'info'}>
          {String(value).toUpperCase()}
        </AlertBadge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: unknown) => (
        <StatusBadge
          status={value as 'open' | 'investigating' | 'resolved' | 'closed'}
        />
      ),
    },
    {
      key: 'service',
      label: 'Service',
    },
    {
      key: 'aiConfidence',
      label: 'AI Confidence',
      render: (value: unknown) => (
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 rounded-full bg-gray-700">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{
                width: `${Number(value)}%`,
              }}
            />
          </div>
          <span className="text-xs text-gray-400">
            {Number(value)}%
          </span>
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (value: unknown) => (
        <p className="text-sm text-gray-400">
          {new Date(String(value)).toLocaleString()}
        </p>
      ),
    },
  ];

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card title="Incident Management">
        <div className="mb-6 flex flex-wrap gap-4">
          <div className="flex-1 min-w-64">
            <input
              type="text"
              placeholder="Search by title or service..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-gray-700 bg-gray-800 px-3 py-2 text-white"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded border border-gray-700 bg-gray-800 px-3 py-2 text-white"
          >
            <option value="all">All Severity</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>

        {/* Incidents Table */}
        <Table
          columns={columns}
          data={filteredIncidents as unknown as Record<string, unknown>[]}
          onRowClick={(row) =>
            navigate(`/incident-details/${row.id}`)
          }
        />

        {filteredIncidents.length === 0 ? (
          <EmptyState
            title="No Cluster Incidents"
            message={`${cluster?.clusterName || 'Selected cluster'} has no incidents from the backend yet.`}
          />
        ) : (
          <p className="mt-4 text-sm text-gray-400">
            Showing {filteredIncidents.length} of {incidents?.length || 0} incidents
          </p>
        )}
      </Card>
    </div>
  );
};
