import type { Exercise, DayWorkout } from '../types';

export interface WorkoutTemplateData {
  id: string;
  nom: string;
  type: 'Renfo' | 'Cardio' | 'Hybride' | 'Repos';
  description: string;
  workout: DayWorkout;
}

export const DEFAULT_EXERCISES: Exercise[] = [
  {
    "id": "classic_pushup",
    "name": "Pompes classiques",
    "shortName": "Pompes",
    "type": "dynamic",
    "category": "push",
    "primaryMuscle": "pectoraux",
    "secondaryMuscles": ["triceps", "épaules"],
    "equipment": ["Poignées"],
    "notes": "Amplitude complète, gainage actif"
  },
  {
    "id": "decline_pushup",
    "name": "Pompes déclinées",
    "shortName": "Pompes",
    "type": "dynamic",
    "category": "push",
    "primaryMuscle": "pectoraux",
    "secondaryMuscles": ["triceps", "épaules"],
    "equipment": ["Poignées", "Banc"],
    "notes": "Charge plus importante sur le haut des pecs"
  },
  {
    "id": "close_pushup",
    "name": "Pompes serrées",
    "shortName": "Pompes",
    "type": "dynamic",
    "category": "push",
    "primaryMuscle": "triceps",
    "secondaryMuscles": ["pectoraux", "épaules"],
    "equipment": ["Poignées"],
    "notes": "Coudes près du corps"
  },
  {
    "id": "wide_pushup_hold",
    "name": "Pompe large statique",
    "shortName": "Pompe",
    "type": "static",
    "category": "push",
    "primaryMuscle": "pectoraux",
    "secondaryMuscles": ["épaules"],
    "equipment": ["Poignées"],
    "notes": "Bras écartés, position basse"
  },
  {
    "id": "bench_dips",
    "name": "Dips",
    "shortName": "Dips",
    "type": "dynamic",
    "category": "push",
    "primaryMuscle": "triceps",
    "secondaryMuscles": ["pectoraux", "épaules"],
    "equipment": ["Banc"],
    "notes": "Épaules basses, descente contrôlée"
  },
  {
    "id": "classic_squat",
    "name": "Squats classiques",
    "shortName": "Squats",
    "type": "dynamic",
    "category": "legs",
    "primaryMuscle": "quadriceps",
    "secondaryMuscles": ["fessiers", "ischios"],
    "equipment": [],
    "notes": "Dos droit, poussée par les talons"
  },
  {
    "id": "sumo_squat",
    "name": "Squats sumo",
    "shortName": "Squats",
    "type": "dynamic",
    "category": "legs",
    "primaryMuscle": "adducteurs",
    "secondaryMuscles": ["quadriceps", "fessiers"],
    "equipment": ["Tapis"],
    "notes": "Pieds très ouverts"
  },
  {
    "id": "jump_squat",
    "name": "Squats sautés",
    "shortName": "Squats",
    "type": "dynamic",
    "category": "legs",
    "primaryMuscle": "quadriceps",
    "secondaryMuscles": ["fessiers", "mollets"],
    "equipment": [],
    "notes": "Réception souple"
  },
  {
    "id": "alternating_lunges",
    "name": "Fentes alternées",
    "shortName": "Fentes",
    "type": "dynamic",
    "category": "legs",
    "primaryMuscle": "quadriceps",
    "secondaryMuscles": ["fessiers", "ischios"],
    "equipment": [],
    "notes": "Buste droit"
  },
  {
    "id": "wall_sit",
    "name": "Chaise",
    "shortName": "Chaise",
    "type": "static",
    "category": "legs",
    "primaryMuscle": "quadriceps",
    "secondaryMuscles": ["fessiers"],
    "equipment": ["Mur"],
    "notes": "Cuisses parallèles au sol"
  },
  {
    "id": "calf_raise",
    "name": "Mollets",
    "shortName": "Mollets",
    "type": "dynamic",
    "category": "legs",
    "primaryMuscle": "mollets",
    "secondaryMuscles": [],
    "equipment": [],
    "notes": "Montée lente, descente contrôlée"
  },
  {
    "id": "table_row",
    "name": "Rowing sous table",
    "shortName": "Rowing",
    "type": "dynamic",
    "category": "pull",
    "primaryMuscle": "dos",
    "secondaryMuscles": ["biceps", "trapezes"],
    "equipment": ["Table"],
    "notes": "Poitrine vers la table"
  },
  {
    "id": "table_row_hold",
    "name": "Rowing maintenu",
    "shortName": "Rowing",
    "type": "static",
    "category": "pull",
    "primaryMuscle": "dos",
    "secondaryMuscles": ["biceps", "trapezes"],
    "equipment": ["Table"],
    "notes": "Maintien menton proche de la table"
  },
  {
    "id": "shrugs",
    "name": "Haussements d'épaules",
    "shortName": "Shrugs",
    "type": "dynamic",
    "category": "pull",
    "primaryMuscle": "trapezes",
    "secondaryMuscles": [],
    "equipment": [],
    "notes": "Épaules vers le haut et l'arrière"
  },
  {
    "id": "decline_crunch",
    "name": "Crunchs déclinés",
    "shortName": "Crunchs",
    "type": "dynamic",
    "category": "core",
    "primaryMuscle": "abdos",
    "secondaryMuscles": [],
    "equipment": ["Banc"],
    "notes": "Bas du dos collé"
  },
  {
    "id": "oblique_crunch",
    "name": "Crunchs obliques",
    "shortName": "Crunchs",
    "type": "dynamic",
    "category": "core",
    "primaryMuscle": "obliques",
    "secondaryMuscles": ["abdos"],
    "equipment": ["Banc"],
    "notes": "Alternance gauche / droite"
  },
  {
    "id": "side_plank_leg_abduction",
    "name": "Abductions de hanche en planche latérale",
    "shortName": "Planche",
    "type": "dynamic",
    "category": "core",
    "primaryMuscle": "abducteurs_hanche",
    "secondaryMuscles": ["obliques", "fessiers"],
    "equipment": ["Tapis"],
    "notes": "Bassin stable, jambe supérieure contrôlée"
  },
  {
    "id": "reverse_crunch",
    "name": "Crunchs inverses",
    "shortName": "Crunchs",
    "type": "dynamic",
    "category": "core",
    "primaryMuscle": "abdos",
    "secondaryMuscles": [],
    "equipment": ["Banc"],
    "notes": "Bassin rétroversé"
  },
  {
    "id": "plank",
    "name": "Planche",
    "shortName": "Planche",
    "type": "static",
    "category": "core",
    "primaryMuscle": "abdos",
    "secondaryMuscles": ["lombaires"],
    "equipment": ["Tapis"],
    "notes": "Alignement tête-bassin-talons"
  },
  {
    "id": "side_plank",
    "name": "Planche latérale",
    "shortName": "Planche",
    "type": "static",
    "category": "core",
    "primaryMuscle": "obliques",
    "secondaryMuscles": ["abdos"],
    "equipment": ["Tapis"],
    "notes": "Bassin gainé"
  },
  {
    "id": "bench_core_hold",
    "name": "Gainage sur banc",
    "shortName": "Gainage",
    "type": "static",
    "category": "core",
    "primaryMuscle": "abdos",
    "secondaryMuscles": ["lombaires"],
    "equipment": ["Banc"],
    "notes": "Jambes dans le vide"
  },
  {
    "id": "hip_thrust",
    "name": "Hip thrust",
    "shortName": "Hip thrust",
    "type": "dynamic",
    "category": "core",
    "primaryMuscle": "fessiers",
    "secondaryMuscles": ["lombaires"],
    "equipment": ["Banc"],
    "notes": "Extension complète des hanches"
  },
  {
    "id": "bird_dog",
    "name": "Bird dog",
    "shortName": "Bird dog",
    "type": "dynamic",
    "category": "core",
    "primaryMuscle": "lombaires",
    "secondaryMuscles": ["abdos"],
    "equipment": ["Tapis"],
    "notes": "Contrôle et stabilité"
  },
  {
    "id": "dead_bug",
    "name": "Dead bug",
    "shortName": "Dead bug",
    "type": "dynamic",
    "category": "core",
    "primaryMuscle": "abdos",
    "secondaryMuscles": ["lombaires"],
    "equipment": ["Tapis"],
    "notes": "Bas du dos collé"
  },
  {
    "id": "superman",
    "name": "Superman",
    "shortName": "Superman",
    "type": "dynamic",
    "category": "core",
    "primaryMuscle": "lombaires",
    "secondaryMuscles": ["fessiers"],
    "equipment": ["Tapis"],
    "notes": "Bras et jambes décollés"
  },
  {
    "id": "superman_hold",
    "name": "Superman maintenu",
    "shortName": "Superman",
    "type": "static",
    "category": "core",
    "primaryMuscle": "lombaires",
    "secondaryMuscles": ["fessiers"],
    "equipment": ["Tapis"],
    "notes": "Bras et jambes décollés"
  },
  {
    "id": "hollow_body",
    "name": "Hollow body",
    "shortName": "Hollow body",
    "type": "dynamic",
    "category": "core",
    "primaryMuscle": "abdos",
    "secondaryMuscles": ["lombaires"],
    "equipment": ["Tapis"],
    "notes": "Position banane, bas du dos collé"
  },
  {
    "id": "hollow_body_hold",
    "name": "Hollow body",
    "shortName": "Hollow body maintenu",
    "type": "static",
    "category": "core",
    "primaryMuscle": "abdos",
    "secondaryMuscles": ["lombaires"],
    "equipment": ["Tapis"],
    "notes": "Position banane, bas du dos collé"
  },
  {
    "id": "running",
    "name": "Course à pied",
    "shortName": "Course",
    "type": "cardio",
    "category": "cardio",
    "primaryMuscle": "coeur",
    "secondaryMuscles": ["jambes"],
    "equipment": [],
    "notes": "Entraînement en endurance fondamentale ou fractionné"
  },
  {
    "id": "cycling",
    "name": "Cyclisme",
    "shortName": "Vélo",
    "type": "cardio",
    "category": "cardio",
    "primaryMuscle": "coeur",
    "secondaryMuscles": ["jambes"],
    "equipment": ["Vélo"],
    "notes": "Pédalage fluide et régulier"
  }
];

export const DEFAULT_WORKOUTS: Record<string, DayWorkout> = {
  "1": {
    "type": "hybrid",
    "strength": {
      "title": "Majeur pectoraux + rappel jambes & abdos & mollets",
      "sequence": "alternated",
      "sets": 4,
      "warmup": {
        "exerciseId": "calf_raise",
        "restDuration": 10,
        "workDuration": 120
      },
      "exercises": [
        {
          "exerciseId": "decline_pushup",
          "restDuration": 30,
          "workDuration": 30
        },
        {
          "exerciseId": "sumo_squat",
          "type": "dynamic",
          "restDuration": 20,
          "workDuration": 40
        },
        {
          "exerciseId": "bench_dips",
          "type": "dynamic",
          "restDuration": 30,
          "workDuration": 30
        },
        {
          "exerciseId": "decline_crunch",
          "type": "dynamic",
          "restDuration": 20,
          "workDuration": 40
        }
      ],
      "finisher": [
        {
          "exerciseId": "wide_pushup_hold",
          "sets": 3,
          "restDuration": 20,
          "workDuration": 20
        }
      ]
    },
    "cardio": {
      "title": "Récupération active",
      "exerciseId": "running",
      "durationMinutes": 30,
      "notes": "Facultatif : Course ou vélo très lent en endurance fondamentale (EF). Allure facile (vous devez pouvoir parler sans aucune gêne respiratoire). L'objectif est la récupération active et l'accumulation d'un temps d'effort doux."
    }
  },
  "2": {
    "type": "strength",
    "strength": {
      "title": "Majeur obliques + rappel dos & abdos & mollets",
      "sequence": "alternated",
      "sets": 4,
      "warmup": {
        "exerciseId": "calf_raise",
        "restDuration": 10,
        "workDuration": 120
      },
      "exercises": [
        {
          "exerciseId": "oblique_crunch",
          "restDuration": 20,
          "workDuration": 40
        },
        {
          "exerciseId": "shrugs",
          "restDuration": 20,
          "workDuration": 40
        },
        {
          "exerciseId": "side_plank_leg_abduction",
          "restDuration": 20,
          "workDuration": 40
        },
        {
          "exerciseId": "reverse_crunch",
          "restDuration": 20,
          "workDuration": 40
        }
      ],
      "finisher": [
        {
          "exerciseId": "plank",
          "sets": 2,
          "restDuration": 20,
          "workDuration": 40
        }
      ]
    }
  },
  "3": {
    "type": "hybrid",
    "strength": {
      "title": "Lombaires, fessiers & gainage profond",
      "sequence": "alternated",
      "sets": 4,
      "warmup": {
        "exerciseId": "calf_raise",
        "restDuration": 10,
        "workDuration": 120
      },
      "exercises": [
        {
          "exerciseId": "bird_dog",
          "restDuration": 20,
          "workDuration": 40
        },
        {
          "exerciseId": "sumo_squat",
          "restDuration": 20,
          "workDuration": 40
        },
        {
          "exerciseId": "dead_bug",
          "restDuration": 20,
          "workDuration": 40
        },
        {
          "exerciseId": "hip_thrust",
          "restDuration": 20,
          "workDuration": 40
        }
      ],
      "finisher": [
        {
          "exerciseId": "superman_hold",
          "sets": 2,
          "restDuration": 20,
          "workDuration": 40
        },
        {
          "exerciseId": "hollow_body_hold",
          "sets": 2,
          "restDuration": 20,
          "workDuration": 20
        }
      ]
    },
    "cardio": {
      "title": "Footing/Vélo progressif",
      "exerciseId": "running",
      "durationMinutes": 35,
      "notes": "Facultatif : Course ou vélo en endurance fondamentale (EF). Démarrez très calmement (échauffement ultra-facile) et augmentez de façon minime le rythme sur la fin si la forme le permet."
    }
  },
  "4": {
    "type": "strength",
    "strength": {
      "title": "Majeur jambes + rappel pectoraux & abdos & mollets",
      "sequence": "alternated",
      "sets": 4,
      "warmup": {
        "exerciseId": "calf_raise",
        "restDuration": 10,
        "workDuration": 120
      },
      "exercises": [
        {
          "exerciseId": "classic_squat",
          "restDuration": 20,
          "workDuration": 40
        },
        {
          "exerciseId": "classic_pushup",
          "restDuration": 30,
          "workDuration": 30
        },
        {
          "exerciseId": "alternating_lunges",
          "restDuration": 20,
          "workDuration": 40
        },
        {
          "exerciseId": "reverse_crunch",
          "restDuration": 20,
          "workDuration": 40
        }
      ],
      "finisher": [
        {
          "exerciseId": "wall_sit",
          "sets": 2,
          "restDuration": 20,
          "workDuration": 40
        }
      ]
    }
  },
  "5": {
    "type": "hybrid",
    "strength": {
      "title": "Majeur dos & trapèzes + rappel obliques & abdos & mollets",
      "sequence": "alternated",
      "sets": 4,
      "warmup": {
        "exerciseId": "calf_raise",
        "restDuration": 10,
        "workDuration": 120
      },
      "exercises": [
        {
          "exerciseId": "table_row",
          "restDuration": 30,
          "workDuration": 30
        },
        {
          "exerciseId": "oblique_crunch",
          "restDuration": 20,
          "workDuration": 40
        },
        {
          "exerciseId": "shrugs",
          "restDuration": 20,
          "workDuration": 40
        },
        {
          "exerciseId": "decline_crunch",
          "restDuration": 20,
          "workDuration": 40
        }
      ],
      "finisher": [
        {
          "exerciseId": "table_row_hold",
          "sets": 2,
          "restDuration": 30,
          "workDuration": 30
        }
      ]
    },
    "cardio": {
      "title": "Endurance fondamentale",
      "exerciseId": "cycling",
      "durationMinutes": 30,
      "notes": "Facultatif : Sortie lente en endurance fondamentale (EF). L'objectif est d'évacuer le stress de la semaine et de préparer doucement le système cardio-respiratoire pour la séance longue du lendemain."
    }
  },
  "6": {
    "type": "cardio",
    "cardio": {
      "title": "Fractionné & Sortie Longue",
      "exerciseId": "running",
      "durationMinutes": 48,
      "distanceKm": 9.0,
      "detail": "30' à 5:40 + 4x500m à 4:00 + 10' à 6:00",
      "warmup": {
        "exerciseId": "running",
        "workDuration": 1800,
        "restDuration": 60,
        "allure": "5:40"
      },
      "sets": 4,
      "exercises": [
        {
          "exerciseId": "running",
          "distanceM": 500,
          "workDuration": 120,
          "restDuration": 60,
          "allure": "4:00"
        }
      ],
      "finisher": [
        {
          "exerciseId": "running",
          "sets": 1,
          "workDuration": 600,
          "restDuration": 0,
          "allure": "6:00"
        }
      ],
      "notes": "Échauffement 30 min en aisance respiratoire, puis 4 accélérations de 500m à allure 4:00/km (récupération 1 min trottée), suivi de 10 min de retour au calme."
    }
  },
  "0": {
    "type": "rest"
  }
};

export const DEFAULT_TEMPLATES: WorkoutTemplateData[] = [
  {
    id: 'tmpl-pecs-bras',
    nom: 'Pectoraux & Triceps (Majeur pecs + rappel)',
    type: 'Hybride',
    description: 'Renforcement ciblé haut du corps avec rappel jambes et récupération active',
    workout: DEFAULT_WORKOUTS['1']
  },
  {
    id: 'tmpl-obliques-dos',
    nom: 'Obliques & Dos (Majeur obliques + rappel)',
    type: 'Renfo',
    description: 'Focus ceinture abdominale, obliques et chaîne postérieure',
    workout: DEFAULT_WORKOUTS['2']
  },
  {
    id: 'tmpl-lombaires-gainage',
    nom: 'Lombaires & Fessiers (Gainage profond)',
    type: 'Hybride',
    description: 'Travail postural, fessiers, bird dog et endurance fondamentale',
    workout: DEFAULT_WORKOUTS['3']
  },
  {
    id: 'tmpl-jambes-complet',
    nom: 'Jambes & Abdos (Majeur jambes + rappel)',
    type: 'Renfo',
    description: 'Squats, fentes, renforcement bas du corps et sangle abdominale',
    workout: DEFAULT_WORKOUTS['4']
  },
  {
    id: 'tmpl-dos-trapezes',
    nom: 'Dos & Trapèzes (Majeur dos + rappel)',
    type: 'Hybride',
    description: 'Tirages, shrugs, renforcement du dos et course à pied 30 min',
    workout: DEFAULT_WORKOUTS['5']
  },
  {
    id: 'tmpl-cardio-long',
    nom: 'Cardio Fractionné & Sortie Longue',
    type: 'Cardio',
    description: "Échauffement 30' à 5:40 + 4x500m à 4:00 + 10' à 6:00 de retour au calme",
    workout: DEFAULT_WORKOUTS['6']
  },
  {
    id: 'tmpl-repos-actif',
    nom: 'Repos & Récupération',
    type: 'Repos',
    description: 'Journée de récupération complète ou étirements passifs',
    workout: { type: 'rest' }
  }
];
