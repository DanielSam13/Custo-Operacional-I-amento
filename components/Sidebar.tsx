import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Sidebar: React.FC = () => {
    const location = useLocation();
    const { user, logout, hasPermission } = useAuth();
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const isActive = (path: string) => location.pathname === path;

    if (!user) return null;

    return (
        <aside className="w-64 flex-shrink-0 bg-white dark:bg-surface-dark border-r border-slate-200 dark:border-border-dark hidden lg:flex flex-col z-20">
            <div className="p-6">
                <div className="flex items-center gap-2 text-primary font-bold text-xl uppercase tracking-tighter cursor-pointer">
                    <span className="material-symbols-outlined text-3xl">analytics</span>
                    <span>IçamentoPrice</span>
                </div>
            </div>
            <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
                <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${isActive('/') ? 'bg-primary/10 text-primary font-medium' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-primary/10'}`}>
                    <span className="material-symbols-outlined">dashboard</span>
                    <span>Dashboard Principal</span>
                </Link>
                
                {hasPermission('view_review') && (
                    <Link to="/review" className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${isActive('/review') ? 'bg-primary/10 text-primary font-medium' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-primary/10'}`}>
                        <span className="material-symbols-outlined">table_chart</span>
                        <span>Revisão de Dados</span>
                    </Link>
                )}

                {hasPermission('import_data') && (
                    <Link to="/import" className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${isActive('/import') ? 'bg-primary/10 text-primary font-medium' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-primary/10'}`}>
                        <span className="material-symbols-outlined">upload_file</span>
                        <span>Importar Excel</span>
                    </Link>
                )}

                {(hasPermission('view_review') || hasPermission('manage_permissions')) && (
                    <button 
                        onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                        className="w-full flex items-center justify-between pt-4 pb-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none group mt-2"
                    >
                        <span>Avançado</span>
                        <span className={`material-symbols-outlined text-[18px] transition-transform duration-200 ${isAdvancedOpen ? 'rotate-180 text-primary' : ''}`}>
                            expand_more
                        </span>
                    </button>
                )}
                
                {isAdvancedOpen && (
                    <div className="space-y-1 animate-fade-in pl-2">
                        {hasPermission('view_dashboard') && (
                             <Link to="/analysis" className={`flex items-center gap-3 px-4 py-2 text-xs transition-colors rounded-r-md border-l-2 ${isActive('/analysis') ? 'border-primary text-primary font-medium bg-slate-50 dark:bg-white/5' : 'border-transparent text-slate-500 hover:text-primary hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                                <span className="material-symbols-outlined text-sm">psychology</span> Análise Micro
                            </Link>
                        )}

                        {hasPermission('view_review') && (
                            <Link to="/review-alerts" className={`flex items-center gap-3 px-4 py-2 text-xs transition-colors rounded-r-md border-l-2 ${isActive('/review-alerts') ? 'border-primary text-primary font-medium bg-slate-50 dark:bg-white/5' : 'border-transparent text-slate-500 hover:text-primary hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                                    <span className="material-symbols-outlined text-sm">notification_important</span> Alertas de Orçamento
                            </Link>
                        )}
                        
                        {hasPermission('manage_permissions') && (
                            <Link to="/review-permissions" className={`flex items-center gap-3 px-4 py-2 text-xs transition-colors rounded-r-md border-l-2 ${isActive('/review-permissions') ? 'border-primary text-primary font-medium bg-slate-50 dark:bg-white/5' : 'border-transparent text-slate-500 hover:text-primary hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                                    <span className="material-symbols-outlined text-sm">shield</span> Permissões de Acesso
                            </Link>
                        )}
                    </div>
                )}
            </nav>
            <div className="p-4 border-t border-slate-200 dark:border-border-dark">
                <div className="flex items-center gap-3 px-2">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs shadow-md">
                        {user.avatarInitials}
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-2">
                             <p className="text-sm font-medium truncate">{user.name}</p>
                             <span className="text-[9px] px-1 bg-slate-100 dark:bg-slate-700 rounded text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                {user.role.substring(0,3).toUpperCase()}
                             </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate text-[10px]">{user.email}</p>
                    </div>
                    <button onClick={logout} className="text-slate-400 hover:text-red-500 transition-colors" title="Sair">
                        <span className="material-symbols-outlined">logout</span>
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;