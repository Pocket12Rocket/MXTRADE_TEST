import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import SellingPriceInfo from './SellingPriceInfo';
import { renderWithQueryClient } from '@/test/renderWithQueryClient';
import ServiceFeeNote from '@/components/ServiceFeeNote';

vi.mock('@/lib/api/submissions', () => ({
  fetchServiceFeeQuote: vi.fn(() =>
    Promise.resolve({ sellerPriceCents: 45000, listPriceCents: 54000, serviceFeeCents: 9000 }),
  ),
}));

describe('fee-free listings', () => {
  it('shows the buyer paying the seller price with no fee', () => {
    renderWithQueryClient(<SellingPriceInfo price="450" serviceFeeWaived />);

    expect(
      screen.getByText(/You receive R450.00. Buyers pay R450.00. FastSport service fee waived./),
    ).toBeInTheDocument();
  });

  it('still shows the quoted fee for a normal listing', async () => {
    renderWithQueryClient(<SellingPriceInfo price="450" />);

    expect(
      await screen.findByText(/Buyers pay R540.00, including the R90.00 FastSport service fee./),
    ).toBeInTheDocument();
  });

  it('ServiceFeeNote shows the waived note only when waived', () => {
    const { rerender } = renderWithQueryClient(<ServiceFeeNote waived />);
    expect(screen.getByText('FastSport service fee waived')).toBeInTheDocument();

    rerender(<ServiceFeeNote serviceFee={0} />);
    expect(screen.queryByText('FastSport service fee waived')).not.toBeInTheDocument();
  });
});
