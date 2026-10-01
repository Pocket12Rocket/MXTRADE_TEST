import { describe, expect, it } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';

describe('queryKeys', () => {
  it('nests list and detail keys under their domain root so invalidating the root covers them', () => {
    expect(queryKeys.products.list({}).slice(0, 1)).toEqual(queryKeys.products.all);
    expect(queryKeys.products.detail('p1').slice(0, 1)).toEqual(queryKeys.products.all);
    expect(queryKeys.orders.detail('o1').slice(0, 1)).toEqual(queryKeys.orders.all);
    expect(queryKeys.myProducts.detail('p1').slice(0, 1)).toEqual(queryKeys.myProducts.all);
    expect(queryKeys.submissions.list('pending').slice(0, 1)).toEqual(queryKeys.submissions.all);
  });

  it('keys a product list by its filters', () => {
    expect(queryKeys.products.list({ category: 'Gear' })).not.toEqual(
      queryKeys.products.list({ category: 'Parts' }),
    );
    expect(queryKeys.products.list({ category: 'Gear' })).toEqual(
      queryKeys.products.list({ category: 'Gear' }),
    );
  });

  it('keys the checkout quote by cart lines only, ignoring extra item fields', () => {
    const a = queryKeys.checkouts.quote([{ id: 'p1', quantity: 2, name: 'Helmet' } as never]);
    expect(a).toEqual(queryKeys.checkouts.quote([{ id: 'p1', quantity: 2 }]));
    expect(a).not.toEqual(queryKeys.checkouts.quote([{ id: 'p1', quantity: 3 }]));
  });

  it('treats a missing category or status as a distinct null segment', () => {
    expect(queryKeys.products.popular()).toEqual(['products', 'popular', null]);
    expect(queryKeys.submissions.list()).toEqual(['submissions', 'list', null]);
  });

  it('has a key per remaining domain', () => {
    expect(queryKeys.me).toEqual(['me']);
    expect(queryKeys.serviceFeeQuote(1000)).toEqual(['service-fee-quote', 1000]);
    expect(queryKeys.checkouts.detail('c1')).toEqual(['checkouts', 'detail', 'c1']);
  });
});
