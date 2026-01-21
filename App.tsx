import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ThemeToggle from './components/ThemeToggle';
import DashboardPage from './pages/DashboardPage';
import ImportPage from './pages/ImportPage';
import ReviewPage from './pages/ReviewPage';
import { ExpenseProvider } from './context/ExpenseContext';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
               {children}
            </div>
        </div>
    );
};

const App: React.FC = () => {
    // Initial theme check
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDark]);

    const toggleTheme = () => setIsDark(!isDark);

    return (
        <ExpenseProvider>
            <HashRouter>
                <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-800 dark:text-slate-100 transition-colors duration-200">
                     <Routes>
                        <Route path="/" element={
                            <Layout>
                                <DashboardPage />
                            </Layout>
                        } />
                        <Route path="/import" element={
                            <Layout>
                                <ImportPage />
                            </Layout>
                        } />
                        <Route path="/review" element={
                            <Layout>
                                <ReviewPage variant="default" />
                            </Layout>
                        } />
                        <Route path="/review-alerts" element={
                            <Layout>
                                <ReviewPage variant="alerts" />
                            </Layout>
                        } />
                        <Route path="/review-permissions" element={
                            <Layout>
                                 <ReviewPage variant="permissions" />
                            </Layout>
                        } />
                    </Routes>
                    <ThemeToggle isDark={isDark} toggleTheme={toggleTheme} />
                </div>
            </HashRouter>
        </ExpenseProvider>
    );
};

export default App;