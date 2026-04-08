import type { ReactNode } from 'react';

type StatCardTone = 'default' | 'primary' | 'success' | 'warning' | 'danger';

type StatCardProps = {
  label: string;
  value: ReactNode;
  helper?: string;
  tone?: StatCardTone;
};

export default function StatCard({
  label,
  value,
  helper,
  tone = 'default'
}: StatCardProps) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <p className="stat-label">{label}</p>
      <h3 className="stat-value">{value}</h3>
      {helper ? <p className="stat-helper">{helper}</p> : null}
    </div>
  );
}