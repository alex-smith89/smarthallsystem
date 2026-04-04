import type { ReactNode } from 'react';

type StatCardTone = 'default' | 'primary' | 'success' | 'warning' | 'danger';

type StatCardProps = {
  label: string;
  value: ReactNode;
  helper?: string;
  tone?: StatCardTone;
};

const toneStyles: Record<StatCardTone, { border: string; bg: string }> = {
  default: {
    border: '#e2e8f0',
    bg: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)'
  },
  primary: {
    border: '#bfdbfe',
    bg: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)'
  },
  success: {
    border: '#bbf7d0',
    bg: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)'
  },
  warning: {
    border: '#fde68a',
    bg: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)'
  },
  danger: {
    border: '#fecaca',
    bg: 'linear-gradient(180deg, #fef2f2 0%, #ffffff 100%)'
  }
};

export default function StatCard({
  label,
  value,
  helper,
  tone = 'default'
}: StatCardProps) {
  const toneStyle = toneStyles[tone];

  return (
    <div
      className="stat-card"
      style={{
        borderColor: toneStyle.border,
        background: toneStyle.bg
      }}
    >
      <p className="stat-label">{label}</p>
      <h3 className="stat-value">{value}</h3>
      {helper ? <p className="stat-helper">{helper}</p> : null}
    </div>
  );
}