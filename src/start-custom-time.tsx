import {
  Action,
  ActionPanel,
  Form,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { getWorkTimeState, saveWorkTimeState } from "./utils/storage";
import { WorkSession } from "./models/workTime";

export default function StartCustomTimeCommand() {
  const { pop } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  
  // Set default start time to 1 hour ago to make it clear past times are allowed
  const defaultStartTime = new Date();
  defaultStartTime.setHours(defaultStartTime.getHours() - 1);
  
  const [startDate, setStartDate] = useState<Date>(defaultStartTime);
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [isCompletedSession, setIsCompletedSession] = useState(false);

  // Properly typed onChange handlers
  const handleStartDateChange = (newValue: Date | null) => {
    if (newValue) {
      setStartDate(newValue);
    }
  };

  const handleEndDateChange = (newValue: Date | null) => {
    if (newValue) {
      setEndDate(newValue);
    }
  };

  async function handleSubmit() {
    try {
      setIsLoading(true);
      
      // Get current state
      const state = await getWorkTimeState();
      
      // Check if timer is already running and we're trying to start a new active session
      if (state.currentSession && !isCompletedSession) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Timer already running",
          message: "Stop the current timer before starting a new one",
        });
        pop();
        return;
      }
      
      const now = new Date();
      
      // For active sessions, don't allow future start times
      if (!isCompletedSession && startDate > now) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Invalid start time",
          message: "Start time cannot be in the future for active sessions",
        });
        return;
      }
      
      // For completed sessions, validate end time is after start time
      if (isCompletedSession) {
        if (endDate <= startDate) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Invalid end time",
            message: "End time must be after start time",
          });
          return;
        }
        
        // For completed sessions, don't allow future end times
        if (endDate > now) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Invalid end time",
            message: "End time cannot be in the future",
          });
          return;
        }
      }
      
      // Create new session
      const newSession: WorkSession = {
        id: uuidv4(),
        startTime: startDate,
        endTime: isCompletedSession ? endDate : null,
      };
      
      // Update state
      if (isCompletedSession) {
        // Add completed session to history
        const newState = {
          ...state,
          sessions: [...state.sessions, newSession],
        };
        await saveWorkTimeState(newState);
        
        await showToast({
          style: Toast.Style.Success,
          title: "Session added",
          message: `Added session from ${newSession.startTime.toLocaleTimeString()} to ${newSession.endTime?.toLocaleTimeString()}`,
        });
      } else {
        // Start new active session
        const newState = {
          ...state,
          currentSession: newSession,
        };
        await saveWorkTimeState(newState);
        
        await showToast({
          style: Toast.Style.Success,
          title: "Timer started",
          message: `Started at ${newSession.startTime.toLocaleTimeString()}`,
        });
      }
      
      // Close the form
      pop();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to add session",
        message: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      navigationTitle="Add Work Session"
      actions={
        <ActionPanel>
          <Action.SubmitForm 
            title={isCompletedSession ? "Add Completed Session" : "Start Timer"} 
            onSubmit={handleSubmit} 
          />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Add Work Session"
        text="Start a timer with a custom start time or add a completed work session. Past start times are allowed."
      />
      
      <Form.Checkbox
        id="isCompletedSession"
        label="This is a completed session"
        value={isCompletedSession}
        onChange={setIsCompletedSession}
      />
      
      <Form.DatePicker
        id="startDate"
        title="Start Time"
        value={startDate}
        onChange={handleStartDateChange}
        type={Form.DatePicker.Type.DateTime}
      />
      
      {isCompletedSession && (
        <Form.DatePicker
          id="endDate"
          title="End Time"
          value={endDate}
          onChange={handleEndDateChange}
          type={Form.DatePicker.Type.DateTime}
        />
      )}
    </Form>
  );
}