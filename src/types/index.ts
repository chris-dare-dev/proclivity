export type TodoScope = "today" | "sprint" | "long";

export interface Todo {
  id: string;
  title: string;
  notes?: string;
  scope: TodoScope;
  done: boolean;
  createdAt: number;
  completedAt?: number;
  dueAt?: number;
  sprintId?: string;
}

export interface Sprint {
  id: string;
  name: string;
  startsAt: number;
  endsAt: number;
}

export interface GanttTask {
  id: string;
  chartId: string;
  parentId?: string;
  title: string;
  startsAt: number;
  endsAt: number;
  /** 0-100 integer. Forced to 100 in the UI when `done` is true. */
  progress: number;
  done: boolean;
  collapsed?: boolean;
  color?: string;
}

export interface GanttChart {
  id: string;
  name: string;
  createdAt: number;
}

export interface Reminder {
  id: string;
  title: string;
  fireAt: number;
  recurrence?: "daily" | "weekly" | "none";
  fired?: boolean;
  linkedTodoId?: string;
}

export interface ProclivityState {
  todos: Todo[];
  sprints: Sprint[];
  activeSprintId?: string;
  ganttCharts: GanttChart[];
  ganttTasks: GanttTask[];
  reminders: Reminder[];
}

export const EMPTY_STATE: ProclivityState = {
  todos: [],
  sprints: [],
  ganttCharts: [],
  ganttTasks: [],
  reminders: [],
};
