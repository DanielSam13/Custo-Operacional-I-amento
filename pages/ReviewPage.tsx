import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ReviewVariant } from '../types';
import { useExpenses } from '../context/ExpenseContext';

interface ReviewPageProps {
    variant: ReviewVariant;
}

const ReviewPage: React.FC<ReviewPageProps> = ({ variant }) => {
    const navigate = useNavigate();
    const { expenses } = useExpenses();
    
    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterDate, setFilterDate] = useState('');

    // Extract unique values for dropdowns with normalization to prevent duplicates
    const uniqueTypes = useMemo(() => {
        const types = new Set(expenses.map(item => item.type ? item.type.trim().toUpperCase() : ''));
        return Array.from(types).filter(Boolean).sort();
    }, [expenses]);

    const uniqueStatuses = useMemo(() => {
        const statuses = new Set(expenses.map(item => item.status ? item.status.trim().toUpperCase() : ''));
        return Array.from(statuses).filter(Boolean).sort();
    }, [expenses]);

    // Filtering Logic
    const filteredExpenses = useMemo(() => {
        return expenses.filter(item => {
            const matchesSearch = searchTerm === '' || 
                item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.val.includes(searchTerm);
            
            const normalizedType = item.type ? item.type.trim().toUpperCase() : '';
            const matchesType = filterType === '' || normalizedType === filterType;
            
            const normalizedStatus = item.status ? item.status.trim().toUpperCase() : '';
            const matchesStatus = filterStatus === '' || normalizedStatus === filterStatus;
            
            const matchesDate = filterDate === '' || item.date.includes(filterDate);

            return matchesSearch && matchesType && matchesStatus && matchesDate;
        });
    }, [expenses, searchTerm, filterType, filterStatus, filterDate]);

    // Calculate totals based on filtered view
    const totalAmount = filteredExpenses.reduce((acc, item) => {
        const valStr = item.val.replace('R$', '').trim();
        let val = 0;
        // Robust parsing for sum
        if (valStr.includes(',') && valStr.includes('.')) {
            val = parseFloat(valStr.replace(/\./g, '').replace(',', '.'));
        } else if (valStr.includes(',')) {
            val = parseFloat(valStr.replace(',', '.'));
        } else {
            val = parseFloat(valStr);
        }
        return acc + (isNaN(val) ? 0 : val);
    }, 0);
    
    const pendingItems = filteredExpenses.filter(i => i.status === 'Pendente').length;

    const clearFilters = () => {
        setSearchTerm('');
        setFilterType('');
        setFilterStatus('');
        setFilterDate('');
    };

    return (
        <div className="flex h-full flex-col min-w-0 overflow-hidden bg-white dark:bg-background-dark">
            <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-border-dark z-10">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-semibold flex items-center gap-2">
                        {variant === 'permissions' ? 'Permissões e Auditoria' : variant === 'alerts' ? 'Alertas de Orçamento' : 'Revisão de Dados'}
                    </h1>
                     {variant === 'alerts' && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-500 text-[10px] font-bold rounded border border-red-500/20">
                            <span className="material-symbols-outlined text-xs">warning</span> ALERTAS ATIVOS
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button className="px-4 py-2 bg-slate-100 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">Descartar</button>
                    <button onClick={() => navigate('/')} className="px-4 py-2 bg-primary text-white rounded text-sm font-medium shadow-lg shadow-primary/20 hover:bg-blue-700 transition-colors">Finalizar Revisão</button>
                </div>
            </header>
            
            {expenses.length > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-background-dark border-b border-slate-200 dark:border-border-dark">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                        <div className="col-span-2 relative group">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 group-focus-within:text-primary transition-colors">search</span>
                            <input 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded text-sm outline-none focus:ring-2 focus:ring-primary transition-all shadow-sm" 
                                placeholder="Buscar por ID, Nome ou Valor..." 
                                type="text"
                            />
                        </div>
                        <div className="relative">
                             <select 
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="w-full appearance-none px-3 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded text-sm outline-none focus:ring-2 focus:ring-primary cursor-pointer shadow-sm uppercase"
                             >
                                <option value="">Todos os Tipos</option>
                                {uniqueTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">expand_more</span>
                        </div>
                        <div className="relative">
                            <select 
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full appearance-none px-3 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded text-sm outline-none focus:ring-2 focus:ring-primary cursor-pointer shadow-sm uppercase"
                            >
                                <option value="">Todos Status</option>
                                {uniqueStatuses.map(status => (
                                    <option key={status} value={status}>{status}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">expand_more</span>
                        </div>
                        <input 
                            type="text"
                            placeholder="Data (ex: 02/01)"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="px-3 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded text-sm outline-none focus:ring-2 focus:ring-primary shadow-sm"
                        />
                        <button onClick={clearFilters} className="text-primary text-sm font-medium hover:underline flex items-center justify-center gap-1">
                            <span className="material-symbols-outlined text-sm">filter_alt_off</span> Limpar
                        </button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-auto p-6 bg-slate-100 dark:bg-background-dark/50 flex flex-col items-center justify-center">
                {expenses.length === 0 ? (
                    <div className="text-center max-w-md space-y-6 p-8 rounded-2xl bg-white dark:bg-surface-dark border border-dashed border-slate-300 dark:border-slate-700">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-background-dark rounded-full flex items-center justify-center mx-auto">
                            <span className="material-symbols-outlined text-4xl text-slate-400">table_view</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Aguardando Planilha</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
                                O banco de dados está vazio. Importe a planilha com colunas (DATA, COLABORADOR, VALOR, etc.) para começar a revisão.
                            </p>
                        </div>
                        <button onClick={() => navigate('/import')} className="w-full py-3 bg-primary hover:bg-blue-700 text-white rounded font-semibold transition-colors flex items-center justify-center gap-2">
                            Começar Importação <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </button>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-lg overflow-hidden shadow-sm w-full h-full flex flex-col">
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10 shadow-sm">
                                    <tr className="bg-slate-50 dark:bg-card-dark border-b border-slate-200 dark:border-border-dark text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                        {variant === 'permissions' && <th className="px-4 py-4 w-10 text-center"><span className="material-symbols-outlined text-xs">lock</span></th>}
                                        <th className="px-6 py-4 w-24">ID</th>
                                        <th className="px-6 py-4">Data</th>
                                        <th className="px-6 py-4">Colaborador</th>
                                        <th className="px-6 py-4">Valor (BRL)</th>
                                        {variant !== 'default' && <th className="px-6 py-4">Status do Orçamento</th>}
                                        <th className="px-6 py-4">Tipo</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-border-dark text-sm bg-white dark:bg-surface-dark">
                                    {filteredExpenses.length > 0 ? (
                                        filteredExpenses.map((row, i) => (
                                            <tr key={i} className={`group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors 
                                                ${row.budget === 'Exceeded' && variant !== 'default' ? 'bg-red-500/[0.03]' : ''}
                                                ${row.status === 'Erro de Valor' ? 'bg-amber-500/[0.02]' : ''}
                                            `}>
                                                {variant === 'permissions' && (
                                                    <td className="px-4 py-4 text-center">
                                                        <button className="text-slate-300 hover:text-primary transition-colors">
                                                            <span className="material-symbols-outlined text-sm">{i % 2 === 0 ? 'lock' : 'lock_open'}</span>
                                                        </button>
                                                    </td>
                                                )}
                                                <td className="px-6 py-4 font-mono text-slate-500 text-xs group-hover:text-primary transition-colors cursor-pointer">{row.id}</td>
                                                <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-xs">{row.date}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-600 dark:text-slate-300">
                                                            {row.name.substring(0,2)}
                                                        </div>
                                                        <span className="font-medium text-xs truncate max-w-[150px] uppercase">{row.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-mono text-slate-700 dark:text-slate-200">
                                                    {row.budget === 'Exceeded' && variant !== 'default' ? (
                                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 text-red-500 rounded border border-red-500/20 text-xs font-bold">
                                                            <span className="material-symbols-outlined text-xs">report</span> {row.val}
                                                        </div>
                                                    ) : (
                                                        <span className="font-semibold">{row.val}</span>
                                                    )}
                                                </td>
                                                {variant !== 'default' && (
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${row.budget === 'Within' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${row.budget === 'Within' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                                            {row.budget === 'Within' ? 'No Orçamento' : 'Excedido'}
                                                        </span>
                                                    </td>
                                                )}
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 bg-slate-100 dark:bg-background-dark text-[10px] font-semibold text-slate-600 dark:text-slate-400 rounded border border-slate-200 dark:border-border-dark uppercase tracking-wide">{row.type}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[11px] font-bold flex items-center gap-1.5 
                                                        ${row.status === 'Validado' ? 'text-emerald-500' : row.status === 'Pendente' ? 'text-amber-500' : 'text-red-500'}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${row.status === 'Validado' ? 'bg-emerald-500' : row.status === 'Pendente' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                                                        {row.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-primary transition-colors" title="Editar"><span className="material-symbols-outlined text-lg">edit</span></button>
                                                        <button className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500 transition-colors" title="Remover"><span className="material-symbols-outlined text-lg">delete</span></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                                <span className="material-symbols-outlined text-3xl mb-2 opacity-50">search_off</span>
                                                <p>Nenhum resultado encontrado para os filtros selecionados.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <footer className="p-6 bg-slate-50 dark:bg-surface-dark border-t border-slate-200 dark:border-border-dark z-10">
                <div className={`flex flex-wrap gap-8 justify-end items-center ${expenses.length === 0 ? 'opacity-50' : ''}`}>
                    <div className="text-right">
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">
                            {filteredExpenses.length !== expenses.length ? `Total Filtrado (${filteredExpenses.length})` : 'Total Importado'}
                        </div>
                        <div className="text-xl font-mono font-bold text-primary">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
                        </div>
                    </div>
                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
                    <div className="text-right">
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Itens Pendentes</div>
                        <div className="text-xl font-mono font-bold text-amber-500">{pendingItems}</div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default ReviewPage;