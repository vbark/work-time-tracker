import {
    Action,
    ActionPanel,
    Form,
    showToast,
    Toast,
  } from "@raycast/api";
  import { useState, useEffect } from "react";
  import { getWorkTimeState, saveWorkTimeState } from "./utils/storage";
  import { WorkTimeState } from "./models/workTime";
  
  export default function SettingsCommand() {
    const [state, setState] = useState<WorkTimeState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
  
    useEffect(() => {
      async function loadState() {
        try {
          const loadedState = await getWorkTimeState();
          setState(loadedState);
        } catch (error) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Failed to load settings",
            message: String(error),
          });
        } finally {
          setIsLoading(false);
        }
      }
  
      loadState();
    }, []);
  
    async function handleSubmit(values: {
      defaultTargetHours: string;
      enableStartReminder: boolean;
      startReminderTime: Date;
      enableStopReminder: boolean;
      stopAfterHours: string;
    }) {
      if (!state) return;
  
      try {
        const defaultTargetHours = parseFloat(values.defaultTargetHours);
        const stopAfterHours = parseFloat(values.stopAfterHours);
        
        if (isNaN(defaultTargetHours) || defaultTargetHours <= 0) {
          throw new Error("Default target hours must be a positive number");
        }
        
        if (isNaN(stopAfterHours) || stopAfterHours <= 0) {
          throw new Error("Stop reminder hours must be a positive number");
        }
        
        const startReminderTime = values.startReminderTime.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        
        const newState: WorkTimeState = {
          ...state,
          defaultTargetHours,
          notificationSettings: {
            enableStartReminder: values.enableStartReminder,
            startReminderTime,
            enableStopReminder: values.enableStopReminder,
            stopAfterHours,
          },
        };
        
        await saveWorkTimeState(newState);
        setState(newState);
        
        await showToast({
          style: Toast.Style.Success,
          title: "Settings saved",
        });
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to save settings",
          message: String(error),
        });
      }
    }
  
    if (isLoading || !state) {
      return <Form isLoading={true} />;
    }
  
    // Parse time string to Date for the form
    const [hours, minutes] = state.notificationSettings.startReminderTime.split(":").map(Number);
    const startReminderDate = new Date();
    startReminderDate.setHours(hours, minutes, 0);
  
    return (
      <Form
        isLoading={isLoading}
        navigationTitle="Work Time Tracker Settings"
        actions={
          <ActionPanel>
            <Action.SubmitForm title="Save Settings" onSubmit={handleSubmit} />
          </ActionPanel>
        }
      >
        <Form.Description
          title="Work Time Settings"
          text="Configure your default work hours and notification preferences."
        />
        
        <Form.TextField
          id="defaultTargetHours"
          title="Default Daily Target (hours)"
          defaultValue={state.defaultTargetHours.toString()}
        />
        
        <Form.Separator />
        
        <Form.Description
          title="Notification Settings"
          text="Configure reminders to start and stop your work timer."
        />
        
        <Form.Checkbox
        id="enableStartReminder"
        label="Enable Start Reminder"
        defaultValue={state.notificationSettings.enableStartReminder}
      />
      
      <Form.DatePicker
        id="startReminderTime"
        title="Start Reminder Time"
        type={Form.DatePicker.Type.Time}
        defaultValue={startReminderDate}
      />
      
      <Form.Checkbox
        id="enableStopReminder"
        label="Enable Stop Reminder"
        defaultValue={state.notificationSettings.enableStopReminder}
      />
      
      <Form.TextField
        id="stopAfterHours"
        title="Stop Reminder After (hours)"
        defaultValue={state.notificationSettings.stopAfterHours.toString()}
      />
    </Form>
  );
}
