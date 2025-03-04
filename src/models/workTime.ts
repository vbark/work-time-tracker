export interface WorkSession {
    id: string;
    startTime: Date;
    endTime: Date | null;
  }
  
  export interface DailyTarget {
    date: string; // YYYY-MM-DD format
    targetHours: number;
  }
  
  export interface WorkTimeState {
    sessions: WorkSession[];
    dailyTargets: DailyTarget[];
    currentSession: WorkSession | null;
    defaultTargetHours: number;
    notificationSettings: {
      enableStartReminder: boolean;
      startReminderTime: string; // HH:MM format
      enableStopReminder: boolean;
      stopAfterHours: number;
    };
  }
  
  export const initialState: WorkTimeState = {
    sessions: [],
    dailyTargets: [],
    currentSession: null,
    defaultTargetHours: 8,
    notificationSettings: {
      enableStartReminder: true,
      startReminderTime: "08:00",
      enableStopReminder: true,
      stopAfterHours: 8,
    },
  };
  