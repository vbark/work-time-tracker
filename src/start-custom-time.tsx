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
    const [startDate, setStartDate] = useState<Date>(new Date());
  
    async function handleSubmit() {
      try {
        setIsLoading(true);
        
        // Get current state
        const state = await getWorkTimeState();
        
        // Check if timer is already running
        if (state.currentSession) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Timer already running",
            message: "Stop the current timer before starting a new one",
          });
          pop();
          return;
        }
        
        // Validate that the start time is not in the future
        const now = new Date();
        if (startDate > now) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Invalid start time",
            message: "Start time cannot be in the future",
          });
          return;
        }
        
        // Create new session with custom start time
        const newSession: WorkSession = {
          id: uuidv4(),
          startTime: startDate,
          endTime: null,
        };
        
        // Update state
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
        
        // Close the form
        pop();
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to start timer",
          message: String(error),
        });
      } finally {
        setIsLoading(false);
      }
    }
  
    return (
      <Form
        isLoading={isLoading}
        navigationTitle="Start Timer with Custom Time"
        actions={
          <ActionPanel>
            <Action.SubmitForm title="Start Timer" onSubmit={handleSubmit} />
          </ActionPanel>
        }
      >
        <Form.Description
          title="Custom Start Time"
          text="Set a custom start time for your work timer."
        />
        <Form.DatePicker
          id="startDate"
          title="Start Time"
          value={startDate}
          onChange={(newValue) => {
            if (newValue !== null) {
              setStartDate(newValue);
            }
          }}
          type={Form.DatePicker.Type.DateTime}
        />
      </Form>
    );
  }
  