import {
    Action,
    ActionPanel,
    Color,
    Grid,
    Icon,
    List,
    showToast,
    Toast,
  } from "@raycast/api";
  import { useEffect, useState } from "react";
  import { getWorkTimeState } from "./utils/storage";
  import {
    calculateSessionDuration,
    formatDuration,
    getSessionsByDate,
    calculateDailyBalance,
  } from "./utils/timeCalculations";
  import { WorkTimeState, WorkSession } from "./models/workTime";
  
  export default function CalendarCommand() {
    const [state, setState] = useState<WorkTimeState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
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
      return <Grid isLoading={true} />;
    }
  
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
      isLoading={isLoading}
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
              accessories={[
                {
                  text: session.endTime
                    ? formatDuration(calculateSessionDuration(session))
                    : "Running",
                },
              ]}
            />
          ))
        ) : (
          <List.Item title="No sessions for this day" icon={Icon.XmarkCircle} />
        )}
      </List.Section>
    </List>
  );
}
