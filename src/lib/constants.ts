export const EXAM_DATE = new Date('2025-08-13')
export const EXAM_NAME = 'CAAN Level 5'
export const EXAM_LABEL = 'Aviation Fire Services'
export const EXAM_BODY = 'CAAN'
export const TOTAL_TOPICS = 38
export const PASS_MARK = 40
export const NEGATIVE_MARKING_PCT = 0.2
export const MCQ_TIME_LIMIT_S = 54
export const IQ_TIME_TARGET_S = 45
export const RESCUE_THRESHOLD_DAYS = 14

export const IQ_QUESTION_TYPES = [
  { id: 'series',             label: 'Series completion',     category: 'verbal'     },
  { id: 'analogy',            label: 'Analogy',               category: 'verbal'     },
  { id: 'coding_decoding',    label: 'Coding-decoding',       category: 'verbal'     },
  { id: 'direction_distance', label: 'Direction & distance',  category: 'verbal'     },
  { id: 'logical_reasoning',  label: 'Logical reasoning',     category: 'verbal'     },
  { id: 'arithmetic',         label: 'Arithmetic reasoning',  category: 'arithmetic' },
  { id: 'figure_series',      label: 'Figure series',         category: 'non_verbal' },
  { id: 'mirror_water',       label: 'Mirror & water images', category: 'non_verbal' },
  { id: 'figure_matrix',      label: 'Figure matrix',         category: 'non_verbal' },
  { id: 'venn_diagram',       label: 'Venn diagrams',         category: 'non_verbal' },
] as const

export type IQType = typeof IQ_QUESTION_TYPES[number]['id']
export type IQCategory = 'verbal' | 'non_verbal' | 'arithmetic'

export const CATEGORY_COLORS: Record<IQCategory, { bg: string; text: string }> = {
  verbal:      { bg: 'bg-brand-50',   text: 'text-brand-800'   },
  non_verbal:  { bg: 'bg-purple-50',  text: 'text-purple-800'  },
  arithmetic:  { bg: 'bg-teal-50',    text: 'text-teal-800'    },
}

export const STATUS_COLORS = {
  not_started: { bg: 'bg-[#F1EFE8]', text: 'text-[#5F5E5A]', label: 'Not started' },
  in_progress: { bg: 'bg-warning-50', text: 'text-warning-800', label: 'In progress' },
  done:        { bg: 'bg-success-50', text: 'text-success-800', label: 'Done'        },
} as const

export const SESSION_TYPE_COLORS = {
  study:  { bar: 'bg-brand-400',   label: 'Study'  },
  drill:  { bar: 'bg-purple-400',  label: 'Drill'  },
  iq:     { bar: 'bg-teal-400',    label: 'IQ'     },
  review: { bar: 'bg-gray-400',    label: 'Review' },
} as const

export const NAV_ITEMS = [
  { href: '/',          label: 'Home',      icon: 'Home'       },
  { href: '/topics',    label: 'Topics',    icon: 'BookOpen'   },
  { href: '/iq',        label: 'IQ',        icon: 'Brain'      },
  { href: '/timetable', label: 'Timetable', icon: 'Calendar'   },
  { href: '/progress',  label: 'Progress',  icon: 'BarChart3'  },
] as const

export const GK_QUESTION_TYPES = [
  { id: 'nepal_history',    label: 'Nepal history',      category: 'nepal'    },
  { id: 'nepal_geography',  label: 'Nepal geography',    category: 'nepal'    },
  { id: 'constitution',     label: 'Constitution & law', category: 'nepal'    },
  { id: 'aviation_icao',    label: 'ICAO & standards',   category: 'aviation' },
  { id: 'caan_regulations', label: 'CAAN regulations',   category: 'aviation' },
  { id: 'aviation_history', label: 'Aviation history',   category: 'aviation' },
  { id: 'world_affairs',    label: 'World affairs',      category: 'world'    },
  { id: 'science_tech',     label: 'Science & tech',     category: 'world'    },
] as const

export type GKType = typeof GK_QUESTION_TYPES[number]['id']
export type GKCategory = 'nepal' | 'aviation' | 'world'

export const GK_CATEGORIES: { id: GKCategory; label: string; emoji: string; description: string }[] = [
  { id: 'nepal',   label: 'Nepal',   emoji: '🇳🇵', description: 'History · Geography · Constitution & law' },
  { id: 'aviation',label: 'Aviation',emoji: '✈️', description: 'ICAO · CAAN regulations · Aviation history' },
  { id: 'world',   label: 'World',   emoji: '🌍', description: 'World affairs · Science & technology'      },
]

export const GK_SUB_TOPICS: Record<GKType, { id: string; label: string }[]> = {
  nepal_geography: [
    { id: 'rivers',     label: 'Rivers'                    },
    { id: 'mountains',  label: 'Mountains & peaks'         },
    { id: 'lakes',      label: 'Lakes'                     },
    { id: 'parks',      label: 'National parks & reserves' },
    { id: 'provinces',  label: 'Provinces & districts'     },
    { id: 'climate',    label: 'Climate & ecology'         },
  ],
  nepal_history: [
    { id: 'ancient',    label: 'Ancient kingdoms'          },
    { id: 'shah',       label: 'Shah dynasty & unification'},
    { id: 'rana',       label: 'Rana regime'               },
    { id: 'movements',  label: "People's movements"        },
    { id: 'republic',   label: 'Republic era (2008–)'      },
  ],
  constitution: [
    { id: 'rights',     label: 'Fundamental rights'        },
    { id: 'structure',  label: 'State structure & organs'  },
    { id: 'electoral',  label: 'Electoral system'          },
    { id: 'local_gov',  label: 'Local governance'          },
    { id: 'citizenship',label: 'Citizenship & nationality' },
  ],
  aviation_icao: [
    { id: 'annexes',    label: 'ICAO Annexes'              },
    { id: 'sarps',      label: 'Standards & practices'     },
    { id: 'categories', label: 'Airport categories'        },
    { id: 'emergency',  label: 'Emergency procedures'      },
    { id: 'docs',       label: 'ICAO Docs & manuals'       },
  ],
  caan_regulations: [
    { id: 'civil_act',  label: 'Civil Aviation Act'        },
    { id: 'car',        label: 'Civil Aviation Requirements'},
    { id: 'airport_law',label: 'Airport bylaws'            },
    { id: 'licensing',  label: 'Licensing & certification' },
  ],
  aviation_history: [
    { id: 'world_avi',  label: 'World aviation history'    },
    { id: 'nepal_avi',  label: 'Nepal aviation history'    },
    { id: 'aircraft',   label: 'Aircraft development'      },
    { id: 'orgs',       label: 'ICAO & international bodies'},
  ],
  world_affairs: [
    { id: 'geopolitics',label: 'Geopolitics & diplomacy'  },
    { id: 'intl_orgs',  label: 'International organizations'},
    { id: 'economics',  label: 'Trade & economics'         },
    { id: 'environment',label: 'Environment & climate'     },
    { id: 'nepal_world',label: 'Nepal in world affairs'    },
  ],
  science_tech: [
    { id: 'physics',    label: 'Physics'                   },
    { id: 'chemistry',  label: 'Chemistry'                 },
    { id: 'biology',    label: 'Biology & health'          },
    { id: 'technology', label: 'Technology & inventions'   },
    { id: 'space',      label: 'Space & environment'       },
  ],
}

export const ARFF_CATEGORIES = [
  { id: 'foam_agents',      label: 'Foam & extinguishing agents' },
  { id: 'vehicles',         label: 'ARFF vehicles & equipment'   },
  { id: 'rescue_ops',       label: 'Rescue operations'           },
  { id: 'icao_annex14',     label: 'ICAO Annex 14 & CAR'        },
  { id: 'fire_classes',     label: 'Fire classes & behavior'     },
  { id: 'medical_first',    label: 'First aid & medical'         },
  { id: 'local_procedures', label: 'Airport local procedures'     },
] as const
