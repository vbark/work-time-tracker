import {
    Action,
    ActionPanel,
    Color,
    Detail,
    Icon,
    List,
    showToast,
    Toast,
  } from "@raycast/api";
  import { useState, useEffect } from "react";
  import { getWorkTimeState } from "./utils/storage";
  import {
    calculateSessionDuration,
    formatDuration,
    getSessionsByDate,
    calculateDailyBalance,
    calculateTotalWorkTime,
    calculateTotalBalance,
  } from "./utils/timeCalculations";
  import { WorkTimeState } from "./models/workTime";
  
  export default function ReportsCommand() {
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
            title: "Failed to load work time data",
            message: String(error),
          });
        } finally {
          setIsLoading(false);
        }
      }
  
      loadState();
    }, []);
  
    if (isLoading || !state) {
      return <List isLoading={true} />;
    }
  
    return (
      <List
        isLoading={isLoading}
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
          icon={Icon.ChartLine}
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
    
    const productiveDays = Object.entries(sessionsByDate)
      .map(([dateStr, sessions]) => {
        const totalTime = sessions.reduce(
          (total, session) => total + calculateSessionDuration(session),
          0
        );
        return { date: new Date(dateStr), totalTime };
      })
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, 5);
    
    productiveDays.forEach(({ date, totalTime }) => {
      markdown += `| ${date.toLocaleDateString()} | ${formatDuration(totalTime)} |\n`;
    });
    
    return <Detail markdown={markdown} />;
  }
  
  function WorkPatternsReport({ state }: { state: WorkTimeState }) {
    // Analyze work patterns
    const startTimes: Record<number, number> = {}; // Hour -> count
    const endTimes: Record<number, number> = {}; // Hour -> count
    const dayDistribution: Record<number, number> = {}; // Day of week -> total hours
    
    state.sessions.forEach((session) => {
      if (!session.endTime) return;
      
      // Start time distribution
      const startHour = session.startTime.getHours();
      startTimes[startHour] = (startTimes[startHour] || 0) + 1;
      
      // End time distribution
      const endHour = session.endTime.getHours();
      endTimes[endHour] = (endTimes[endHour] || 0) + 1;
      
      // Day of week distribution
      const dayOfWeek = session.startTime.getDay(); // 0 = Sunday, 6 = Saturday
      const sessionDuration = calculateSessionDuration(session) / (60 * 60 * 1000); // Convert to hours
      dayDistribution[dayOfWeek] = (dayDistribution[dayOfWeek] || 0) + sessionDuration;
    });
    
    // Find most common start and end times
    let mostCommonStartHour = 9; // Default
    let mostCommonStartCount = 0;
    
    let mostCommonEndHour = 17; // Default
    let mostCommonEndCount = 0;
    
    Object.entries(startTimes).forEach(([hour, count]) => {
      if (count > mostCommonStartCount) {
        mostCommonStartHour = parseInt(hour);
        mostCommonStartCount = count;
      }
    });
    
    Object.entries(endTimes).forEach(([hour, count]) => {
      if (count > mostCommonEndCount) {
        mostCommonEndHour = parseInt(hour);
        mostCommonEndCount = count;
      }
    });
    
    // Find most productive day
    let mostProductiveDay = 1; // Default to Monday
    let mostProductiveHours = 0;
    
    Object.entries(dayDistribution).forEach(([day, hours]) => {
      if (hours > mostProductiveHours) {
        mostProductiveDay = parseInt(day);
        mostProductiveHours = hours;
      }
    });
    
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    // Generate ASCII charts for the report
    const generateASCIIChart = (data: Record<number, number>, maxValue: number, labels: string[]) => {
      let chart = "";
      
      Object.entries(data).forEach(([key, value]) => {
        const index = parseInt(key);
        const barLength = Math.round((value / maxValue) * 20);
        const bar = "█".repeat(barLength);
        chart += `| ${labels[index].padEnd(10)} | ${"█".repeat(barLength).padEnd(20)} | ${value.toFixed(1)} |\n`;
      });
      
      return chart;
    };
    
    // Generate markdown for the report
    let markdown = `# Work Patterns Analysis\n\n`;
    
    markdown += `## Overview\n\n`;
    markdown += `- **Most common start time:** ${mostCommonStartHour}:00 (${mostCommonStartCount} times)\n`;
    markdown += `- **Most common end time:** ${mostCommonEndHour}:00 (${mostCommonEndCount} times)\n`;
    markdown += `- **Most productive day:** ${dayNames[mostProductiveDay]} (${mostProductiveHours.toFixed(1)} hours)\n\n`;
    
    markdown += `## Start Time Distribution\n\n`;
    markdown += `| Hour | Distribution | Count |\n`;
    markdown += `| ---- | ------------ | ----- |\n`;
    
    const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const maxStartCount = Math.max(...Object.values(startTimes));
    
    for (let hour = 6; hour <= 12; hour++) {
      const count = startTimes[hour] || 0;
      const barLength = Math.round((count / maxStartCount) * 20);
      markdown += `| ${hourLabels[hour].padEnd(5)} | ${"█".repeat(barLength).padEnd(20)} | ${count} |\n`;
    }
    
    markdown += `\n## End Time Distribution\n\n`;
    markdown += `| Hour | Distribution | Count |\n`;
    markdown += `| ---- | ------------ | ----- |\n`;
    
    const maxEndCount = Math.max(...Object.values(endTimes));
    
    for (let hour = 15; hour <= 21; hour++) {
      const count = endTimes[hour] || 0;
      const barLength = Math.round((count / maxEndCount) * 20);
      markdown += `| ${hourLabels[hour].padEnd(5)} | ${"█".repeat(barLength).padEnd(20)} | ${count} |\n`;
    }
    
    markdown += `\n## Day of Week Distribution\n\n`;
    markdown += `| Day | Distribution | Hours |\n`;
    markdown += `| --- | ------------ | ----- |\n`;
    
    const maxDayHours = Math.max(...Object.values(dayDistribution));
    
    for (let day = 1; day <= 5; day++) { // Monday to Friday
      const hours = dayDistribution[day] || 0;
      const barLength = Math.round((hours / maxDayHours) * 20);
      markdown += `| ${dayNames[day].padEnd(9)} | ${"█".repeat(barLength).padEnd(20)} | ${hours.toFixed(1)} |\n`;
    }
    
    return <Detail markdown={markdown} />;
  }  