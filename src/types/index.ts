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
  reward_text: string | null
  created_at: string
}

export type Task = {
  id: string
  child_id: string
  title: string
  recurrence: 'daily' | 'weekdays' | 'weekend' | 'custom'
  days: number[] | null
  points: number
  active: boolean
  created_at: string
}

export type RewardCatalogItem = {
  id: string
  child_id: string
  title: string
  cost_points: number
  active: boolean
  created_at: string
}

export type RewardRedemption = {
  id: string
  child_id: string
  reward_id: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  rewards_catalog?: RewardCatalogItem
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
