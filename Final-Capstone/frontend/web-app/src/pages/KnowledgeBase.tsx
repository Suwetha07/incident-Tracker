import React, { useState } from 'react';
import { Card, Table, LoadingSpinner } from '../components/shared/Cards';
import { useKnowledgeBase } from '../hooks/useApi';

export const KnowledgeBase: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: articles, isLoading } = useKnowledgeBase(searchQuery);

  const columns = [
    {
      key: 'title',
      label: 'Title',
      render: (value: unknown) => (
        <p className="font-medium text-white cursor-pointer hover:text-blue-400">
          {String(value)}
        </p>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (value: unknown) => {
        const types: Record<string, string> = {
          runbook: '📋',
          rca_report: '🔍',
          incident_summary: '📝',
        };
        const emoji = types[String(value)] || '📄';
        return (
          <span className="text-sm capitalize">
            {emoji} {String(value).replace(/_/g, ' ')}
          </span>
        );
      },
    },
    {
      key: 'tags',
      label: 'Tags',
      render: (value: unknown) => {
        const tags = value as string[];
        return (
          <div className="flex gap-2 flex-wrap">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-blue-900/30 px-2 py-1 text-xs text-blue-300"
              >
                {tag}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (value: unknown) => (
        <p className="text-sm text-gray-400">
          {new Date(String(value)).toLocaleDateString()}
        </p>
      ),
    },
  ];

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <Card title="Knowledge Base - Searchable Runbooks & Reports">
        <div className="mb-6 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search runbooks, RCA reports, incident summaries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
            <button className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700">
              Search
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {['database', 'deployment', 'network', 'performance', 'security'].map(
              (tag) => (
                <button
                  key={tag}
                  className="rounded-full border border-gray-700 bg-gray-800 px-3 py-1 text-xs capitalize hover:bg-gray-700"
                >
                  {tag}
                </button>
              )
            )}
          </div>
        </div>

        {/* Articles Table */}
        <Table columns={columns} data={articles || []} />
      </Card>

      {/* Quick Links */}
      <Card title="Popular Resources">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            {
              title: 'Database Connection Pool Management',
              views: 1240,
              rating: 4.8,
            },
            {
              title: 'Kubernetes Resource Limits Best Practices',
              views: 987,
              rating: 4.6,
            },
            {
              title: 'Incident Response Runbook',
              views: 654,
              rating: 4.9,
            },
            {
              title: 'Network Troubleshooting Guide',
              views: 432,
              rating: 4.5,
            },
          ].map((resource) => (
            <div
              key={resource.title}
              className="rounded-lg border border-gray-700 bg-gray-800/30 p-4 cursor-pointer hover:bg-gray-800/50"
            >
              <h4 className="font-medium text-white">
                {resource.title}
              </h4>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                <span>{resource.views} views</span>
                <span>⭐ {resource.rating}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
