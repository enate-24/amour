import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface ChartData {
  date: string;
  games: number;
  totalBets: number;
  houseProfit: number;
}

interface StatsChartProps {
  data?: ChartData[];
}

const StatsChart: React.FC<StatsChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="p-4 sm:p-6 rounded-lg">
        <h3 className="text-lg sm:text-xl font-semibold mb-2 text-white">House Profit Chart</h3>
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-slate-400 text-sm sm:text-base">No chart data available</p>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">Play some games to see your house profit analytics</p>
          </div>
        </div>
      </div>
    );
  }

  // Sort data by date and get last 10 days
  const sortedData = data
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-10);

  // Format data for better display
  const formattedData = sortedData.map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    }),
    houseProfit: Math.round(item.houseProfit),
    totalBets: Math.round(item.totalBets),
    games: item.games
  }));

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-slate-900 border border-slate-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium mb-2">{`Date: ${label}`}</p>
          <p className="text-sm text-green-400">
            {`House Profit: ${data.value?.toLocaleString() || 0} Birr`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 sm:p-6 rounded-lg">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-white">House Profit Column Chart</h3>
          <p className="text-xs sm:text-sm text-slate-400">Last 10 days performance</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300} className="sm:h-[350px]">
        <BarChart
          data={formattedData}
          margin={{
            top: 20,
            right: 15,
            left: 10,
            bottom: 5,
          }}
          barCategoryGap="15%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="date"
            stroke="#9CA3AF"
            fontSize={10}
            tick={{ fill: '#9CA3AF', fontSize: 10 }}
            axisLine={{ stroke: '#374151' }}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            stroke="#9CA3AF"
            fontSize={10}
            tick={{ fill: '#9CA3AF', fontSize: 10 }}
            axisLine={{ stroke: '#374151' }}
            width={60}
            label={{ 
              value: 'Amount (Birr)', 
              angle: -90, 
              position: 'insideLeft', 
              style: { textAnchor: 'middle', fill: '#9CA3AF', fontSize: '10px' } 
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="houseProfit"
            fill="#10B981"
            name="House Profit"
            radius={[4, 4, 0, 0]}
            opacity={0.9}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StatsChart;
