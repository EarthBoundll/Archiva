export interface RegistroHistorial {
  id: string;
  userId: string;
  categoryId: string | null;
  amount: number;
  description: string | null;
  date: string;
  type: 'income' | 'expense';
  category?: { name: string; icon: string; rule_type: string };
  createdAt: string;
  updatedAt: string;
}

export interface RegistroHistorialPayload {
  amount: number;
  description: string;
  date: string;
  type: 'income' | 'expense';
  categoryId?: string | null;
}