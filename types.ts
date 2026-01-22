export interface ExpenseItem {
    id: string;
    date: string;
    name: string;
    val: string;
    type: string;
    status: 'Validado' | 'Pendente' | 'Erro de Valor';
    budget: 'Within' | 'Exceeded';
}

export type ReviewVariant = 'default' | 'alerts' | 'permissions';

export interface SidebarProps {
    toggleTheme: () => void;
    isDark: boolean;
}

// Auth Types
export type UserRole = 'Administrador' | 'Gestor' | 'Auditor' | 'Visualizador';

export interface User {
    name: string;
    email: string;
    role: UserRole;
    avatarInitials: string;
}

export interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    login: (name: string, role: UserRole) => void;
    logout: () => void;
}