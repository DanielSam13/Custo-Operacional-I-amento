import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { AuthContextType, User, UserRole } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);

    // Check localStorage on mount
    useEffect(() => {
        const storedUser = localStorage.getItem('FINANCE_CORE_USER');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    const login = (name: string, role: UserRole) => {
        // Mock login logic - in a real app, this would validate credentials
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

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
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