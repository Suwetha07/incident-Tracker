import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, AlertBadge, StatusBadge, LoadingSpinner } from '../components/shared/Cards';
import {
  useIncident,
  useRCA,
  useRecommendedActions,
  useIncidentTimeline,
} from '../hooks/useApi';
import { useDashboardStore } from '../store';

export const IncidentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: incident, isLoading: incidentLoading } = useIncident(
    id || ''
  );
  const { data: rca, isLoading: rcaLoading } = useRCA(id || '');
  const { data: actions, isLoading: actionsLoading } =
    useRecommendedActions(id || '');
  const { data: timeline, isLoading: timelineLoading } =
    useIncidentTimeline(id || '');
  const { setSelectedIncident } = useDashboardStore();

  useEffect(() => {
    if (incident) {
      setSelectedIncident(incident);
    }
  }, [incident, setSelectedIncident]);

  if (
    incidentLoading ||
    rcaLoading ||
    actionsLoading ||
    timelineLoading
  ) {
    return <LoadingSpinner />;
  }

  if (!incident) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-6">
        <p className="text-center text-gray-400">
          Incident not found
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">
                {incident.title}
              </h1>
              <AlertBadge severity={incident.severity}>
                {incident.severity.toUpperCase()}
              </AlertBadge>
              <StatusBadge status={incident.status} />
            </div>
            <p className="mt-2 text-gray-400">
              Service: <span className="font-semibold text-white">{incident.service}</span>
            </p>
            <p className="text-sm text-gray-500">
              ID: {incident.id}
            </p>
          </div>
          <div className="text-right">
            <button className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700">
              Edit Incident
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Root Cause Analysis */}
        <div className="lg:col-span-2">
          <Card title="Root Cause Analysis">
            {rca ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-purple-900/20 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white">
                      {rca.rootCause}
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-gray-700">
                        <div
                          className="h-full rounded-full bg-purple-500"
                          style={{
                            width: `${rca.confidence * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-purple-300">
                        {Math.round(rca.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-gray-300">
                    {rca.explanation}
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-white">
                    Evidence
                  </h4>
                  <ul className="mt-2 space-y-2">
                    {rca.evidenceRefs?.map((ref, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm text-gray-300"
                      >
                        <span className="text-purple-400">•</span>
                        <span>{ref}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="text-xs text-gray-500">
                  Analyzed by: {rca.aiModel}
                </div>
              </div>
            ) : (
              <p className="text-gray-400">
                RCA pending...
              </p>
            )}
          </Card>
        </div>

        {/* Impact Summary */}
        <Card title="Impact Summary">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-400">
                Blast Radius
              </p>
              <p className="mt-1 text-2xl font-bold text-red-400">
                {incident.blastRadius?.length || 0} services
              </p>
              {incident.blastRadius && (
                <div className="mt-2 space-y-1">
                  {incident.blastRadius.map((service) => (
                    <p
                      key={service}
                      className="text-xs text-gray-400"
                    >
                      • {service}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-gray-700 pt-4">
              <p className="text-sm font-medium text-gray-400">
                Duration
              </p>
              <p className="mt-1 text-xl font-bold text-white">
                {incident.resolvedAt
                  ? Math.round(
                      (new Date(
                        incident.resolvedAt
                      ).getTime() -
                        new Date(
                          incident.createdAt
                        ).getTime()) /
                        60000
                    )
                  : 'Ongoing'}{' '}
                minutes
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recommended Actions */}
      <Card title="Recommended Actions">
        {actions && actions.length > 0 ? (
          <div className="space-y-3">
            {actions.map((action) => (
              <div
                key={action.id}
                className="flex items-start justify-between rounded-lg border border-gray-700 bg-gray-800/30 p-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-white">
                      {action.title}
                    </h4>
                    <span className="text-xs font-semibold uppercase">
                      {action.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-400">
                    {action.description}
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    Estimated Impact: {action.estimatedImpact}
                  </p>
                </div>
                <button className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
                  Execute
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">
            No recommendations available
          </p>
        )}
      </Card>

      {/* Timeline */}
      <Card title="Incident Timeline">
        {timeline && timeline.length > 0 ? (
          <div className="relative space-y-4 pl-6">
            {timeline.map((event, idx) => (
              <div key={idx} className="relative">
                <div className="absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-gray-700 bg-blue-500" />
                {idx < timeline.length - 1 && (
                  <div className="absolute -left-5 top-4 h-12 w-0.5 bg-gray-700" />
                )}
                <div className="pt-0">
                  <p className="text-xs font-semibold text-gray-400">
                    {new Date(
                      event.timestamp
                    ).toLocaleTimeString()}
                  </p>
                  <p className="mt-1 font-medium text-white">
                    {event.event}
                  </p>
                  <p className="text-sm text-gray-500">
                    {event.service}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">
            No timeline events available
          </p>
        )}
      </Card>
    </div>
  );
};
