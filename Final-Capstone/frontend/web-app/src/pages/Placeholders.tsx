import React from 'react';
import { Card, EmptyState } from '../components/shared/Cards';
import { getSelectedClusterContext } from '../utils/clusterContext';

export const Services: React.FC = () => {
  const { cluster } = getSelectedClusterContext();

  return (
    <Card title="Services Management">
      <EmptyState
        title="No Services Discovered"
        message={`${cluster?.clusterName || 'Selected cluster'} has no service catalog data yet. Start dependency discovery to populate this page.`}
      />
    </Card>
  );
};

export const Notifications: React.FC = () => (
  <Card title="Notifications">
    <div className="space-y-4">
      {[
        { title: 'New incident detected', time: '5 minutes ago' },
        { title: 'Deployment completed successfully', time: '1 hour ago' },
        { title: 'Alert threshold exceeded', time: '3 hours ago' },
      ].map((notif) => (
        <div key={notif.title} className="cursor-pointer rounded-lg border border-gray-700 bg-gray-800/30 p-4 hover:bg-gray-800/50">
          <p className="font-medium text-white">{notif.title}</p>
          <p className="mt-1 text-xs text-gray-400">{notif.time}</p>
        </div>
      ))}
    </div>
  </Card>
);

export const Settings: React.FC = () => (
  <div className="space-y-6">
    <Card title="Notification Channels">
      <div className="grid gap-3 md:grid-cols-4">
        {['Email', 'Slack', 'Microsoft Teams', 'Webhook'].map((channel) => (
          <label key={channel} className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/30 p-4 text-sm text-gray-300">
            <input type="checkbox" defaultChecked={channel !== 'Webhook'} />
            {channel}
          </label>
        ))}
      </div>
    </Card>

    <Card title="AI Settings">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm text-gray-300">
          AI Model
          <select className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white">
            <option>RCA Assistant v1</option>
            <option>Incident Summarizer</option>
            <option>Remediation Planner</option>
          </select>
        </label>
        <label className="text-sm text-gray-300">
          Confidence Threshold
          <input type="number" min="0" max="100" defaultValue="80" className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white" />
        </label>
        <label className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/30 p-4 text-sm text-gray-300">
          <input type="checkbox" defaultChecked />
          RCA Generation
        </label>
      </div>
    </Card>

    <Card title="Incident Settings">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm text-gray-300">
          Severity Rules
          <select className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white">
            <option>CPU, memory, error rate</option>
            <option>Customer impact</option>
            <option>Service criticality</option>
          </select>
        </label>
        <label className="text-sm text-gray-300">
          Alert Rules
          <select className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white">
            <option>Prometheus thresholds</option>
            <option>Loki log patterns</option>
            <option>Deployment health checks</option>
          </select>
        </label>
        <label className="text-sm text-gray-300">
          Escalation Policies
          <select className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white">
            <option>SRE on-call after 10 minutes</option>
            <option>Admin after 20 minutes</option>
            <option>Super Admin for critical incidents</option>
          </select>
        </label>
      </div>
    </Card>

    <Card title="User Preferences">
      <div className="grid gap-3 md:grid-cols-4">
        <label className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/30 p-4 text-sm text-gray-300">
          <input type="checkbox" defaultChecked />
          Dark Mode
        </label>
        <label className="text-sm text-gray-300">
          Language
          <select className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white">
            <option>English</option>
            <option>Hindi</option>
            <option>Tamil</option>
          </select>
        </label>
        <label className="text-sm text-gray-300">
          Time Zone
          <select className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white">
            <option>Asia/Kolkata</option>
            <option>UTC</option>
          </select>
        </label>
        <label className="text-sm text-gray-300">
          Notifications
          <select className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white">
            <option>Critical and warning</option>
            <option>Critical only</option>
            <option>All events</option>
          </select>
        </label>
      </div>
    </Card>
  </div>
);

export const IncidentTimeline: React.FC = () => {
  const { cluster } = getSelectedClusterContext();

  return (
    <Card title="Incident Timeline Analysis">
      <EmptyState
        title="No Incident Timeline"
        message={`${cluster?.clusterName || 'Selected cluster'} has no incident events to correlate yet.`}
      />
    </Card>
  );
};
