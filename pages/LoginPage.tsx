import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

const LoginPage: React.FC = () => {
    const [name, setName] = useState('');
    const [role, setRole] = useState<UserRole>('Administrador');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsLoading(true);
        
        // Simulate API delay
        setTimeout(() => {
            login(name, role);
            navigate('/');
            setIsLoading(false);
        }, 800);
    };

    const roles: UserRole[] = ['Administrador', 'Gestor', 'Auditor', 'Visualizador'];

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-background-dark p-4">
            <div className="w-full max-w-md bg-white dark:bg-surface-dark rounded-2xl shadow-xl border border-slate-200 dark:border-border-dark overflow-hidden animate-fade-in">
                
                {/* Header */}
                <div className="p-8 pb-6 text-center border-b border-slate-100 dark:border-slate-800">
                    <div className="inline-flex items-center gap-2 text-primary font-bold text-2xl uppercase tracking-tighter mb-2">
                        <span className="material-symbols-outlined text-4xl">analytics</span>
                        <span>IçamentoPrice</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Acesse o painel de controle financeiro</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Nome de Usuário</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">person</span>
                            <input 
                                type="text" 
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all dark:text-white"
                                placeholder="Digite seu nome"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Senha</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">lock</span>
                            <input 
                                type="password" 
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all dark:text-white"
                                placeholder="••••••••"
                                defaultValue="password"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Selecionar Permissão</label>
                        <div className="grid grid-cols-2 gap-2">
                            {roles.map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setRole(r)}
                                    className={`px-3 py-2 text-xs font-semibold rounded border transition-all flex items-center justify-center gap-2 ${
                                        role === r 
                                        ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' 
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    {role === r && <span className="material-symbols-outlined text-[14px]">check</span>}
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full py-3 bg-primary hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-primary/20 transition-all transform active:scale-95 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        ) : (
                            <>
                                Entrar no Sistema <span className="material-symbols-outlined text-lg">login</span>
                            </>
                        )}
                    </button>
                </form>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-xs text-slate-400">© 2024 IçamentoPrice Analytics. v1.0.2</p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;