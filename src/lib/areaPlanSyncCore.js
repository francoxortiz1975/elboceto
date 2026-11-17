// The save step of the plan sync, with the cloud calls passed in so it can be tested without a network.
//   api.push(plan, expected) -> { ok: true, updatedAt } | { ok: false, conflict: true }   (expected = the cloud version we last saw)
//   api.pull()               -> { plan, updatedAt } | null
// A save never overwrites a newer cloud copy: if the cloud changed meanwhile (IRIS notes, a block ticked by the MCP, the nightly
// job), the two copies are merged and the merged plan is what the device keeps and saves next.

import { mergePlans } from './areaPlanMerge';

export async function savePlan({ plan, expected, base, api }) {
  const r = await api.push(plan, expected);
  if (r.ok) return { status: 'pushed', updatedAt: r.updatedAt };
  const cloud = await api.pull();
  if (!cloud) {
    // the row is gone: write it again
    const again = await api.push(plan, null);
    return again.ok ? { status: 'pushed', updatedAt: again.updatedAt } : { status: 'failed' };
  }
  return { status: 'merged', plan: mergePlans(base, plan, cloud.plan), cloudPlan: cloud.plan, cloudUpdatedAt: cloud.updatedAt };
}
