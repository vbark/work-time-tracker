import { showHUD } from "@raycast/api";
import { v4 as uuidv4 } from "uuid";
import { getWorkTimeState, saveWorkTimeState } from "./utils/storage";
import { calculateSessionDuration, formatDuration } from "./utils/timeCalculations";
import { WorkSession } from "./models/workTime";

export default async function Command() {
  try {
    const state = await getWorkTimeState();
    
    if (state.currentSession) {
      // Stop the timer
      const endedSession: WorkSession = {
        ...state.currentSession,
        endTime: new Date(),
      };

      const newState = {
        ...state,
        sessions: [...state.sessions, endedSession],
        currentSession: null,
      };

      await saveWorkTimeState(newState);
      
      const duration = calculateSessionDuration(endedSession);
      await showHUD(`Timer stopped: ${formatDuration(duration)}`);
    } else {
      // Start the timer
      const newSession: WorkSession = {
        id: uuidv4(),
        startTime: new Date(),
        endTime: null,
      };

      const newState = {
        ...state,
        currentSession: newSession,
      };

      await saveWorkTimeState(newState);
      await showHUD(`Timer started at ${newSession.startTime.toLocaleTimeString()}`);
    }
  } catch (error) {
    await showHUD(`Error: ${String(error)}`);
  }
}
