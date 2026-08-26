import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList, Cell } from 'recharts';
import { getBaseGrade, getGradeColor } from '../utils/grades';
import './GradeHistogram.scss';
import { Link } from 'react-router';
import { useCrag } from '../context/CragContext';

interface GradeHistogramProps {
  gradeData: { grade: string; count: number }[];
  title?: string;
}

const GradeHistogram: React.FC<GradeHistogramProps> = ({ gradeData, title }) => {
  const { getUrl } = useCrag();
  
  // Calculate dynamic height based on the maximum count value
  const maxCount = Math.max(...gradeData.map(item => item.count));
  const dynamicHeight = Math.max(300, Math.min(500, 200 + (maxCount > 50 ? 100 : 0)));
  
  return (
    <div className="grade-histogram">
      <h3 className="grade-histogram__title">
        <Link to={getUrl(`routes`)} className="grade-histogram__title">
          {title || `${gradeData.reduce((acc, curr) => acc + curr.count, 0)} Routes` }
        </Link>
      </h3>
      <ResponsiveContainer width="100%" height={dynamicHeight}>
        <BarChart data={gradeData} margin={{ top: 20, right: 30, left: 0, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="grade" angle={-30} textAnchor="end" interval={0} height={60} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" isAnimationActive={false}>
            {gradeData.map((entry) => (
              <Cell key={`cell-${entry.grade}`} fill={getGradeColor(getBaseGrade(entry.grade))} />
            ))}
            <LabelList dataKey="count" position="top" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GradeHistogram; 