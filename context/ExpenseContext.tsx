import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { ExpenseItem } from '../types';

interface ExpenseContextType {
    expenses: ExpenseItem[];
    setExpenses: (expenses: ExpenseItem[]) => void;
    clearExpenses: () => void;
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

export const ExpenseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Initialize state from localStorage if available
    const [expenses, setExpensesState] = useState<ExpenseItem[]>(() => {
        try {
            const savedData = localStorage.getItem('FINANCE_CORE_EXPENSES');
            return savedData ? JSON.parse(savedData) : [];
        } catch (error) {
            console.error("Failed to load expenses from storage", error);
            return [];
        }
    });

    // Update localStorage whenever expenses change
    useEffect(() => {
        try {
            localStorage.setItem('FINANCE_CORE_EXPENSES', JSON.stringify(expenses));
        } catch (error) {
            console.error("Failed to save expenses to storage", error);
        }
    }, [expenses]);

    const setExpenses = (newExpenses: ExpenseItem[]) => {
        setExpensesState(newExpenses);
    };

    const clearExpenses = () => {
        setExpensesState([]);
        localStorage.removeItem('FINANCE_CORE_EXPENSES');
    };

    return (
        <ExpenseContext.Provider value={{ expenses, setExpenses, clearExpenses }}>
            {children}
        </ExpenseContext.Provider>
    );
};

export const useExpenses = () => {
    const context = useContext(ExpenseContext);
    if (!context) {
        throw new Error('useExpenses must be used within an ExpenseProvider');
    }
    return context;
};