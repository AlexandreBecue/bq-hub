export interface BreadcrumbItem  {
  exerciseId: string
  label: string
  firstStepIndex: number
}

export interface Exercise  {
  id: string
  name: string
  shortName: string
  type: string
  category: string
  primaryMuscle: string
  secondaryMuscles: string[]
  equipment: string[]
  notes: string
}

export interface Step {
  type: 'work' | 'rest'
  exerciseId?: string
  duration: number
  index?: number
  total?: number
}
