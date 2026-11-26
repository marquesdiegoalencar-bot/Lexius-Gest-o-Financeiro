import { describe, expect, it } from 'vitest';
import { DEMO_LABEL, getDashboardDemo } from './dashboard-mock';

describe('dashboard mock demonstrativo', () => {
  it('expõe KPIs e série de vendas', () => {
    const d = getDashboardDemo();
    expect(DEMO_LABEL).toBe('Demonstrativo');
    expect(d.dailySales).toBeGreaterThan(0);
    expect(d.salesChart).toHaveLength(7);
    expect(d.topProducts.length).toBeGreaterThanOrEqual(3);
  });
});