export type Family = {
  id: string
  parent_id: string
  family_pin: string
  created_at: string
}

export type Child = {
  id: string
  family_id: string
  name: string
  avatar_color: string
  created_at: string
}

export type Task = {
  id: string
  child_id: string
  title: string
  recurrence: 'daily' | 'weekdays' | 'weekend' | 'custom'
  days: number[] | null
  active: boolean
  created_at: string
}

export type TaskCompletion = {
  id: string
  task_id: string
  child_id: string
  date: string
  completed_at: string
  created_at: string
}

export type TaskWithCompletion = Task & {
  completed_today: boolean
  completion_id?: string
}

export type ChildWithProgress = Child & {
  tasks: TaskWithCompletion[]
  total_tasks: number
  completed_tasks: number
  all_done: boolean
}
