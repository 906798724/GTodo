export type TaskStatus = 'todo' | 'wip' | 'waited' | 'done';

export interface Tag {
  id: number;
  name: string;
  color: string;
  is_preset: number;
  sort_order: number;
  created_at: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  parent_id: number | null;
  extends_task_id: number | null;
  expected_date: string | null;
  created_at: string;
  completed_at: string | null;
  archived_at: string | null;
  tags?: Tag[];
}

export interface Column {
  id: TaskStatus;
  title: string;
  color: string;
  icon: string;
}

export const MAIN_COLUMNS: Column[] = [
  { id: 'todo', title: '收集箱', color: '#9e9e9e', icon: '📝' },
  { id: 'wip', title: '进行中', color: '#2196f3', icon: '⚡' },
  { id: 'waited', title: '等待', color: '#ff9800', icon: '⏳' },
  { id: 'done', title: 'Done', color: '#4caf50', icon: '✅' },
];