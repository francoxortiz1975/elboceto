import { useEffect, useRef } from 'react';
import { pullAreaPlan, pushAreaPlan } from './areaPlanCloud';
import { isUntouchedPlan } from './areaPlan';

// Keeps the area plan the same on every device, without Realtime:
//  - edits are saved to the cloud a couple of seconds after the last change
//    (and immediately when the app is hidden);
//  - when the app opens or comes back to the foreground, the latest cloud
//    copy is loaded, unless this device still has edits that haven't been
//    uploaded yet (those win, since they were just made here).
// If the cloud has no plan yet, this device's plan becomes the first copy.
// A device that never synced keeps its own plan only when it has real edits;
// an untouched starter example always gives way to the cloud copy.

const META_KEY = 'el_boceto_area_plan_sync_v1';
const PUSH_DELAY_MS = 2000;

function loadMeta() {
  try {
    return { lastSeenCloud: null, dirty: false, ...JSON.parse(localStorage.getItem(META_KEY)) };
  } catch {
    return { lastSeenCloud: null, dirty: false };
  }
}

function saveMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (e) {
    console.error('Error saving area plan sync state:', e);
  }
}

export function useAreaPlanSync(user, plan, setPlan) {
  const userId = user?.id;
  const meta = useRef(loadMeta());
  const planRef = useRef(plan);
  const lastPlan = useRef(plan);
  const skipNext = useRef(false); // the change that just came from the cloud isn't an edit
  const busy = useRef(false);
  const timer = useRef(null);
  const pushRef = useRef(() => {});
  planRef.current = plan;

  pushRef.current = async () => {
    if (!userId || busy.current || !meta.current.dirty) return;
    busy.current = true;
    const snapshot = planRef.current;
    try {
      meta.current.lastSeenCloud = await pushAreaPlan(userId, snapshot);
      // Edits made while the request was in flight keep the plan dirty.
      if (planRef.current === snapshot) meta.current.dirty = false;
      saveMeta(meta.current);
    } catch (e) {
      console.error('Error guardando el plan por áreas:', e);
    } finally {
      busy.current = false;
    }
    if (meta.current.dirty) {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => pushRef.current(), PUSH_DELAY_MS);
    }
  };

  // Local edits -> mark dirty and save soon.
  useEffect(() => {
    if (plan === lastPlan.current) return;
    lastPlan.current = plan;
    if (skipNext.current) { skipNext.current = false; return; }
    meta.current.dirty = true;
    saveMeta(meta.current);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => pushRef.current(), PUSH_DELAY_MS);
  }, [plan]);

  // Open / foreground -> load the latest copy; hidden -> save right away.
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;

    const pull = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const cloud = await pullAreaPlan(userId);
        if (cancelled) return;
        if (!cloud) {
          // Nothing in the cloud yet: this device's plan is the first copy.
          meta.current.dirty = true;
          saveMeta(meta.current);
        } else if (meta.current.lastSeenCloud === null && !meta.current.dirty && !isUntouchedPlan(planRef.current)) {
          // First sync of a device that already holds real edits: they go up.
          meta.current.dirty = true;
          saveMeta(meta.current);
        } else if (cloud.updatedAt !== meta.current.lastSeenCloud && !meta.current.dirty) {
          skipNext.current = true;
          setPlan(cloud.plan);
          meta.current.lastSeenCloud = cloud.updatedAt;
          saveMeta(meta.current);
        }
      } catch (e) {
        console.error('Error cargando el plan por áreas:', e);
      } finally {
        busy.current = false;
      }
      pushRef.current();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        pull();
      } else {
        clearTimeout(timer.current);
        pushRef.current();
      }
    };

    pull();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', pull);
    window.addEventListener('pagehide', onVisibility);
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', pull);
      window.removeEventListener('pagehide', onVisibility);
    };
  }, [userId, setPlan]);
}
