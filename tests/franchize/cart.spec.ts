import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/contexts/AppContext', () => ({
  useAppContext: () => ({ dbUser: null }),
}));
import { useFranchizeCart } from '@/app/franchize/hooks/useFranchizeCart';

describe('Franchize Cart (Characterization)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty and correctly adds/removes items', async () => {
    const { result } = renderHook(() => useFranchizeCart('vip-bike'));

    expect(result.current.itemCount).toBe(0);

    let lineId = '';
    act(() => {
      lineId = result.current.addItem('bike-123', {
        package: 'Базовый',
        duration: '1 день',
        perk: 'Стандарт',
        auction: 'Без аукциона',
      });
    });

    await waitFor(() => {
      expect(result.current.itemCount).toBe(1);
      expect(result.current.cart[lineId]).toBeDefined();
    });

    act(() => {
      result.current.removeLine(lineId);
    });

    await waitFor(() => {
      expect(result.current.itemCount).toBe(0);
    });
  });
});
