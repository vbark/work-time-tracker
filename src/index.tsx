import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  Toast,
  showToast,
  getPreferenceValues,
  openCommandPreferences,
  Form,
  open,
  showHUD,
  Grid,
  Detail,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { getWorkTimeState, saveWorkTimeState } from "./utils/storage";
import {
  calculateSessionDuration,
  calculateTotalWorkTime,
  calculateTotalBalance,
  formatDuration,
  formatDateKey,
  getSessionsByDate,
  calculateDailyBalance,
} from "./utils/timeCalculations";
import { WorkTimeState, WorkSession } from "./models/workTime";
import fs from "fs";
import path from "path";
import os from "os";

export default function Command() {
  const [state, setState] = useState<WorkTimeState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [exportStartDate, setExportStartDate] = useState<Date>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [exportEndDate, setExportEndDate] = useState<Date>(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
  );
  const [exportFormat, setExportFormat] = useState<string>("csv");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [customStartDate, setCustomStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setHours(date.getHours() - 1);
    return date;
  });
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [isCompletedSession, setIsCompletedSession] = useState(false);

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

  // Timer functions
  async function startTimer() {
    if (!state) return;

    if (state.currentSession) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Timer already running",
        message: "Stop the current timer before starting a new one",
      });
      return;
    }

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
    setState(newState);

    await showToast({
      style: Toast.Style.Success,
      title: "Timer started",
      message: `Started at ${newSession.startTime.toLocaleTimeString()}`,
    });
  }

  async function stopTimer() {
    if (!state || !state.currentSession) {
      await showToast({
        style: Toast.Style.Failure,
        title: "No timer running",
        message: "Start a timer first",
      });
      return;
    }

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
    setState(newState);

    const duration = calculateSessionDuration(endedSession);

    await showToast({
      style: Toast.Style.Success,
      title: "Timer stopped",
      message: `Duration: ${formatDuration(duration)}`,
    });
  }

  // Custom time functions
  async function handleCustomTimeSubmit() {
    if (!state) return;

    try {
      // Check if timer is already running and we're trying to start a new active session
      if (state.currentSession && !isCompletedSession) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Timer already running",
          message: "Stop the current timer before starting a new one",
        });
        setSelectedAction(null);
        return;
      }

      const now = new Date();

      // For active sessions, don't allow future start times
      if (!isCompletedSession && customStartDate > now) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Invalid start time",
          message: "Start time cannot be in the future for active sessions",
        });
        return;
      }

      // For completed sessions, validate end time is after start time
      if (isCompletedSession) {
        if (customEndDate <= customStartDate) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Invalid end time",
            message: "End time must be after start time",
          });
          return;
        }

        // For completed sessions, don't allow future end times
        if (customEndDate > now) {
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
        startTime: customStartDate,
        endTime: isCompletedSession ? customEndDate : null,
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

      setSelectedAction(null);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to add session",
        message: String(error),
      });
    }
  }

  // Export function
  async function handleExport() {
    if (!state) return;

    try {
      const filteredSessions = state.sessions.filter((session) => {
        if (!session.endTime) return false;
        return session.startTime >= exportStartDate && session.endTime <= exportEndDate;
      });

      let content = "";
      
      if (exportFormat === "csv") {
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
      } else if (exportFormat === "json") {
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

      const downloadsFolder = path.join(os.homedir(), "Downloads");
      const fileName = `work-time-export-${formatDateKey(exportStartDate)}-to-${formatDateKey(exportEndDate)}.${exportFormat}`;
      const filePath = path.join(downloadsFolder, fileName);
      
      fs.writeFileSync(filePath, content);
      
      await showHUD("Export completed successfully");
      await open(filePath);
      setSelectedAction(null);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Export failed",
        message: String(error),
      });
    }
  }

  if (isLoading || !state) {
    return <List isLoading={true} />;
  }

  // Render different views based on selected action
  if (selectedAction === "calendar") {
    return <CalendarView state={state} selectedMonth={selectedMonth} selectedYear={selectedYear} 
      setSelectedMonth={setSelectedMonth} setSelectedYear={setSelectedYear} />;
  }

  if (selectedAction === "reports") {
    return <ReportsView state={state} />;
  }

  if (selectedAction === "export") {
    return (
      <Form
        navigationTitle="Export Work Time Data"
        actions={
          <ActionPanel>
            <Action.SubmitForm title="Export" onSubmit={handleExport} />
            <Action title="Back" icon={Icon.ArrowLeft} onAction={() => setSelectedAction(null)} />
          </ActionPanel>
        }
      >
        <Form.DatePicker
          id="startDate"
          title="Start Date"
          value={exportStartDate}
          onChange={(date) => date && setExportStartDate(date)}
        />
        <Form.DatePicker
          id="endDate"
          title="End Date"
          value={exportEndDate}
          onChange={(date) => date && setExportEndDate(date)}
        />
        <Form.Dropdown id="format" title="Export Format" value={exportFormat} onChange={setExportFormat}>
          <Form.Dropdown.Item value="csv" title="CSV" />
          <Form.Dropdown.Item value="json" title="JSON" />
        </Form.Dropdown>
      </Form>
    );
  }

  if (selectedAction === "custom-time") {
    return (
      <Form
        navigationTitle="Add Work Session"
        actions={
          <ActionPanel>
            <Action.SubmitForm 
              title={isCompletedSession ? "Add Completed Session" : "Start Timer"} 
              onSubmit={handleCustomTimeSubmit}
            />
            <Action title="Back" icon={Icon.ArrowLeft} onAction={() => setSelectedAction(null)} />
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
          value={customStartDate}
          onChange={(date) => date && setCustomStartDate(date)}
          type={Form.DatePicker.Type.DateTime}
        />
        
        {isCompletedSession && (
          <Form.DatePicker
            id="endDate"
            title="End Time"
            value={customEndDate}
            onChange={(date) => date && setCustomEndDate(date)}
            type={Form.DatePicker.Type.DateTime}
          />
        )}
      </Form>
    );
  }

  const totalWorkTime = calculateTotalWorkTime(state.sessions);
  const totalBalance = calculateTotalBalance(state.sessions, state.dailyTargets, state.defaultTargetHours);
  const totalBalanceHours = Math.floor(Math.abs(totalBalance));
  const totalBalanceMinutes = Math.floor((Math.abs(totalBalance) % 1) * 60);
  const balanceSign = totalBalance >= 0 ? "+" : "-";

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search actions..."
      actions={
        <ActionPanel>
          <Action
            title={state.currentSession ? "Stop Timer" : "Start Timer"}
            icon={state.currentSession ? Icon.Stop : Icon.Play}
            onAction={state.currentSession ? stopTimer : startTimer}
          />
          <Action title="Settings" icon={Icon.Gear} onAction={() => openCommandPreferences()} />
        </ActionPanel>
      }
    >
      <List.Section title="Timer Actions">
        <List.Item
          title={state.currentSession ? "Stop Timer" : "Start Timer"}
          icon={state.currentSession ? Icon.Stop : Icon.Play}
          accessories={[
            {
              text: state.currentSession
                ? `Started at ${state.currentSession.startTime.toLocaleTimeString()}`
                : "Not running",
            },
          ]}
          actions={
            <ActionPanel>
              <Action
                title={state.currentSession ? "Stop Timer" : "Start Timer"}
                icon={state.currentSession ? Icon.Stop : Icon.Play}
                onAction={state.currentSession ? stopTimer : startTimer}
              />
            </ActionPanel>
          }
        />
        <List.Item
          title="Start Custom Time"
          icon={Icon.Clock}
          accessories={[{ text: "Start timer with custom time or add completed session" }]}
          actions={
            <ActionPanel>
              <Action title="Custom Time" icon={Icon.Clock} onAction={() => setSelectedAction("custom-time")} />
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title="Views">
        <List.Item
          title="Calendar"
          icon={Icon.Calendar}
          accessories={[{ text: "View work time calendar" }]}
          actions={
            <ActionPanel>
              <Action title="Open Calendar" icon={Icon.Calendar} onAction={() => setSelectedAction("calendar")} />
            </ActionPanel>
          }
        />
        <List.Item
          title="Reports"
          icon={Icon.LineChart}
          accessories={[{ text: "View work time reports" }]}
          actions={
            <ActionPanel>
              <Action title="Open Reports" icon={Icon.LineChart} onAction={() => setSelectedAction("reports")} />
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title="Tools">
        <List.Item
          title="Export Data"
          icon={Icon.Download}
          accessories={[{ text: "Export work time data" }]}
          actions={
            <ActionPanel>
              <Action title="Export" icon={Icon.Download} onAction={() => setSelectedAction("export")} />
            </ActionPanel>
          }
        />
        <List.Item
          title="Settings"
          icon={Icon.Gear}
          accessories={[{ text: "Configure preferences" }]}
          actions={
            <ActionPanel>
              <Action title="Open Settings" icon={Icon.Gear} onAction={() => openCommandPreferences()} />
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title="Summary">
        <List.Item title="Total Work Time" icon={Icon.Clock} accessories={[{ text: formatDuration(totalWorkTime) }]} />
        <List.Item
          title="Balance"
          icon={totalBalance >= 0 ? Icon.Plus : Icon.Minus}
          accessories={[
            {
              text: `${balanceSign}${totalBalanceHours}h ${totalBalanceMinutes}m`,
              icon: totalBalance >= 0 ? Icon.Plus : Icon.Minus,
            },
          ]}
        />
      </List.Section>

      <List.Section title="Recent Sessions">
        {state.sessions
          .slice()
          .reverse()
          .slice(0, 5)
          .map((session) => (
            <List.Item
              key={session.id}
              title={session.startTime.toLocaleDateString()}
              subtitle={`${session.startTime.toLocaleTimeString()} - ${
                session.endTime ? session.endTime.toLocaleTimeString() : "Running"
              }`}
              accessories={[
                {
                  text: session.endTime ? formatDuration(calculateSessionDuration(session)) : "Running",
                },
              ]}
            />
          ))}
      </List.Section>
    </List>
  );
}

function CalendarView({ 
  state, 
  selectedMonth, 
  selectedYear, 
  setSelectedMonth, 
  setSelectedYear 
}: { 
  state: WorkTimeState;
  selectedMonth: number;
  selectedYear: number;
  setSelectedMonth: (month: number) => void;
  setSelectedYear: (year: number) => void;
}) {
  const sessionsByDate = getSessionsByDate(state.sessions);
  const dailyBalances = calculateDailyBalance(
    state.sessions,
    state.dailyTargets,
    state.defaultTargetHours
  );

  // Generate calendar days for the selected month
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1).getDay();
  
  // Adjust for week starting on Monday (0 = Monday, 6 = Sunday)
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  
  const calendarDays: { date: Date | null; sessions?: WorkSession[] }[] = [];
  
  // Add empty slots for days before the first day of the month
  for (let i = 0; i < adjustedFirstDay; i++) {
    calendarDays.push({ date: null });
  }
  
  // Add actual days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(selectedYear, selectedMonth, day);
    const dateKey = date.toISOString().split("T")[0];
    calendarDays.push({
      date,
      sessions: sessionsByDate[dateKey] || [],
    });
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <Grid
      columns={7}
      inset={Grid.Inset.Medium}
      navigationTitle="Work Time Calendar"
      searchBarPlaceholder="Search by date"
      actions={
        <ActionPanel>
          <Action
            title="Previous Month"
            icon={Icon.ArrowLeft}
            onAction={() => {
              if (selectedMonth === 0) {
                setSelectedMonth(11);
                setSelectedYear(selectedYear - 1);
              } else {
                setSelectedMonth(selectedMonth - 1);
              }
            }}
          />
          <Action
            title="Next Month"
            icon={Icon.ArrowRight}
            onAction={() => {
              if (selectedMonth === 11) {
                setSelectedMonth(0);
                setSelectedYear(selectedYear + 1);
              } else {
                setSelectedMonth(selectedMonth + 1);
              }
            }}
          />
          <Action
            title="Today"
            icon={Icon.Calendar}
            onAction={() => {
              setSelectedMonth(new Date().getMonth());
              setSelectedYear(new Date().getFullYear());
            }}
          />
        </ActionPanel>
      }
    >
      <Grid.Section title={`${monthNames[selectedMonth]} ${selectedYear}`}>
        {/* Weekday headers */}
        {weekDays.map((day, index) => (
          <Grid.Item
            key={`header-${index}`}
            content={{ source: Icon.Dot, tintColor: Color.SecondaryText }}
            title={day}
          />
        ))}

        {/* Calendar days */}
        {calendarDays.map((dayData, index) => {
          if (!dayData.date) {
            return <Grid.Item key={`empty-${index}`} content={{ source: Icon.Circle }} />;
          }

          const dateKey = dayData.date.toISOString().split("T")[0];
          const dayOfMonth = dayData.date.getDate();
          const isToday =
            dayData.date.getDate() === new Date().getDate() &&
            dayData.date.getMonth() === new Date().getMonth() &&
            dayData.date.getFullYear() === new Date().getFullYear();

          const totalDuration = (dayData.sessions || []).reduce(
            (total, session) => total + calculateSessionDuration(session),
            0
          );

          const balance = dailyBalances[dateKey] || 0;
          const balanceColor = balance >= 0 ? Color.Green : Color.Red;

          return (
            <Grid.Item
              key={`day-${index}`}
              content={{
                source: isToday ? Icon.Dot : Icon.Circle,
                tintColor: isToday ? Color.Blue : (totalDuration > 0 ? Color.Green : Color.SecondaryText),
              }}
              title={String(dayOfMonth)}
              subtitle={totalDuration > 0 ? formatDuration(totalDuration) : undefined}
              actions={
                <ActionPanel>
                  <Action.Push
                    title="View Day Details"
                    target={
                      <DayDetailView
                        date={dayData.date}
                        sessions={dayData.sessions || []}
                        targetHours={
                          state.dailyTargets.find((t) => t.date === dateKey)?.targetHours ||
                          state.defaultTargetHours
                        }
                      />
                    }
                  />
                </ActionPanel>
              }
            />
          );
        })}
      </Grid.Section>
    </Grid>
  );
}

function DayDetailView({
  date,
  sessions,
  targetHours,
}: {
  date: Date;
  sessions: WorkSession[];
  targetHours: number;
}) {
  const totalDuration = sessions.reduce(
    (total, session) => total + calculateSessionDuration(session),
    0
  );
  
  const totalHours = totalDuration / (1000 * 60 * 60);
  const balance = totalHours - targetHours;
  
  const formattedDate = date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <List navigationTitle={formattedDate}>
      <List.Section title="Summary">
        <List.Item
          title="Total Work Time"
          icon={Icon.Clock}
          accessories={[{ text: formatDuration(totalDuration) }]}
        />
        <List.Item
          title="Target Hours"
          icon={Icon.BullsEye}
          accessories={[{ text: `${targetHours}h` }]}
        />
        <List.Item
          title="Balance"
          icon={balance >= 0 ? Icon.Plus : Icon.Minus}
          accessories={[
            {
              text: `${balance >= 0 ? "+" : ""}${balance.toFixed(2)}h`,
              icon: balance >= 0 ? Icon.Plus : Icon.Minus,
            },
          ]}
        />
      </List.Section>

      <List.Section title="Sessions">
        {sessions.length > 0 ? (
          sessions.map((session) => (
            <List.Item
              key={session.id}
              title={`${session.startTime.toLocaleTimeString()} - ${
                session.endTime ? session.endTime.toLocaleTimeString() : "Running"
              }`}
              icon={Icon.Clock}
              accessories={[
                {
                  text: session.endTime ? formatDuration(calculateSessionDuration(session)) : "Running",
                },
              ]}
            />
          ))
        ) : (
          <List.Item
            title="No sessions"
            icon={Icon.XmarkCircle}
          />
        )}
      </List.Section>
    </List>
  );
}

function ReportsView({ state }: { state: WorkTimeState }) {
  return (
    <List
      navigationTitle="Work Time Reports"
      searchBarPlaceholder="Search reports"
    >
      <List.Item
        title="Weekly Summary"
        icon={Icon.Calendar}
        actions={
          <ActionPanel>
            <Action.Push
              title="View Weekly Summary"
              target={<WeeklySummaryReport state={state} />}
            />
          </ActionPanel>
        }
      />
      <List.Item
        title="Monthly Summary"
        icon={Icon.Calendar}
        actions={
          <ActionPanel>
            <Action.Push
              title="View Monthly Summary"
              target={<MonthlySummaryReport state={state} />}
            />
          </ActionPanel>
        }
      />
      <List.Item
        title="Work Patterns"
        icon={Icon.LineChart}
        actions={
          <ActionPanel>
            <Action.Push
              title="View Work Patterns"
              target={<WorkPatternsReport state={state} />}
            />
          </ActionPanel>
        }
      />
    </List>
  );
}

function WeeklySummaryReport({ state }: { state: WorkTimeState }) {
  // Get the current week's start (Monday) and end (Sunday)
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
  const startOfWeek = new Date(today);
  // If today is Sunday (0), go back 6 days to get to Monday
  // Otherwise, go back (dayOfWeek - 1) days
  startOfWeek.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  // Filter sessions for the current week
  const weekSessions = state.sessions.filter(
    (session) => session.startTime >= startOfWeek && session.startTime <= endOfWeek
  );
  
  const sessionsByDate = getSessionsByDate(weekSessions);
  const dailyBalances = calculateDailyBalance(
    weekSessions,
    state.dailyTargets,
    state.defaultTargetHours
  );
  
  const totalWorkTime = calculateTotalWorkTime(weekSessions);
  const totalBalance = calculateTotalBalance(
    weekSessions,
    state.dailyTargets,
    state.defaultTargetHours
  );
  
  // Generate markdown for the report
  let markdown = `# Weekly Summary\n\n`;
  markdown += `**${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}**\n\n`;
  
  markdown += `## Overview\n\n`;
  markdown += `- **Total Work Time:** ${formatDuration(totalWorkTime)}\n`;
  markdown += `- **Target Time:** ${state.defaultTargetHours * 5}h (assuming 5 workdays)\n`;
  markdown += `- **Balance:** ${totalBalance >= 0 ? "+" : ""}${totalBalance.toFixed(2)}h\n\n`;
  
  markdown += `## Daily Breakdown\n\n`;
  markdown += `| Day | Date | Work Time | Target | Balance |\n`;
  markdown += `| --- | ---- | --------- | ------ | ------- |\n`;
  
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const dateKey = date.toISOString().split("T")[0];
    
    const daySessions = sessionsByDate[dateKey] || [];
    const dayWorkTime = daySessions.reduce(
      (total, session) => total + calculateSessionDuration(session),
      0
    );
    
    const dayTarget = state.dailyTargets.find((t) => t.date === dateKey)?.targetHours || 
      (i < 5 ? state.defaultTargetHours : 0); // Assume weekends have 0 target unless specified
    
    const dayBalance = dailyBalances[dateKey] || 0;
    
    markdown += `| ${dayNames[i]} | ${date.toLocaleDateString()} | ${formatDuration(dayWorkTime)} | ${dayTarget}h | ${dayBalance >= 0 ? "+" : ""}${dayBalance.toFixed(2)}h |\n`;
  }
  
  return <Detail markdown={markdown} />;
}

function MonthlySummaryReport({ state }: { state: WorkTimeState }) {
  // Get the current month's start and end
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
  
  // Filter sessions for the current month
  const monthSessions = state.sessions.filter(
    (session) => session.startTime >= startOfMonth && session.startTime <= endOfMonth
  );
  
  const sessionsByDate = getSessionsByDate(monthSessions);
  const dailyBalances = calculateDailyBalance(
    monthSessions,
    state.dailyTargets,
    state.defaultTargetHours
  );
  
  const totalWorkTime = calculateTotalWorkTime(monthSessions);

  // Count working days in the month (Monday-Friday)
  let workingDaysInMonth = 0;
  const currentDate = new Date(startOfMonth);
  while (currentDate <= endOfMonth) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday to Friday
      workingDaysInMonth++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  const targetMonthlyHours = workingDaysInMonth * state.defaultTargetHours;
  const totalMonthlyBalance = calculateTotalBalance(
    monthSessions,
    state.dailyTargets,
    state.defaultTargetHours
  );
  
  // Generate markdown for the report
  let markdown = `# Monthly Summary\n\n`;
  markdown += `**${startOfMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}**\n\n`;
  
  markdown += `## Overview\n\n`;
  markdown += `- **Total Work Time:** ${formatDuration(totalWorkTime)}\n`;
  markdown += `- **Working Days:** ${workingDaysInMonth}\n`;
  markdown += `- **Target Time:** ${targetMonthlyHours}h\n`;
  markdown += `- **Balance:** ${totalMonthlyBalance >= 0 ? "+" : ""}${totalMonthlyBalance.toFixed(2)}h\n\n`;
  
  markdown += `## Weekly Breakdown\n\n`;
  markdown += `| Week | Work Time | Target | Balance |\n`;
  markdown += `| ---- | --------- | ------ | ------- |\n`;
  
  // Group by week
  const weeklyData: Record<number, { workTime: number; target: number }> = {};
  
  Object.entries(sessionsByDate).forEach(([dateStr, sessions]) => {
    const date = new Date(dateStr);
    const weekNumber = Math.ceil((date.getDate() + (new Date(date.getFullYear(), date.getMonth(), 1).getDay() - 1)) / 7);
    
    if (!weeklyData[weekNumber]) {
      weeklyData[weekNumber] = { workTime: 0, target: 0 };
    }
    
    const dayWorkTime = sessions.reduce(
      (total, session) => total + calculateSessionDuration(session),
      0
    );
    
    weeklyData[weekNumber].workTime += dayWorkTime;
    
    const dayOfWeek = date.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday to Friday
      const targetHours = state.dailyTargets.find((t) => t.date === dateStr)?.targetHours || 
        state.defaultTargetHours;
      weeklyData[weekNumber].target += targetHours * 60 * 60 * 1000; // Convert hours to ms
    }
  });
  
  Object.entries(weeklyData).forEach(([weekNumber, data]) => {
    const weekBalance = (data.workTime - data.target) / (60 * 60 * 1000); // Convert ms to hours
    markdown += `| Week ${weekNumber} | ${formatDuration(data.workTime)} | ${(data.target / (60 * 60 * 1000)).toFixed(1)}h | ${weekBalance >= 0 ? "+" : ""}${weekBalance.toFixed(2)}h |\n`;
  });
  
  markdown += `\n## Top 5 Most Productive Days\n\n`;
  markdown += `| Date | Work Time |\n`;
  markdown += `| ---- | --------- |\n`;
  
  const sortedDays = Object.entries(sessionsByDate)
    .map(([date, sessions]) => ({
      date,
      workTime: sessions.reduce((total, session) => total + calculateSessionDuration(session), 0),
    }))
    .sort((a, b) => b.workTime - a.workTime)
    .slice(0, 5);
  
  sortedDays.forEach(({ date, workTime }) => {
    markdown += `| ${new Date(date).toLocaleDateString()} | ${formatDuration(workTime)} |\n`;
  });

  return <Detail markdown={markdown} />;
}

function WorkPatternsReport({ state }: { state: WorkTimeState }) {
  // Calculate average start and end times for workdays
  const workdaySessions = state.sessions.filter((session) => {
    const dayOfWeek = session.startTime.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
  });

  const startTimes = workdaySessions.map((session) => session.startTime.getHours() * 60 + session.startTime.getMinutes());
  const endTimes = workdaySessions
    .filter((session) => session.endTime)
    .map((session) => session.endTime!.getHours() * 60 + session.endTime!.getMinutes());

  const avgStartTime = startTimes.reduce((a, b) => a + b, 0) / startTimes.length;
  const avgEndTime = endTimes.reduce((a, b) => a + b, 0) / endTimes.length;

  // Calculate work duration distribution
  const durations = workdaySessions
    .filter((session) => session.endTime)
    .map((session) => calculateSessionDuration(session) / (1000 * 60 * 60)); // Convert to hours

  const durationDistribution: Record<string, number> = {
    "< 4h": 0,
    "4-6h": 0,
    "6-8h": 0,
    "8-10h": 0,
    "> 10h": 0,
  };

  durations.forEach((duration) => {
    if (duration < 4) durationDistribution["< 4h"]++;
    else if (duration < 6) durationDistribution["4-6h"]++;
    else if (duration < 8) durationDistribution["6-8h"]++;
    else if (duration < 10) durationDistribution["8-10h"]++;
    else durationDistribution["> 10h"]++;
  });

  // Calculate day of week distribution
  const dayDistribution = {
    Monday: 0,
    Tuesday: 0,
    Wednesday: 0,
    Thursday: 0,
    Friday: 0,
  };

  workdaySessions.forEach((session) => {
    const dayOfWeek = session.startTime.getDay();
    const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek];
    if (dayName in dayDistribution) {
      dayDistribution[dayName as keyof typeof dayDistribution]++;
    }
  });

  const generateASCIIChart = (data: Record<string, number>, maxValue: number, labels: string[]) => {
    const chartWidth = 20;
    const chart: string[] = [];

    labels.forEach((label) => {
      const value = data[label];
      const barLength = Math.round((value / maxValue) * chartWidth);
      const bar = "█".repeat(barLength) + "░".repeat(chartWidth - barLength);
      chart.push(`${label.padEnd(12)} │ ${bar} ${value}`);
    });

    return chart.join("\n");
  };

  const markdown = `# Work Patterns Analysis

## Average Work Schedule
- Start Time: ${Math.floor(avgStartTime / 60)}:${String(Math.round(avgStartTime % 60)).padStart(2, "0")}
- End Time: ${Math.floor(avgEndTime / 60)}:${String(Math.round(avgEndTime % 60)).padStart(2, "0")}

## Work Duration Distribution
\`\`\`
${generateASCIIChart(
  durationDistribution,
  Math.max(...Object.values(durationDistribution)),
  ["< 4h", "4-6h", "6-8h", "8-10h", "> 10h"]
)}
\`\`\`

## Day of Week Distribution
\`\`\`
${generateASCIIChart(
  dayDistribution,
  Math.max(...Object.values(dayDistribution)),
  ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
)}
\`\`\`
`;

  return <Detail markdown={markdown} />;
}
