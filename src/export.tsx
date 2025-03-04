import {
    Action,
    ActionPanel,
    Form,
    showToast,
    Toast,
    open,
    showHUD,
  } from "@raycast/api";
  import { useState, useEffect } from "react";
  import { getWorkTimeState } from "./utils/storage";
  import { WorkTimeState } from "./models/workTime";
  import { calculateSessionDuration, formatDateKey } from "./utils/timeCalculations";
  import fs from "fs";
  import path from "path";
  import os from "os";
  
  export default function ExportCommand() {
    const [state, setState] = useState<WorkTimeState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [startDate, setStartDate] = useState<Date>(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    );
    const [endDate, setEndDate] = useState<Date>(
      new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    );
  
    useEffect(() => {
      async function loadState() {
        try {
          const loadedState = await getWorkTimeState();
          setState(loadedState);
        } catch (error) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Failed to load work time data",
            message: String(error),
          });
        } finally {
          setIsLoading(false);
        }
      }
  
      loadState();
    }, []);
  
    async function handleSubmit(values: { startDate: Date; endDate: Date; format: string }) {
      if (!state) return;
  
      try {
        const { startDate, endDate, format } = values;
        
        // Filter sessions within the date range
        const filteredSessions = state.sessions.filter((session) => {
          if (!session.endTime) return false;
          return session.startTime >= startDate && session.endTime <= endDate;
        });
  
        // Generate CSV content
        let content = "";
        
        if (format === "csv") {
          content = "Date,Start Time,End Time,Duration (hours),Duration (minutes)\n";
          
          filteredSessions.forEach((session) => {
            if (!session.endTime) return;
            
            const date = formatDateKey(session.startTime);
            const startTime = session.startTime.toLocaleTimeString();
            const endTime = session.endTime.toLocaleTimeString();
            const durationMs = calculateSessionDuration(session);
            const durationHours = durationMs / (1000 * 60 * 60);
            const durationMinutes = durationMs / (1000 * 60);
            
            content += `${date},${startTime},${endTime},${durationHours.toFixed(2)},${durationMinutes.toFixed(0)}\n`;
          });
        } else if (format === "json") {
          const jsonData = filteredSessions.map((session) => {
            if (!session.endTime) return null;
            
            const date = formatDateKey(session.startTime);
            const startTime = session.startTime.toLocaleTimeString();
            const endTime = session.endTime.toLocaleTimeString();
            const durationMs = calculateSessionDuration(session);
            const durationHours = durationMs / (1000 * 60 * 60);
            const durationMinutes = durationMs / (1000 * 60);
            
            return {
              date,
              startTime,
              endTime,
              durationHours: parseFloat(durationHours.toFixed(2)),
              durationMinutes: parseInt(durationMinutes.toFixed(0)),
            };
          }).filter(Boolean);
          
          content = JSON.stringify(jsonData, null, 2);
        }
  
        // Save to file
        const downloadsFolder = path.join(os.homedir(), "Downloads");
        const fileName = `work-time-export-${formatDateKey(startDate)}-to-${formatDateKey(endDate)}.${format}`;
        const filePath = path.join(downloadsFolder, fileName);
        
        fs.writeFileSync(filePath, content);
        
        await showHUD("Export completed successfully");
        await open(filePath);
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Export failed",
          message: String(error),
        });
      }
    }
  
    return (
      <Form
        isLoading={isLoading}
        navigationTitle="Export Work Time Data"
        actions={
          <ActionPanel>
            <Action.SubmitForm title="Export" onSubmit={handleSubmit} />
          </ActionPanel>
        }
      >
        <Form.DatePicker
          id="startDate"
          title="Start Date"
          value={startDate}
          onChange={setStartDate}
        />
        <Form.DatePicker
          id="endDate"
          title="End Date"
          value={endDate}
          onChange={setEndDate}
        />
        <Form.Dropdown id="format" title="Export Format" defaultValue="csv">
          <Form.Dropdown.Item value="csv" title="CSV" />
          <Form.Dropdown.Item value="json" title="JSON" />
        </Form.Dropdown>
      </Form>
    );
  }
  