import React, { createContext, useState, useContext, ReactNode } from 'react';
import { ExpenseItem } from '../types';

interface ExpenseContextType {
    expenses: ExpenseItem[];
    setExpenses: (expenses: ExpenseItem[]) => void;
    clearExpenses: () => void;
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

export const ExpenseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [expenses, setExpensesState] = useState<ExpenseItem[]>([]);

    const setExpenses = (newExpenses: ExpenseItem[]) => {
        setExpensesState(newExpenses);
    };

    const clearExpenses = () => {
        setExpensesState([]);
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