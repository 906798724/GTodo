export type TaskStatus = 'todo' | 'wip' | 'waited' | 'done';

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  parent_id: number | null;
  expected_date: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Column {
  id: TaskStatus;
  title: string;
  color: string;
  icon: string;
}

export const COLUMNS: Column[] = [
  { id: 'todo', title: 'Todo', color: '#9e9e9e', icon: '📝' },
  { id: 'wip', title: 'WIP', color: '#2196f3', icon: '⚡' },
  { id: 'waited', title: 'Waited', color: '#ff9800', icon: '⏳' },
  { id: 'done', title: 'Done', color: '#4caf50', icon: '✅' },
];
