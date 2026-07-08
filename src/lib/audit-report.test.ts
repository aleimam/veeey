import { describe, it, expect } from 'vitest';
import { renderAuditReport, type AuditReport } from './audit-report';

const report: AuditReport = {
  from: new Date('2026-07-01T00:00:00Z'),
  to: new Date('2026-07-08T00:00:00Z'),
  total: 42,
  byEntity: [
    { entity: 'Product', count: 25 },
    { entity: 'Order', count: 17 },
  ],
  topActions: [{ action: 'change.product.update', count: 20 }],
  topActors: [{ actor: 'Pharmacist Sara', count: 30 }],
};

describe('renderAuditReport', () => {
  it('renders a subject with the period end and total', () => {
    const { subject } = renderAuditReport(report);
    expect(subject).toContain('2026-07-08');
    expect(subject).toContain('42');
  });

  it('renders every section with counts', () => {
    const { body } = renderAuditReport(report);
    expect(body).toContain('2026-07-01 to 2026-07-08');
    expect(body).toContain('Product: 25');
    expect(body).toContain('change.product.update: 20');
    expect(body).toContain('Pharmacist Sara: 30');
    expect(body).toContain('/admin/change-log');
  });

  it('handles an empty week without crashing', () => {
    const { body } = renderAuditReport({ ...report, total: 0, byEntity: [], topActions: [], topActors: [] });
    expect(body).toContain('Total logged actions: 0');
    expect(body).toContain('(none)');
  });
});
