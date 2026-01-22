import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { AuthContextType, User, UserRole, PermissionType } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_PERMISSIONS: Record<UserRole, PermissionType[]> = {
    'Administrador': ['view_dashboard', 'manage_budget', 'import_data', 'view_review', 'edit_expenses', 'manage_permissions'],
    'Gestor': ['view_dashboard', 'manage_budget', 'import_data', 'view_review', 'edit_expenses'],
    'Auditor': ['view_dashboard', 'view_review'],
    'Visualizador': ['view_dashboard']
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [rolePermissions, setRolePermissions] = useState<Record<UserRole, PermissionType[]>>(DEFAULT_PERMISSIONS);

    // Load User and Permissions on mount
    useEffect(() => {
        const storedUser = localStorage.getItem('FINANCE_CORE_USER');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }

        const storedPermissions = localStorage.getItem('FINANCE_CORE_PERMISSIONS');
        if (storedPermissions) {
            setRolePermissions(JSON.parse(storedPermissions));
        }
    }, []);

    const login = (name: string, role: UserRole) => {
        const newUser: User = {
            name: name,
            email: `${name.toLowerCase().replace(/\s/g, '.')}@enterprise.com`,
            role: role,
            avatarInitials: name.substring(0, 2).toUpperCase()
        };
        
        setUser(newUser);
        localStorage.setItem('FINANCE_CORE_USER', JSON.stringify(newUser));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('FINANCE_CORE_USER');
    };

    const hasPermission = (permission: PermissionType): boolean => {
        if (!user) return false;
        // Administrator always has full access regardless of the matrix (fail-safe)
        if (user.role === 'Administrador') return true; 
        
        const currentPermissions = rolePermissions[user.role];
        return currentPermissions?.includes(permission) || false;
    };

    const updateRolePermissions = (role: UserRole, permissions: PermissionType[]) => {
        // Prevent locking out the admin completely (though UI should prevent it too)
        if (role === 'Administrador' && !permissions.includes('manage_permissions')) {
            permissions.push('manage_permissions');
        }

        const newMatrix = { ...rolePermissions, [role]: permissions };
        setRolePermissions(newMatrix);
        localStorage.setItem('FINANCE_CORE_PERMISSIONS', JSON.stringify(newMatrix));
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            isAuthenticated: !!user, 
            login, 
            logout,
            hasPermission,
            rolePermissions,
            updateRolePermissions
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};