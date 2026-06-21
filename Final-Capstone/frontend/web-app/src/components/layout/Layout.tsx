import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const menuItems = [
  { id: 'org-setup', label: 'Workspace Setup', icon: 'WS', path: '/org-setup' },
  { id: 'cluster-connect', label: 'Cluster Connect', icon: 'CC', path: '/cluster-connect' },
  { id: 'cluster-health', label: 'Cluster Health', icon: 'HL', path: '/cluster-health' },
  { id: 'services', label: 'Services', icon: 'SV', path: '/services' },
  { id: 'dependency-graph', label: 'Dependency Graph', icon: 'DG', path: '/dependency-graph' },
  { id: 'timeline', label: 'Incident Timeline', icon: 'TL', path: '/timeline' },
  { id: 'deployments', label: 'Deployment Analysis', icon: 'DP', path: '/deployments' },
  { id: 'rca', label: 'Root Cause Analysis', icon: 'RA', path: '/rca' },
  { id: 'dashboard', label: 'Dashboard', icon: 'DB', path: '/dashboard' },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      className={`fixed left-0 top-0 z-50 h-full border-r border-white/10 bg-[#090313]/95 shadow-[20px_0_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex h-16 items-center justify-between px-4">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <span className="sample-gradient flex h-9 w-9 items-center justify-center rounded-2xl text-sm font-extrabold text-white shadow-[0_0_26px_rgba(255,0,184,0.24)]">
              KI
            </span>
            <h1 className="text-lg font-extrabold text-white">Kubernetes Incident Management</h1>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="rounded p-1 text-white/70 hover:bg-white/10"
        >
          {isCollapsed ? '>' : '<'}
        </button>
      </div>

      <nav className="mt-6 space-y-1 overflow-y-auto px-2 pb-6">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.id}
              to={item.path}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border border-[#ff916d]/30 bg-[linear-gradient(135deg,rgba(255,0,184,0.22),rgba(255,145,109,0.18))] text-white'
                  : 'border border-transparent text-white/70 hover:bg-white/10 hover:text-white'
              }`}
              title={isCollapsed ? item.label : ''}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/10 text-[11px] font-semibold">
                {item.icon}
              </span>
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

interface TopNavProps {
  onSearch?: (query: string) => void;
}

export const TopNav: React.FC<TopNavProps> = () => {
  const navigate = useNavigate();
  const rawUser = localStorage.getItem('user');
  const [user, setUser] = useState(rawUser ? JSON.parse(rawUser) : null);

  useEffect(() => {
    const refreshUser = () => {
      const nextRawUser = localStorage.getItem('user');
      setUser(nextRawUser ? JSON.parse(nextRawUser) : null);
    };

    window.addEventListener('user-updated', refreshUser);
    return () => window.removeEventListener('user-updated', refreshUser);
  }, []);

  return (
    <div className="fixed left-64 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-[#090313]/92 px-6 backdrop-blur-xl">
      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <button
          className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/10"
          onClick={() => navigate('/profile')}
        >
          <div className="sample-gradient flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white">
            {String(user?.name || user?.username || 'U').charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-white">{user?.name || user?.username || 'User'}</span>
        </button>
      </div>
    </div>
  );
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="sample-template-bg flex h-screen">
      <Sidebar />
      <div className="ml-64 flex flex-1 flex-col">
        <TopNav />
        <main className="mt-16 flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
};
