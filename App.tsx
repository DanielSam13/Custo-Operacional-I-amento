import React, { useState, useEffect, Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ThemeToggle from './components/ThemeToggle';
import { ExpenseProvider } from './context/ExpenseContext';
import { AuthProvider, useAuth } from './context/AuthContext';

// Lazy Load Pages para dividir o tamanho do arquivo final (Code Splitting)
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ImportPage = lazy(() => import('./pages/ImportPage'));
const ReviewPage = lazy(() => import('./pages/ReviewPage'));
const MicroAnalysisPage = lazy(() => import('./pages/MicroAnalysisPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));

// Componente de carregamento para exibir enquanto baixa as partes do site
const LoadingScreen = () => (
    <div className="flex items-center justify-center h-screen w-full bg-slate-100 dark:bg-background-dark">
        <div className="flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Carregando...</p>
        </div>
    </div>
);

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
                <Suspense fallback={<LoadingScreen />}>
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
                        <Route path="/analysis" element={
                            <ProtectedRoute>
                                <Layout>
                                    <MicroAnalysisPage />
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
                </Suspense>
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