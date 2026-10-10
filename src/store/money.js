/**
 * What a trip costs.
 *
 * Every figure here is the user's own: an activity's cost, a stay's cost, and
 * a planned budget. Nothing is estimated or fetched — a travel app that
 * invents prices is worse than one that shows none.
 *
 * "Included" activities (a ticket already paid for in a package) count as
 * planned but not as money you will hand over.
 */
export function tripMoney(trip) {
  if (!trip) return null;
  const acts = (trip.days || []).flatMap((d) => d.activities || []);

  const activitySpent = acts
    .filter((a) => a.done && !a.cost?.included)
    .reduce((s, a) => s + (Number(a.cost?.amount) || 0), 0);
  const activityPlanned = acts
    .filter((a) => !a.cost?.included)
    .reduce((s, a) => s + (Number(a.cost?.amount) || 0), 0);
  const included = acts
    .filter((a) => a.cost?.included)
    .reduce((s, a) => s + (Number(a.cost?.amount) || 0), 0);

  const stays = (trip.stays || []).reduce((s, x) => s + (Number(x.cost) || 0), 0);

  const planned = Number(trip.budget?.planned) || 0;
  const committed = activityPlanned + stays;
  const spent = activitySpent + stays;

  return {
    currency: trip.currency || 'BDT',
    planned, committed, spent, included,
    left: planned ? planned - committed : null,
    over: planned > 0 && committed > planned,
    byKind: [
      { key: 'stays', value: stays },
      { key: 'activities', value: activityPlanned },
    ].filter((x) => x.value > 0),
    perDay: (trip.days || []).map((d, i) => ({
      index: i + 1,
      value: (d.activities || [])
        .filter((a) => !a.cost?.included)
        .reduce((s, a) => s + (Number(a.cost?.amount) || 0), 0)
        + ((trip.stays || []).find((x) => x.id === d.stayId)?.cost || 0),
    })),
  };
}

/** 12,500 — grouped, never rounded away */
export const money = (n, currency) =>
  `${currency ? currency + ' ' : ''}${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
