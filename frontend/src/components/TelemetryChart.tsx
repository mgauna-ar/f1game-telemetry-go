import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import type { TelemetrySample } from '../hooks/useTelemetry';

interface TelemetryChartProps {
  data: TelemetrySample[];
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({ data }) => {
  // Format data for Recharts, scale throttle/brake from 0-1 to 0-100% for easier viewing with speed
  const formattedData = data.map(sample => ({
    time: sample.SessionTime,
    speed: Math.max(0, sample.Speed || 0),
    throttle: Math.min(100, Math.max(0, sample.Throttle <= 1.0 ? sample.Throttle * 100 : sample.Throttle)),
    brake: Math.min(100, Math.max(0, sample.Brake <= 1.0 ? sample.Brake * 100 : sample.Brake)),
  }));

  // Define colors from our CSS vars (using HSL strings directly for Recharts)
  const colors = {
    speed: 'hsl(199, 89%, 48%)',     // Neon Blue
    throttle: 'hsl(150, 100%, 40%)', // Green
    brake: 'hsl(351, 100%, 55%)'     // F1 Red
  };

  return (
    <div style={{ width: '100%', height: '300px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsla(0, 0%, 100%, 0.1)" vertical={false} />
          
          <XAxis 
            dataKey="time" 
            stroke="hsl(215, 20%, 65%)" 
            tickFormatter={(val) => val.toFixed(1)}
            tick={{ fontSize: 12 }}
            domain={['dataMin', 'dataMax']}
            type="number"
          />
          
          <YAxis 
            yAxisId="speed" 
            stroke="hsl(215, 20%, 65%)" 
            tick={{ fontSize: 12 }} 
            domain={[0, 350]} 
          />
          
          <YAxis 
            yAxisId="inputs" 
            orientation="right" 
            stroke="hsl(215, 20%, 65%)" 
            tick={{ fontSize: 12 }} 
            domain={[0, 100]} 
          />

          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsla(222, 47%, 11%, 0.9)', 
              borderColor: 'hsla(0, 0%, 100%, 0.1)',
              borderRadius: '8px',
              color: '#fff'
            }}
            labelFormatter={(label) => `Time: ${Number(label).toFixed(2)}s`}
          />

          <Line 
            yAxisId="speed" 
            type="monotone" 
            dataKey="speed" 
            name="Speed (km/h)"
            stroke={colors.speed} 
            strokeWidth={2} 
            dot={false}
            isAnimationActive={false} // Disable animation for live rolling updates
          />
          <Line 
            yAxisId="inputs" 
            type="monotone" 
            dataKey="throttle" 
            name="Throttle (%)"
            stroke={colors.throttle} 
            strokeWidth={2} 
            dot={false}
            isAnimationActive={false}
          />
          <Line 
            yAxisId="inputs" 
            type="monotone" 
            dataKey="brake" 
            name="Brake (%)"
            stroke={colors.brake} 
            strokeWidth={2} 
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
