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