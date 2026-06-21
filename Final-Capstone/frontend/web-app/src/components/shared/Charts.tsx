import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ChartData } from '../../types';

interface LineChartProps {
  data: ChartData[];
  dataKey: string;
  title?: string;
  height?: number;
  color?: string;
}

export const SimpleLineChart: React.FC<
  LineChartProps
> = ({
  data,
  dataKey,
  title,
  height = 300,
  color = '#3b82f6',
}) => {
  return (
    <div>
      {title && (
        <h3 className="mb-4 text-lg font-semibold text-white">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#374151"
          />
          <XAxis stroke="#9ca3af" dataKey="timestamp" />
          <YAxis stroke="#9ca3af" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
            }}
            labelStyle={{ color: '#f3f4f6' }}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

interface AreaChartProps {
  data: ChartData[];
  dataKey: string;
  title?: string;
  height?: number;
  color?: string;
}

export const SimpleAreaChart: React.FC<
  AreaChartProps
> = ({
  data,
  dataKey,
  title,
  height = 300,
  color = '#3b82f6',
}) => {
  return (
    <div>
      {title && (
        <h3 className="mb-4 text-lg font-semibold text-white">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            <linearGradient
              id="colorGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="5%"
                stopColor={color}
                stopOpacity={0.8}
              />
              <stop
                offset="95%"
                stopColor={color}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#374151"
          />
          <XAxis stroke="#9ca3af" dataKey="timestamp" />
          <YAxis stroke="#9ca3af" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
            }}
            labelStyle={{ color: '#f3f4f6' }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fillOpacity={1}
            fill="url(#colorGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

interface BarChartProps {
  data: ChartData[];
  dataKey: string;
  title?: string;
  height?: number;
  color?: string;
}

export const SimpleBarChart: React.FC<
  BarChartProps
> = ({
  data,
  dataKey,
  title,
  height = 300,
  color = '#3b82f6',
}) => {
  return (
    <div>
      {title && (
        <h3 className="mb-4 text-lg font-semibold text-white">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#374151"
          />
          <XAxis stroke="#9ca3af" dataKey="timestamp" />
          <YAxis stroke="#9ca3af" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
            }}
            labelStyle={{ color: '#f3f4f6' }}
          />
          <Bar dataKey={dataKey} fill={color} radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

interface SimplePieChartProps {
  data: { name: string; value: number }[];
  title?: string;
  height?: number;
}

export const SimplePieChart: React.FC<SimplePieChartProps> = ({
  data,
  title,
  height = 300,
}) => {
  const COLORS = [
    '#ef4444',
    '#f59e0b',
    '#3b82f6',
    '#10b981',
    '#8b5cf6',
  ];

  return (
    <div>
      {title && (
        <h3 className="mb-4 text-lg font-semibold text-white">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={(entry) => `${entry.name}`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
            }}
            labelStyle={{ color: '#f3f4f6' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

interface MultiLineChartProps {
  data: Record<string, unknown>[];
  lines: { dataKey: string; stroke: string; label: string }[];
  title?: string;
  height?: number;
}

export const MultiLineChart: React.FC<MultiLineChartProps> = ({
  data,
  lines,
  title,
  height = 300,
}) => {
  return (
    <div>
      {title && (
        <h3 className="mb-4 text-lg font-semibold text-white">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#374151"
          />
          <XAxis stroke="#9ca3af" dataKey="timestamp" />
          <YAxis stroke="#9ca3af" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
            }}
            labelStyle={{ color: '#f3f4f6' }}
          />
          <Legend />
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.stroke}
              strokeWidth={2}
              dot={false}
              name={line.label}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
