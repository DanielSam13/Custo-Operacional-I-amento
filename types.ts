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

export type PermissionType = 
    | 'view_dashboard'      // Ver Dashboard
    | 'manage_budget'       // Editar Metas/Orçamento
    | 'import_data'         // Importar Excel
    | 'view_review'         // Ver Tabela de Revisão
    | 'edit_expenses'       // Editar/Excluir Despesas Individuais
    | 'manage_permissions'; // Alterar regras de acesso

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
    hasPermission: (permission: PermissionType) => boolean;
    rolePermissions: Record<UserRole, PermissionType[]>;
    updateRolePermissions: (role: UserRole, permissions: PermissionType[]) => void;
}