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
  } from "./utils/timeCalculations";
  import StartCustomTimeCommand from "./start-custom-time";
  import { WorkTimeState, WorkSession } from "./models/workTime";
  
  export default function Command() {
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
    async function deleteSession(sessionId: string) {
      if (!state) return;
      
      // Show confirmation toast
      const options: Toast.Options = {
        style: Toast.Style.Animated,
        title: "Confirm Deletion",
        message: "Are you sure you want to delete this session?",
        primaryAction: {
          title: "Delete",
          onAction: async () => {
            // Filter out the session with the given ID
            const newSessions = state.sessions.filter(session => session.id !== sessionId);
            
            const newState = {
              ...state,
              sessions: newSessions,
            };
            
            await saveWorkTimeState(newState);
            setState(newState);
            
            await showToast({
              style: Toast.Style.Success,
              title: "Session deleted",
            });
          },
        },
        secondaryAction: {
          title: "Cancel",
          onAction: () => {},
        },
      };
      
      await showToast(options);
    }

  
    if (isLoading || !state) {
      return <List isLoading={true} />;
    }
  
    const totalWorkTime = calculateTotalWorkTime(state.sessions);
    const totalBalance = calculateTotalBalance(
      state.sessions,
      state.dailyTargets,
      state.defaultTargetHours
    );
    
    const totalBalanceHours = Math.floor(Math.abs(totalBalance));
    const totalBalanceMinutes = Math.floor((Math.abs(totalBalance) % 1) * 60);
    const balanceSign = totalBalance >= 0 ? "+" : "-";
  
    return (
      <List
        isLoading={isLoading}
        searchBarPlaceholder="Search work sessions"
        actions={
          <ActionPanel>
            <Action
              title={state.currentSession ? "Stop Timer" : "Start Timer"}
              icon={state.currentSession ? Icon.Stop : Icon.Play}
              onAction={state.currentSession ? stopTimer : startTimer}
            />
            {!state.currentSession && (
              <Action.Push
                title="Start Timer with Custom Time"
                icon={Icon.Clock}
                target={<StartCustomTimeCommand />}
                shortcut={{ modifiers: ["cmd"], key: "t" }}
              />
            )}
            <Action
              title="Settings"
              icon={Icon.Gear}
              onAction={() => openCommandPreferences()}
            />
          </ActionPanel>
        }
      >
        <List.Section title="Current Status">
          <List.Item
            title={state.currentSession ? "Timer Running" : "Timer Stopped"}
            icon={
              state.currentSession
                ? { source: Icon.Clock, tintColor: Color.Green }
                : { source: Icon.Clock, tintColor: Color.Red }
            }
            accessories={
              state.currentSession
                ? [
                    {
                      text: `Started at ${state.currentSession.startTime.toLocaleTimeString()}`,
                    },
                  ]
                : []
            }
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
        </List.Section>
  
        <List.Section title="Summary">
          <List.Item
            title="Total Work Time"
            icon={Icon.Clock}
            accessories={[{ text: formatDuration(totalWorkTime) }]}
          />
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
                  text: session.endTime
                    ? formatDuration(calculateSessionDuration(session))
                    : "Running",
                },
              ]}
              actions={
                <ActionPanel>
                  <Action
                    title="Delete Session"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    onAction={() => deleteSession(session.id)}
                  />
                </ActionPanel>
              }
            />
          ))}
      </List.Section>

      </List>
    );
  }
  