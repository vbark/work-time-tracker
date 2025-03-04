import { getPreferenceValues, showToast, Toast } from "@raycast/api";
import { getWorkTimeState, saveWorkTimeState } from "./storage";
import { calculateSessionDuration } from "./timeCalculations";
import { WorkSession } from "../models/workTime";

// This function will be called by the background task
export async function checkNotifications(): Promise<void> {
  try {
    const state = await getWorkTimeState();
    const now = new Date();
    
    // Check for start reminder
    if (state.notificationSettings.enableStartReminder) {
      const [reminderHours, reminderMinutes] = state.notificationSettings.startReminderTime
        .split(":")
        .map(Number);
      
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      
      // Check if it's time for the start reminder (within 5 minutes)
      if (
        currentHours === reminderHours &&
        Math.abs(currentMinutes - reminderMinutes) <= 5 &&
        !state.currentSession
      ) {
        await showToast({
          style: Toast.Style.Info,
          title: "Time to start working",
          message: "Don't forget to start your work timer",
        });
      }
    }
    
    // Check for stop reminder
    if (
      state.notificationSettings.enableStopReminder &&
      state.currentSession
    ) {
      const sessionDuration = now.getTime() - state.currentSession.startTime.getTime();
      const sessionHours = sessionDuration / (1000 * 60 * 60);
      
      // Check if the current session has exceeded the stop reminder threshold
      if (sessionHours >= state.notificationSettings.stopAfterHours) {
        await showToast({
          style: Toast.Style.Info,
          title: "Time to stop working",
          message: `You've been working for ${sessionHours.toFixed(1)} hours`,
        });
      }
    }
  } catch (error) {
    console.error("Error checking notifications:", error);
  }
}