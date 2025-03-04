import { WorkSession, DailyTarget } from "../models/workTime";

export function formatDuration(durationInMs: number): string {
  const hours = Math.floor(durationInMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationInMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${hours}h ${minutes}m`;
}

export function calculateSessionDuration(session: WorkSession): number {
  if (!session.endTime) {
    return 0;
  }
  
  return session.endTime.getTime() - session.startTime.getTime();
}

export function calculateTotalWorkTime(sessions: WorkSession[]): number {
  return sessions.reduce((total, session) => {
    if (!session.endTime) return total;
    return total + calculateSessionDuration(session);
  }, 0);
}

export function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0]; // YYYY-MM-DD
}

export function getSessionsByDate(sessions: WorkSession[]): Record<string, WorkSession[]> {
  const sessionsByDate: Record<string, WorkSession[]> = {};
  
  sessions.forEach((session) => {
    if (!session.endTime) return;
    
    const dateKey = formatDateKey(session.startTime);
    
    if (!sessionsByDate[dateKey]) {
      sessionsByDate[dateKey] = [];
    }
    
    sessionsByDate[dateKey].push(session);
  });
  
  return sessionsByDate;
}

export function calculateDailyBalance(
  sessions: WorkSession[], 
  dailyTargets: DailyTarget[],
  defaultTargetHours: number
): Record<string, number> {
  const sessionsByDate = getSessionsByDate(sessions);
  const balance: Record<string, number> = {};
  
  // Create a map of date to target hours for faster lookup
  const targetMap: Record<string, number> = {};
  dailyTargets.forEach((target) => {
    targetMap[target.date] = target.targetHours;
  });
  
  Object.entries(sessionsByDate).forEach(([date, dateSessions]) => {
    const totalMs = dateSessions.reduce((total, session) => {
      return total + calculateSessionDuration(session);
    }, 0);
    
    const totalHours = totalMs / (1000 * 60 * 60);
    const targetHours = targetMap[date] || defaultTargetHours;
    
    balance[date] = totalHours - targetHours;
  });
  
  return balance;
}

export function calculateTotalBalance(
  sessions: WorkSession[],
  dailyTargets: DailyTarget[],
  defaultTargetHours: number
): number {
  const dailyBalances = calculateDailyBalance(sessions, dailyTargets, defaultTargetHours);
  
  return Object.values(dailyBalances).reduce((total, balance) => total + balance, 0);
}
