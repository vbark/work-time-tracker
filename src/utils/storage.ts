import { LocalStorage } from "@raycast/api";
import { WorkTimeState, initialState, WorkSession } from "../models/workTime";

export async function getWorkTimeState(): Promise<WorkTimeState> {
  const storedState = await LocalStorage.getItem<string>("workTimeState");
  if (!storedState) {
    return initialState;
  }

  const parsedState = JSON.parse(storedState) as WorkTimeState;
  
  // Convert string dates back to Date objects
  parsedState.sessions = parsedState.sessions.map((session) => ({
    ...session,
    startTime: new Date(session.startTime),
    endTime: session.endTime ? new Date(session.endTime) : null,
  }));
  
  if (parsedState.currentSession) {
    parsedState.currentSession = {
      ...parsedState.currentSession,
      startTime: new Date(parsedState.currentSession.startTime),
      endTime: parsedState.currentSession.endTime 
        ? new Date(parsedState.currentSession.endTime) 
        : null,
    };
  }
  
  return parsedState;
}

export async function saveWorkTimeState(state: WorkTimeState): Promise<void> {
  await LocalStorage.setItem("workTimeState", JSON.stringify(state));
}
