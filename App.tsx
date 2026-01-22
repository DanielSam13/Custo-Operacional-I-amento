import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ThemeToggle from './components/ThemeToggle';
import DashboardPage from './pages/DashboardPage';
import ImportPage from './pages/ImportPage';
import ReviewPage from './pages/ReviewPage';
import LoginPage from './pages/LoginPage';
import { ExpenseProvider } from './context/ExpenseContext';
import { AuthProvider, useAuth } from './context/AuthContext';

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

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
};

const AppContent: React.FC = () => {
     // Initial theme check
    const [isDark, setIsDark] = useState(true);
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDark]);

    const toggleTheme = () => setIsDark(!isDark);

    return (
        <HashRouter>
            <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-800 dark:text-slate-100 transition-colors duration-200">
                    <Routes>
                    <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />} />
                    
                    <Route path="/" element={
                        <ProtectedRoute>
                            <Layout>
                                <DashboardPage />
                            </Layout>
                        </ProtectedRoute>
                    } />
                    <Route path="/import" element={
                        <ProtectedRoute>
                            <Layout>
                                <ImportPage />
                            </Layout>
                        </ProtectedRoute>
                    } />
                    <Route path="/review" element={
                        <ProtectedRoute>
                            <Layout>
                                <ReviewPage variant="default" />
                            </Layout>
                        </ProtectedRoute>
                    } />
                    <Route path="/review-alerts" element={
                        <ProtectedRoute>
                            <Layout>
                                <ReviewPage variant="alerts" />
                            </Layout>
                        </ProtectedRoute>
                    } />
                    <Route path="/review-permissions" element={
                        <ProtectedRoute>
                            <Layout>
                                    <ReviewPage variant="permissions" />
                            </Layout>
                        </ProtectedRoute>
                    } />
                </Routes>
                {isAuthenticated && <ThemeToggle isDark={isDark} toggleTheme={toggleTheme} />}
            </div>
        </HashRouter>
    );
}

const App: React.FC = () => {
    return (
        <AuthProvider>
            <ExpenseProvider>
                <AppContent />
            </ExpenseProvider>
        </AuthProvider>
    );
};

export default App;