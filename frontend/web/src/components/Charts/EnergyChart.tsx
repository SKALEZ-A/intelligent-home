import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface EnergyDataPoint {
  timestamp: string;
  consumption: number;
  cost: number;
  solar?: number;
}

interface EnergyChartProps {
  data: EnergyDataPoint[];
  type?: 'line' | 'area' | 'bar';
  showSolar?: boolean;
  height?: number;
}

export const EnergyChart: React.FC<EnergyChartProps> = ({
  data,
  type = 'area',
  showSolar = false,
  height = 300
}) => {
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatCost = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  const formatEnergy = (value: number) => {
    return `${value.toFixed(1)} kWh`;
  };

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 10, right: 30, left: 0, bottom: 0 }
    };

    switch (type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} />
            <YAxis yAxisId="left" tickFormatter={formatEnergy} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={formatCost} />
            <Tooltip
              labelFormatter={formatTimestamp}
              formatter={(value: number, name: string) => {
                if (name === 'cost') return formatCost(value);
                return formatEnergy(value);
              }}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="consumption"
              stroke="#8884d8"
              strokeWidth={2}
              dot={false}
            />
            {showSolar && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="solar"
                stroke="#82ca9d"
                strokeWidth={2}
                dot={false}
              />
            )}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cost"
              stroke="#ffc658"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="colorConsumption" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} />
            <YAxis tickFormatter={formatEnergy} />
            <Tooltip
              labelFormatter={formatTimestamp}
              formatter={(value: number) => formatEnergy(value)}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="consumption"
              stroke="#8884d8"
              fillOpacity={1}
              fill="url(#colorConsumption)"
            />
            {showSolar && (
              <Area
                type="monotone"
                dataKey="solar"
                stroke="#82ca9d"
                fillOpacity={1}
                fill="url(#colorSolar)"
              />
            )}
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} />
            <YAxis tickFormatter={formatEnergy} />
            <Tooltip
              labelFormatter={formatTimestamp}
              formatter={(value: number) => formatEnergy(value)}
            />
            <Legend />
            <Bar dataKey="consumption" fill="#8884d8" />
            {showSolar && <Bar dataKey="solar" fill="#82ca9d" />}
          </BarChart>
        );

      default:
        return null;
    }
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      {renderChart()}
    </ResponsiveContainer>
  );
};

export default EnergyChart;
