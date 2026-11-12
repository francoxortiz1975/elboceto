import React, { useMemo } from 'react';
import { AreaPlanner } from './AreaPlanner';
import { WeeklyPlanner } from './WeeklyPlanner';
import { SocialManager } from './SocialManager';
import { SchedulerPage } from './SchedulerPage';
import { PlanBadgeContext } from './planBadges';
import { isoOf } from '../lib/areaPlan';
import { overdueItems } from '../lib/scheduler/overdue';

// One view for the whole plan: the full day, the area board, the week and the month all read
// and write the same plan, so switching tabs never changes the information.
export function PlanView(props) {
  // Overdue items show as a count on the Motor tab, in every plan view.
  const overdue = useMemo(() => overdueItems(props.areaPlan, isoOf(new Date())).length, [props.areaPlan.items]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <PlanBadgeContext.Provider value={useMemo(() => ({ motor: overdue }), [overdue])}>
      <PlanViewBody {...props} />
    </PlanBadgeContext.Provider>
  );
}

function PlanViewBody({ tab, onTabChange, areaPlan, onChangeAreaPlan, onBack, compact, ...weeklyProps }) {
  if (tab === 'board' || tab === 'day') {
    return (
      <AreaPlanner
        plan={areaPlan}
        onChange={onChangeAreaPlan}
        onBack={onBack}
        compact={compact}
        lens={tab === 'day' ? 'day' : 'areas'}
        tab={tab}
        onTabChange={onTabChange}
      />
    );
  }
  if (tab === 'social') {
    return <SocialManager plan={areaPlan} onChange={onChangeAreaPlan} onBack={onBack} compact={compact} tab={tab} onTabChange={onTabChange} />;
  }
  if (tab === 'motor') {
    return <SchedulerPage plan={areaPlan} onChange={onChangeAreaPlan} onBack={onBack} compact={compact} tab={tab} onTabChange={onTabChange} />;
  }
  return (
    <WeeklyPlanner
      {...weeklyProps}
      onTransitionToBoard={onBack}
      areaPlan={areaPlan}
      onChangeAreaPlan={onChangeAreaPlan}
      mode={tab}
      onModeChange={onTabChange}
    />
  );
}
