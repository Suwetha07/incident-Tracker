import React from 'react';

interface KPICardProps {
  title: string;
  value: number | string;
  change?: number;
  icon?: React.ReactNode;
  color?: 'green' | 'red' | 'yellow' | 'blue' | 'purple';
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  change,
  icon,
  color = 'blue',
}) => {
  const colorClasses = {
    green: 'bg-emerald-500/10 border-emerald-400/25',
    red: 'bg-rose-500/10 border-rose-400/25',
    yellow: 'bg-[#ff916d]/10 border-[#ff916d]/25',
    blue: 'bg-white/[0.06] border-white/10',
    purple: 'bg-fuchsia-500/10 border-fuchsia-400/25',
  };

  const textColorClasses = {
    green: 'text-green-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
  };

  return (
    <div
      className={`rounded-2xl border p-6 shadow-[0_24px_60px_rgba(0,0,0,0.3)] backdrop-blur ${colorClasses[color]}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold text-white">
            {value}
          </p>
          {change !== undefined && (
            <p
              className={`mt-1 text-sm font-semibold ${
                change >= 0
                  ? 'text-red-400'
                  : 'text-green-400'
              }`}
            >
              {change >= 0 ? '+' : ''}{change}%
            </p>
          )}
        </div>
        {icon && (
          <div className={`text-3xl ${textColorClasses[color]}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

interface AlertBadgeProps {
  severity: 'critical' | 'warning' | 'info';
  children: string;
}

export const AlertBadge: React.FC<AlertBadgeProps> = ({
  severity,
  children,
}) => {
  const severityClasses = {
    critical:
      'bg-red-900/30 text-red-300 border border-red-700',
    warning:
      'bg-yellow-900/30 text-yellow-300 border border-yellow-700',
    info: 'bg-blue-900/30 text-blue-300 border border-blue-700',
  };

  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${severityClasses[severity]}`}
    >
      {children}
    </span>
  );
};

interface StatusBadgeProps {
  status:
    | 'healthy'
    | 'degraded'
    | 'critical'
    | 'open'
    | 'investigating'
    | 'resolved'
    | 'closed'
    | 'active'
    | 'inactive';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
}) => {
  const statusClasses = {
    healthy: 'bg-green-900/30 text-green-300',
    degraded: 'bg-yellow-900/30 text-yellow-300',
    critical: 'bg-red-900/30 text-red-300',
    open: 'bg-red-900/30 text-red-300',
    investigating: 'bg-blue-900/30 text-blue-300',
    resolved: 'bg-green-900/30 text-green-300',
    closed: 'bg-gray-900/30 text-gray-300',
    active: 'bg-green-900/30 text-green-300',
    inactive: 'bg-gray-900/30 text-gray-300',
  };

  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClasses[status]}`}
    >
      {status}
    </span>
  );
};

interface CardProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  children,
  actions,
  className = '',
}) => {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.32)] backdrop-blur ${className}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          {title}
        </h3>
        {actions && <div>{actions}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
};

interface TableProps {
  columns: {
    key: string;
    label: string;
    render?: (value: unknown) => React.ReactNode;
  }[];
  data: Record<string, unknown>[];
  onRowClick?: (row: Record<string, unknown>) => void;
  loading?: boolean;
}

export const Table: React.FC<TableProps> = ({
  columns,
  data,
  onRowClick,
  loading,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-400"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={idx}
              onClick={() =>
                onRowClick?.(row)
              }
              className={`border-b border-white/10 ${
                onRowClick
                  ? 'cursor-pointer hover:bg-white/[0.06]'
                  : ''
              }`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className="px-4 py-3 text-sm text-gray-300"
                >
                  {col.render
                    ? col.render(row[col.key])
                    : String(row[col.key] || '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center py-8">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  message: string;
}> = ({ title, message }) => (
  <div className="flex flex-col items-center justify-center py-12">
    <h3 className="text-lg font-semibold text-gray-300">
      {title}
    </h3>
    <p className="mt-2 text-sm text-gray-400">{message}</p>
  </div>
);
