import type { ReactNode } from 'react';

type StatCardProps = {
  label: string;
  value: ReactNode;
  helper?: string;
};

export default function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <div className="stat-card">
      <p className="stat-label">{label}</p>
      <h3 className="stat-value">{value}</h3>
      {helper ? <p className="stat-helper">{helper}</p> : null}
    </div>
  );
}