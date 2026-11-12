import { createContext } from 'react';

// Counts to show next to a plan tab, e.g. { motor: 8 } = overdue items waiting in the scheduler.
export const PlanBadgeContext = createContext({});
