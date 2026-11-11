import React, { useEffect, useState } from 'react';
import { AREA_COLORS, dayLabel } from '../lib/areaPlan';
import { slotDate, editReel, setDate } from '../lib/contentPlan';
import { ReelDetail } from './ReelDetail';
import './ReelStack.css';

// The one script panel of the app. Any view opens it with openReel(item); the stack
// cards, the week, the month and the day views all use it.
export function ReelDetailHost({ plan, onChange }) {
  const [open, setOpen] = useState(null); // { stackId, reelId }

  useEffect(() => {
    const on = (e) => setOpen(e.detail);
    window.addEventListener('boceto:open-reel', on);
    return () => window.removeEventListener('boceto:open-reel', on);
  }, []);

  const stack = open && plan.stacks && plan.stacks[open.stackId];
  if (!stack || !stack.reels[open.reelId]) return null;
  const area = plan.areas.find((a) => a.id === stack.area);
  const color = area ? AREA_COLORS[area.c % AREA_COLORS.length] : AREA_COLORS[0];
  const order = stack.order.filter((id) => stack.reels[id]);
  return (
    <ReelDetail
      stack={stack} order={order} id={open.reelId} color={color}
      dateOf={(rid) => { const it = plan.items.find((i) => i.id === `${open.stackId}:reel:${rid}`); return dayLabel(it ? it.day : slotDate(stack, order.indexOf(rid))); }}
      dateIso={(rid) => { const it = plan.items.find((i) => i.id === `${open.stackId}:reel:${rid}`); return it ? it.day : ''; }}
      onDate={(rid, iso) => onChange((p) => setDate(p, open.stackId, rid, iso))}
      onEdit={(rid, patch) => onChange((p) => editReel(p, open.stackId, rid, patch))}
      onNavigate={(rid) => setOpen({ stackId: open.stackId, reelId: rid })}
      onClose={() => setOpen(null)}
    />
  );
}
