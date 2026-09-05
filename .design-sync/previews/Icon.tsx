import React from 'react';
import { Icon } from 'stackline';

const NAMES = [
  'dashboard', 'pos', 'box', 'receipt', 'chart', 'settings', 'user', 'users',
  'supplier', 'search', 'bell', 'cash', 'card', 'transfer', 'print', 'download',
  'edit', 'trash', 'alert', 'barcode', 'calendar', 'clock', 'refresh', 'filter',
  'branch', 'shield', 'tag', 'lock', 'eye', 'truck', 'bolt', 'menu',
];

const cell: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
  padding: '12px 8px', color: 'var(--text, #1f2937)', fontSize: 11,
  fontFamily: 'var(--font-sans, system-ui, sans-serif)',
};

export function Gallery() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4, padding: 12 }}>
      {NAMES.map((n) => (
        <div key={n} style={cell}>
          <Icon name={n} size={24} />
          <span style={{ opacity: 0.6 }}>{n}</span>
        </div>
      ))}
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 20, color: 'var(--text, #1f2937)' }}>
      {[14, 20, 28, 40].map((s) => (
        <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, fontSize: 11, fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}>
          <Icon name="dashboard" size={s} />
          <span style={{ opacity: 0.6 }}>{s}px</span>
        </div>
      ))}
    </div>
  );
}

export function Colors() {
  const colors = ['var(--brand, #2563eb)', 'var(--success, #16a34a)', 'var(--warning, #d97706)', 'var(--danger, #dc2626)'];
  return (
    <div style={{ display: 'flex', gap: 20, padding: 20 }}>
      {colors.map((c, i) => (
        <span key={i} style={{ color: c }}><Icon name="bell" size={28} /></span>
      ))}
    </div>
  );
}
