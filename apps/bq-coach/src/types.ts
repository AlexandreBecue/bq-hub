export interface Exercise {
  id: string;
  name: string;
  shortName: string;
  type: string;
  category: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipment: string[];
  notes: string;
}

export interface WarmupConfig {
  exerciseId: string;
  workDuration: number;
  restDuration: number;
  distanceM?: number;
  allure?: string;
}

export interface CircuitExercise {
  exerciseId: string;
  workDuration: number;
  restDuration: number;
  type?: string;
  distanceM?: number;
  allure?: string;
}

export interface FinisherExercise {
  exerciseId: string;
  sets: number;
  workDuration: number;
  restDuration: number;
  distanceM?: number;
  allure?: string;
}

export interface StrengthWorkout {
  title: string;
  sequence: string;
  sets: number;
  warmup?: WarmupConfig | null;
  exercises: CircuitExercise[];
  finisher?: FinisherExercise[] | null;
}

export interface CardioWorkout {
  title: string;
  exerciseId: string;
  durationMinutes: number;
  distanceKm?: number;
  detail?: string;
  interval?: number | null;
  sets?: number;
  warmup?: WarmupConfig | null;
  exercises?: CircuitExercise[];
  finisher?: FinisherExercise[] | null;
  notes?: string;
}

export interface DayWorkout {
  type: 'strength' | 'cardio' | 'hybrid' | 'rest';
  strength?: StrengthWorkout;
  cardio?: CardioWorkout;
}

export interface TimelineStep {
  type: 'work' | 'rest';
  exerciseId?: string;
  duration: number;
  index?: number;
  total?: number;
  startSecond?: number;
  endSecond?: number;
}
