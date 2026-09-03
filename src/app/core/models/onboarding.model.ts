// ============================================
// ONBOARDING ADAPTIVO - Tipos de usuario
// ============================================

export type SectorEmpresa = 
  | 'employee'        // Empleado con salary
  | 'freelancer'      // Freelancer / Independiente
  | 'business_owner'  // Dueño de negocio
  | 'retired'         // Jubilado / Pensionado
  | 'student'         // Estudiante
  | 'unemployed'      // Sin trabajo actualmente
  | 'other';          // Otro

// ============================================
// PREGUNTAS POR TIPO DE EMPLEO
// ============================================

export interface PreguntaOnboarding {
  id: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean' | 'currency';
  question: string;
  subtitle?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  unit?: string;
  required: boolean;
  dependsOn?: {
    field: string;
    value: any;
  };
}

// ============================================
// ESTRUCTURA DE PREGUNTAS POR EMPLEO
// ============================================

export const PREGUNTAS_ONBOARDING: Record<SectorEmpresa, PreguntaOnboarding[]> = {
  
  // EMPLEADO - Preguntas sobre salary, deducciones, beneficios
  employee: [
    {
      id: 'salary_amount',
      type: 'currency',
      question: '¿Cuánto es tu salario neto mensual?',
      subtitle: 'Lo que recibes después de descuentos',
      placeholder: '0.00',
      unit: 'PEN',
      required: true
    },
    {
      id: 'salary_day',
      type: 'select',
      question: '¿Qué día del mes te pagan?',
      subtitle: 'Día aproximado de cobro',
      options: [
        { value: '1', label: 'Día 1' },
        { value: '5', label: 'Día 5' },
        { value: '10', label: 'Día 10' },
        { value: '15', label: 'Día 15' },
        { value: '20', label: 'Día 20' },
        { value: '25', label: 'Día 25' },
        { value: '30', label: 'Último día' }
      ],
      required: true
    },
    {
      id: 'has_afp',
      type: 'boolean',
      question: '¿Aportas a alguna AFP?',
      subtitle: 'Fondo de pensiones',
      required: true
    },
    {
      id: 'has_health_insurance',
      type: 'boolean',
      question: '¿Tienes seguro EPS o SIS?',
      required: true
    },
    {
      id: 'has_benefits',
      type: 'boolean',
      question: '¿Recibes beneficios adicionales?',
      subtitle: 'Alimentación, movilidad, gratificación',
      required: false
    },
    {
      id: 'has_debts',
      type: 'boolean',
      question: '¿Tienes préstamos o deudas actuales?',
      required: true
    }
  ],

  // FREELANCER - Preguntas sobre documentos variables, promedios
  freelancer: [
    {
      id: 'income_type',
      type: 'select',
      question: '¿Qué tipo de trabajo independiente realizas?',
      options: [
        { value: 'design', label: 'Diseño / Creativo' },
        { value: 'development', label: 'Programación / Tech' },
        { value: 'writing', label: 'Escritura / Contenido' },
        { value: 'consulting', label: 'Consultoría' },
        { value: 'services', label: 'Servicios (contador, abogado, etc.)' },
        { value: 'sales', label: 'Ventas / Comercial' },
        { value: 'other', label: 'Otro' }
      ],
      required: true
    },
    {
      id: 'avg_monthly_income',
      type: 'currency',
      question: '¿Cuál es tu promedio de ingreso mensual?',
      subtitle: 'Estimate basado en tus últimos meses',
      placeholder: '0.00',
      unit: 'PEN',
      required: true
    },
    {
      id: 'income_frequency',
      type: 'select',
      question: '¿Con qué frecuencia recibes pagos?',
      options: [
        { value: 'weekly', label: 'Semanal' },
        { value: 'biweekly', label: 'Quincenal' },
        { value: 'monthly', label: 'Mensual' },
        { value: 'irregular', label: 'Irregular / Cuando sale trabajo' }
      ],
      required: true
    },
    {
      id: 'has_regular_clients',
      type: 'boolean',
      question: '¿Tienes clientes fijos/recurrentes?',
      subtitle: 'Clientes que te contratan regularmente',
      required: true
    },
    {
      id: 'has_contracts',
      type: 'boolean',
      question: '¿Trabajas con contratos formales?',
      required: false
    },
    {
      id: 'has_similar_income',
      type: 'boolean',
      question: '¿Tienes otros documentos adicionales?',
      subtitle: 'Trabajo adicional, inversiones, etc.',
      required: false
    },
    {
      id: 'has_debts',
      type: 'boolean',
      question: '¿Tienes préstamos o deudas actuales?',
      required: true
    }
  ],

  // NEGOCIO PROPIO - Preguntas sobre negocio
  business_owner: [
    {
      id: 'business_name',
      type: 'text',
      question: '¿Cómo se llama tu negocio?',
      placeholder: 'Nombre de tu empresa',
      required: false
    },
    {
      id: 'business_type',
      type: 'select',
      question: '¿Qué tipo de negocio tienes?',
      options: [
        { value: 'retail', label: 'Tienda / Retail' },
        { value: 'restaurant', label: 'Restaurante / Food' },
        { value: 'services', label: 'Servicios' },
        { value: 'online', label: 'Negocio online / E-commerce' },
        { value: 'manufacturing', label: 'Producción / Manufactura' },
        { value: 'other', label: 'Otro' }
      ],
      required: true
    },
    {
      id: 'avg_monthly_revenue',
      type: 'currency',
      question: '¿Cuál es el ingreso promedio mensual del negocio?',
      subtitle: 'Documentos brutos',
      placeholder: '0.00',
      unit: 'PEN',
      required: true
    },
    {
      id: 'avg_monthly_profit',
      type: 'currency',
      question: '¿Cuál es tu ganancia neta mensual?',
      subtitle: 'Lo que te queda después de solicitudes del negocio',
      placeholder: '0.00',
      unit: 'PEN',
      required: true
    },
    {
      id: 'has_employees',
      type: 'boolean',
      question: '¿Tienes empleados?',
      required: true
    },
    {
      id: 'has_business_license',
      type: 'boolean',
      question: '¿Tienes RUC activo y formalizado?',
      required: false
    },
    {
      id: 'has_debts',
      type: 'boolean',
      question: '¿El negocio tiene préstamos o deudas?',
      required: true
    }
  ],

  // JUBILADO - Solo AFP y pensión
  retired: [
    {
      id: 'pension_source',
      type: 'select',
      question: '¿De dónde recibes tu jubilación?',
      options: [
        { value: 'afp', label: 'AFP (fondo de pensiones)' },
        { value: 'onp', label: 'ONP (sistema público)' },
        { value: 'military', label: 'Pensión militar' },
        { value: 'other', label: 'Otra' }
      ],
      required: true
    },
    {
      id: 'pension_amount',
      type: 'currency',
      question: '¿Cuánto recibes mensualmente?',
      placeholder: '0.00',
      unit: 'PEN',
      required: true
    },
    {
      id: 'pension_day',
      type: 'select',
      question: '¿Qué día del mes te pagan?',
      options: [
        { value: '1', label: 'Día 1' },
        { value: '5', label: 'Día 5' },
        { value: '10', label: 'Día 10' },
        { value: '15', label: 'Día 15' }
      ],
      required: true
    },
    {
      id: 'has_additional_income',
      type: 'boolean',
      question: '¿Tienes otros documentos además de la pensión?',
      subtitle: 'Alquiler, inversiones, trabajo parcial',
      required: false
    },
    {
      id: 'has_debts',
      type: 'boolean',
      question: '¿Tienes préstamos o deudas actuales?',
      required: true
    }
  ],

  // ESTUDIANTE - Solo mesada/ayuda
  student: [
    {
      id: 'income_source',
      type: 'select',
      question: '¿De dónde obtienes tu dinero?',
      options: [
        { value: 'parents', label: 'Ayuda de padres/familia' },
        { value: 'scholarship', label: 'Beca / Scholarship' },
        { value: 'part_time', label: 'Trabajo de medio tiempo' },
        { value: 'mixed', label: 'Mixto (familia + trabajo)' }
      ],
      required: true
    },
    {
      id: 'monthly_amount',
      type: 'currency',
      question: '¿Cuánto dinero recibes al mes en promedio?',
      placeholder: '0.00',
      unit: 'PEN',
      required: true
    },
    {
      id: 'has_expenses',
      type: 'boolean',
      question: '¿Tienes solicitudes que pagar tú mismo?',
      subtitle: 'Transporte, alimentación, materiales',
      required: true
    },
    {
      id: 'works',
      type: 'boolean',
      question: '¿Trabajas actualmente?',
      required: true
    }
  ],

  // DESEMPLEADO - Sin documentos fijos
  unemployed: [
    {
      id: 'situation',
      type: 'select',
      question: '¿Cuál es tu situación actual?',
      options: [
        { value: 'looking', label: 'Buscando trabajo activamente' },
        { value: 'between_jobs', label: 'Entre trabajos' },
        { value: 'suspended', label: 'Temporalmente suspendido' },
        { value: 'other', label: 'Otra situación' }
      ],
      required: true
    },
    {
      id: 'has_savings',
      type: 'boolean',
      question: '¿Tienes archivos disponibles?',
      subtitle: 'Para solicitudes mientras buscas trabajo',
      required: true
    },
    {
      id: 'savings_amount',
      type: 'currency',
      question: '¿Cuánto tienes ahorrado?',
      placeholder: '0.00',
      unit: 'PEN',
      required: false
    },
    {
      id: 'has_support',
      type: 'boolean',
      question: '¿Recibes ayuda de familiares?',
      required: false
    },
    {
      id: 'has_unemployment_benefit',
      type: 'boolean',
      question: '¿Recibes algún tipo de asistencia del gobierno?',
      required: false
    }
  ],

  // OTRO - Preguntas genéricas
  other: [
    {
      id: 'description',
      type: 'text',
      question: '¿Cómo describirías tu situación?',
      placeholder: 'Cuéntanos brevemente',
      required: true
    },
    {
      id: 'income_source',
      type: 'select',
      question: '¿Cuál es tu fuente principal de documentos?',
      options: [
        { value: 'investments', label: 'Inversiones' },
        { value: 'rent', label: 'Alquiler de propiedad' },
        { value: 'convenio_marco', label: 'Convenio marco' },
        { value: 'inheritance', label: 'Herencia / Archivo' },
        { value: 'gifts', label: 'Regalos / Apoyo familiar' },
        { value: 'other', label: 'Otro' }
      ],
      required: true
    },
    {
      id: 'monthly_amount',
      type: 'currency',
      question: '¿Cuánto recibes aproximadamente al mes?',
      placeholder: '0.00',
      unit: 'PEN',
      required: true
    },
    {
      id: 'has_debts',
      type: 'boolean',
      question: '¿Tienes préstamos o deudas actuales?',
      required: true
    }
  ]
};

// ============================================
// PREGUNTAS COMUNES PARA TODOS
// ============================================

export const PREGUNTAS_COMUNES: PreguntaOnboarding[] = [
  {
    id: 'age',
    type: 'number',
    question: '¿Cuántos años tienes?',
    required: true
  },
  {
    id: 'has_goals',
    type: 'boolean',
    question: '¿Tienes metas financieras?',
    subtitle: 'Ahorrar para un viaje, casa, emerjar',
    required: true
  },
  {
    id: 'has_investments',
    type: 'boolean',
    question: '¿Tienes inversiones actuales?',
    subtitle: 'Bienes, fondos, acciones',
    required: false
  },
  {
    id: 'financial_priority',
    type: 'select',
    question: '¿Cuál es tu prioridad financiera principal?',
    options: [
      { value: 'save', label: 'Ahorrar dinero' },
      { value: 'debt', label: 'Pagar deudas' },
      { value: 'control', label: 'Controlar solicitudes' },
      { value: 'invest', label: 'Invertir' },
      { value: 'emergency', label: 'Crear fondo de emergencia' }
    ],
    required: true
  }
];

// ============================================
// RESPUESTA DE ONBOARDING
// ============================================

export interface RespuestaOnboarding {
  // Básico
  age: number;
  employmentType: SectorEmpresa;
  
  // Respuestas según tipo de empleo
  answers: Record<string, any>;
  
  // Comunes
  hasGoals: boolean;
  hasInvestments: boolean;
  financialPriority: string;
  
  // Meta info
  onboardingVersion: number;
  completedAt: string;
  needsReview: boolean; // Para marcar cuando necesita actualizarse
}