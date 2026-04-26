export interface HealthCause {
  icon: string;
  title: string;
  description: string;
}

export interface HealthAction {
  text: string;
  isUrgent: boolean;
}

export interface VetWarning {
  level: 'recommended' | 'urgent' | 'emergency';
  reasons: string[];
}

export interface AIHealthResponse {
  type: 'health_query' | 'general_info' | 'not_health_related';
  message: string;
  possibleCauses?: HealthCause[];
  actions?: HealthAction[];
  vetWarning?: VetWarning;
  disclaimer: string;
  suggestedFollowUp?: string[];
}

export interface DogContext {
  id: string;
  name: string;
  breed: string;
  gender: string;
  age: string;
  color?: string;
  weight?: number;
  status: string;
  microchip?: string;
  recentMedicalRecords: {
    type: string;
    date: string;
    description: string;
    diagnosis?: string;
    treatment?: string;
    nextDate?: string;
  }[];
  activeSupplements: {
    name: string;
    dosage: string;
    frequency: string;
  }[];
  foodIntolerances: {
    foodName: string;
    severity: string;
    symptoms?: string;
  }[];
  upcomingEvents: {
    title: string;
    type: string;
    date: string;
  }[];
  geneticTests: {
    testName: string;
    result: string;
    testDate: string;
  }[];
}

export interface ChatRequest {
  message: string;
  dogId?: string;
  conversationId?: string;
}

export interface ChatResponse {
  message: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: Date;
  };
  conversationId: string;
}
