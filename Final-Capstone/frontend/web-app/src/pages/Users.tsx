import React, { useState } from 'react';
import { Card, Table, LoadingSpinner } from '../components/shared/Cards';
import { useUsers } from '../hooks/useApi';

const roles = [
  { role: 'Super Admin', permissions: 'Full access' },
  { role: 'Admin', permissions: 'Manage users' },
  { role: 'DevOps Engineer', permissions: 'Manage clusters' },
  { role: 'SRE', permissions: 'RCA and incidents' },
  { role: 'Developer', permissions: 'View incidents' },
  { role: 'Viewer', permissions: 'Read-only' },
];

export const Users: React.FC = () => {
  const { data: users, isLoading } = useUsers();
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  const columns = [
    {
      key: 'username',
      label: 'Username',
      render: (value: unknown) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
            {String(value).charAt(0).toUpperCase()}
          </div>
          <p className="font-medium text-white">{String(value)}</p>
        </div>
      ),
    },
    { key: 'email', label: 'Email' },
    {
      key: 'role',
      label: 'Role',
      render: (value: unknown) => {
        const roleColors: Record<string, string> = {
          super_admin: 'bg-red-900/30 text-red-300',
          admin: 'bg-orange-900/30 text-orange-300',
          devops_engineer: 'bg-blue-900/30 text-blue-300',
          sre: 'bg-purple-900/30 text-purple-300',
          developer: 'bg-green-900/30 text-green-300',
          viewer: 'bg-gray-900/30 text-gray-300',
        };
        const role = String(value || 'viewer');
        return (
          <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${roleColors[role] || roleColors.viewer}`}>
            {role.replace(/_/g, ' ')}
          </span>
        );
      },
    },
    {
      key: 'lastLogin',
      label: 'Last Login',
      render: (value: unknown) => (
        <p className="text-sm text-gray-400">
          {value ? new Date(String(value)).toLocaleDateString() : 'Never'}
        </p>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: unknown) => (
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
            String(value) === 'active' ? 'bg-green-900/30 text-green-300' : 'bg-gray-900/30 text-gray-300'
          }`}
        >
          {String(value || 'active')}
        </span>
      ),
    },
  ];

  const fallbackUsers = [
    { username: 'suwetha', email: 'suwetha@example.com', role: 'devops_engineer', lastLogin: new Date().toISOString(), status: 'active' },
    { username: 'john', email: 'john@example.com', role: 'sre', lastLogin: new Date().toISOString(), status: 'active' },
  ];

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <Card
        title="Users & Access Control"
        actions={
          <button
            onClick={() => setShowAddUserModal(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Add User
          </button>
        }
      >
        <Table columns={columns} data={(users && users.length ? users : fallbackUsers) as Record<string, unknown>[]} />
      </Card>

      <Card title="Roles & Permissions">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-400">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-400">Permissions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.role} className="border-b border-gray-700">
                  <td className="px-4 py-3 font-medium text-white">{role.role}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{role.permissions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card title="Add New User" className="w-full max-w-md">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-300">
                Username
                <input className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none" placeholder="john.doe" />
              </label>
              <label className="block text-sm font-medium text-gray-300">
                Email
                <input type="email" className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none" placeholder="john@example.com" />
              </label>
              <label className="block text-sm font-medium text-gray-300">
                Role
                <select className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none">
                  {roles.map((role) => (
                    <option key={role.role}>{role.role}</option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2 pt-4">
                <button onClick={() => setShowAddUserModal(false)} className="flex-1 rounded-lg border border-gray-700 px-4 py-2 font-semibold text-white hover:bg-gray-800">
                  Cancel
                </button>
                <button onClick={() => setShowAddUserModal(false)} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">
                  Add User
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
