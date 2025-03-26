"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AnalyticsDashboardProps {
  data: {
    videoId: string;
    views: string;
    likes: string;
  }[];
}

export function AnalyticsDashboard({ data }: AnalyticsDashboardProps) {
  if (data.length === 0) {
    return <p className="text-center text-muted-foreground">No analytics data available</p>;
  }

  const chartData = data.map(item => ({
    videoId: item.videoId,
    views: parseInt(item.views),
    likes: parseInt(item.likes),
    likeRatio: (parseInt(item.likes) / parseInt(item.views) * 100
  }));

  return (
    <div className="bg-card p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Video Performance</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="videoId" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="views" fill="#8884d8" name="Views" />
            <Bar dataKey="likes" fill="#82ca9d" name="Likes" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Like/View Ratio</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="videoId" />
              <YAxis unit="%" />
              <Tooltip formatter={(value) => [`${value}%`, "Like/View Ratio"]} />
              <Bar dataKey="likeRatio" fill="#ffc658" name="Like/View Ratio" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}