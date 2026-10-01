import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SellingPriceInfo from '../../components/SellingPriceInfo';
import ServiceFeeNote from '../../components/ServiceFeeNote';

vi.mock('../../lib/useServiceFeeQuote', () => ({
  useServiceFeeQuote: vi.fn((price) => (price ? { sellerPriceCents: 45000, listPriceCents: 54000, serviceFeeCents: 9000 } : null)),
}));

describe('fee-free listings', () => {
  it('shows the buyer paying the seller price with no fee', () => {
    render(<SellingPriceInfo price="450" serviceFeeWaived />);

    expect(screen.getByText(/You receive R450.00. Buyers pay R450.00. FastSport service fee waived./)).toBeInTheDocument();
  });

  it('still shows the quoted fee for a normal listing', () => {
    render(<SellingPriceInfo price="450" />);

    expect(screen.getByText(/Buyers pay R540.00, including the R90.00 FastSport service fee./)).toBeInTheDocument();
  });

  it('ServiceFeeNote shows the waived note only when waived', () => {
    const { rerender } = render(<ServiceFeeNote waived />);
    expect(screen.getByText('FastSport service fee waived')).toBeInTheDocument();

    rerender(<ServiceFeeNote serviceFee={0} />);
    expect(screen.queryByText('FastSport service fee waived')).not.toBeInTheDocument();
  });
});
