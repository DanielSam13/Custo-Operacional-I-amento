import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { ExpenseItem } from '../types';

interface ExpenseContextType {
    expenses: ExpenseItem[];
    setExpenses: (expenses: ExpenseItem[]) => void;
    deleteExpense: (id: string) => void;
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
        } catch (error: any) {
            console.error("Failed to save expenses to storage", error);
            if (error.name === 'QuotaExceededError') {
                alert("Atenção: O limite de armazenamento do navegador foi atingido. Alguns dados podem não ser salvos. Tente limpar dados antigos.");
            }
        }
    }, [expenses]);

    const setExpenses = (newExpenses: ExpenseItem[]) => {
        setExpensesState(newExpenses);
    };

    const deleteExpense = (id: string) => {
        setExpensesState(prev => prev.filter(item => item.id !== id));
    };

    const clearExpenses = () => {
        setExpensesState([]);
        localStorage.removeItem('FINANCE_CORE_EXPENSES');
    };

    return (
        <ExpenseContext.Provider value={{ expenses, setExpenses, deleteExpense, clearExpenses }}>
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