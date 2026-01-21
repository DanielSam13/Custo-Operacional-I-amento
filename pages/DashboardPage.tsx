import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, YAxis, CartesianGrid } from 'recharts';
import { useExpenses } from '../context/ExpenseContext';

const DashboardPage: React.FC = () => {
    const { expenses } = useExpenses();
    const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
    
    // Filter States
    const [selectedYear, setSelectedYear] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>(''); // '' = All months
    const [selectedCollaborator, setSelectedCollaborator] = useState<string | null>(null);

    // Chart Data State
    const [chartData, setChartData] = useState<any[]>([]);
    
    // Changed to store strings to handle input masking (e.g. "1.000,00")
    const [tempBudget, setTempBudget] = useState<{ [key: string]: string }>({});

    // Helper to parse BRL value string to number
    const parseCurrency = (valStr: string) => {
        if (!valStr) return 0;
        const clean = valStr.replace('R$', '').trim();
        if (clean.includes(',') && clean.includes('.')) {
            return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
        } else if (clean.includes(',')) {
            return parseFloat(clean.replace(',', '.'));
        }
        return parseFloat(clean) || 0;
    };

    // Extract available years from data
    const availableYears = useMemo(() => {
        const years = new Set(expenses.map(e => {
            const parts = e.date.split('/');
            return parts.length === 3 ? parts[2] : '';
        }).filter(y => y.length === 4));
        return Array.from(years).sort().reverse();
    }, [expenses]);

    // Initialize default year
    useEffect(() => {
        if (availableYears.length > 0 && !selectedYear) {
            setSelectedYear(availableYears[0]);
        }
    }, [availableYears, selectedYear]);

    // --- DATA PROCESSING LOGIC ---

    // 1. Filter expenses based on Year and Collaborator (For Charts - Trend View)
    const trendExpenses = useMemo(() => {
        return expenses.filter(item => {
            const parts = item.date.split('/');
            if (parts.length !== 3) return false;
            const year = parts[2];
            
            const matchYear = selectedYear ? year === selectedYear : true;
            const matchCollab = selectedCollaborator ? item.name === selectedCollaborator : true;
            
            return matchYear && matchCollab;
        });
    }, [expenses, selectedYear, selectedCollaborator]);

    // 2. Filter expenses based on Year, Collaborator AND Month (For KPIs - Specific View)
    const kpiExpenses = useMemo(() => {
        return trendExpenses.filter(item => {
            if (!selectedMonth) return true; // All months
            const parts = item.date.split('/');
            // parts[1] is month (01, 02...). Convert to index (0-11) or compare string
            const monthIndex = parseInt(parts[1], 10) - 1;
            return monthIndex.toString() === selectedMonth;
        });
    }, [trendExpenses, selectedMonth]);

    // 3. Update Chart Data - STRICT RECALCULATION
    useEffect(() => {
        // Template for chart order
        const template = [
            { name: 'Jan', index: 0 }, { name: 'Fev', index: 1 }, { name: 'Mar', index: 2 },
            { name: 'Abr', index: 3 }, { name: 'Mai', index: 4 }, { name: 'Jun', index: 5 },
            { name: 'Jul', index: 6 }, { name: 'Ago', index: 7 }, { name: 'Set', index: 8 },
            { name: 'Out', index: 9 }, { name: 'Nov', index: 10 }, { name: 'Dez', index: 11 }
        ];

        const monthlyActuals = new Array(12).fill(0);

        if (trendExpenses.length > 0) {
            trendExpenses.forEach(item => {
                const parts = item.date.split('/');
                if (parts.length === 3) {
                    const monthIndex = parseInt(parts[1], 10) - 1; // 0-11
                    if (monthIndex >= 0 && monthIndex < 12) {
                        monthlyActuals[monthIndex] += parseCurrency(item.val);
                    }
                }
            });
        }

        // Load persisted budget
        let savedBudgets: { [key: string]: number } = {};
        try {
            const stored = localStorage.getItem('FINANCE_CORE_BUDGETS');
            if (stored) {
                savedBudgets = JSON.parse(stored);
            }
        } catch (e) {
            console.error("Failed to load budget");
        }

        // Reconstruct data completely to avoid state carry-over issues
        const newChartData = template.map(t => ({
            name: t.name,
            index: t.index,
            // If we have a saved budget, use it. Otherwise 0.
            Budget: savedBudgets[t.name] !== undefined ? savedBudgets[t.name] : 0,
            Actual: monthlyActuals[t.index]
        }));

        setChartData(newChartData);

    }, [trendExpenses, expenses]); 

    // 4. Calculate KPI Totals (Uses kpiExpenses)
    const totalActual = useMemo(() => kpiExpenses.reduce((acc, item) => acc + parseCurrency(item.val), 0), [kpiExpenses]);
    
    // Budget logic: If specific month selected, only show budget for that month. Else total year.
    const totalBudget = useMemo(() => {
        if (selectedMonth) {
            const monthIdx = parseInt(selectedMonth);
            return chartData[monthIdx]?.Budget || 0;
        }
        return chartData.reduce((acc, item) => acc + item.Budget, 0);
    }, [chartData, selectedMonth]);

    // 5. Sidebar List
    const collaborators = useMemo(() => {
        const unique = new Set(expenses.map(e => e.name));
        return Array.from(unique).filter(Boolean).sort();
    }, [expenses]);

    // 6. Top Costs (Uses kpiExpenses)
    const costRanking = useMemo(() => {
        const typeMap: {[key: string]: number} = {};
        kpiExpenses.forEach(e => {
            const type = e.type ? e.type.toUpperCase() : 'OUTROS';
            typeMap[type] = (typeMap[type] || 0) + parseCurrency(e.val);
        });
        return Object.entries(typeMap)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5); 
    }, [kpiExpenses]);

    // Modal Logic
    const openBudgetModal = () => {
        const currentBudgets = chartData.reduce((acc, item) => {
            const val = item.Budget || 0;
            const formatted = val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return { ...acc, [item.name]: formatted };
        }, {});
        setTempBudget(currentBudgets);
        setIsBudgetModalOpen(true);
    };

    const handleBudgetChange = (month: string, value: string) => {
        const numericValue = value.replace(/\D/g, '');
        const floatValue = Number(numericValue) / 100;
        const formatted = floatValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        setTempBudget(prev => ({
            ...prev,
            [month]: formatted
        }));
    };

    const saveBudget = () => {
        const newBudgetValues: { [key: string]: number } = {};
        
        // Get existing budgets first so we don't lose other months not in current view (though currently modal shows all)
        let existingStore = {};
        try {
            const stored = localStorage.getItem('FINANCE_CORE_BUDGETS');
            if (stored) existingStore = JSON.parse(stored);
        } catch(e) {}

        const newData = chartData.map(item => {
            const rawStr = tempBudget[item.name];
            let finalVal = item.Budget;
            
            if (rawStr !== undefined) {
                 const numericValue = parseFloat(rawStr.replace(/\./g, '').replace(',', '.'));
                 finalVal = isNaN(numericValue) ? 0 : numericValue;
            }
            
            newBudgetValues[item.name] = finalVal;
            return { ...item, Budget: finalVal };
        });

        const mergedStore = { ...existingStore, ...newBudgetValues };
        try {
            localStorage.setItem('FINANCE_CORE_BUDGETS', JSON.stringify(mergedStore));
        } catch (e) {
            console.error("Failed to save budget");
        }

        setChartData(newData);
        setIsBudgetModalOpen(false);
    };

    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    return (
        <div className="flex h-full overflow-hidden relative">
            {/* Budget Configuration Modal */}
            {isBudgetModalOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-card-dark w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 dark:border-border-dark flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">edit_document</span>
                                Definir Orçamento Mensal
                            </h2>
                            <button onClick={() => setIsBudgetModalOpen(false)} className="text-slate-400 hover:text-red-500">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-4">
                            {chartData.map((item) => (
                                <div key={item.name} className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{item.name}</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                                        <input 
                                            type="text" 
                                            inputMode="numeric"
                                            value={tempBudget[item.name] || '0,00'}
                                            onChange={(e) => handleBudgetChange(item.name, e.target.value)}
                                            className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded text-sm focus:ring-2 focus:ring-primary outline-none font-mono text-right"
                                            placeholder="0,00"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-surface-dark/50 rounded-b-xl">
                            <button onClick={() => setIsBudgetModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white transition-colors">Cancelar</button>
                            <button onClick={saveBudget} className="px-6 py-2 bg-primary text-white text-sm font-bold rounded shadow-lg shadow-primary/20 hover:bg-blue-700 transition-transform active:scale-95">Salvar Orçamento</button>
                        </div>
                    </div>
                </div>
            )}

            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-card-dark flex flex-col z-10 hidden md:flex">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">group</span>
                        Colaborador / Depósito
                    </h2>
                    
                    {/* Collaborator Search & List */}
                    <div className="space-y-3">
                         <div className="relative">
                            <input className="w-full bg-slate-100 dark:bg-accent-teal/30 border-none rounded py-2 px-3 text-sm focus:ring-2 focus:ring-primary outline-none" placeholder="Buscar entidade..." type="text"/>
                            <span className="material-symbols-outlined absolute right-2 top-2 text-slate-400 text-sm">search</span>
                        </div>
                        
                        <button 
                            onClick={() => setSelectedCollaborator(null)}
                            className={`w-full text-left px-3 py-2 text-xs font-bold rounded transition-colors uppercase border border-dashed ${!selectedCollaborator 
                                ? 'bg-primary/10 text-primary border-primary/50' 
                                : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                            Todos os Colaboradores
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {collaborators.length > 0 ? collaborators.map((name, i) => (
                        <button 
                            key={i} 
                            onClick={() => setSelectedCollaborator(name === selectedCollaborator ? null : name)}
                            className={`w-full text-left px-3 py-2 text-xs font-semibold rounded transition-all truncate uppercase flex items-center justify-between group
                                ${selectedCollaborator === name 
                                    ? 'bg-primary text-white shadow-md shadow-primary/20' 
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-accent-teal'
                                }`}
                        >
                            <span className="truncate">{name}</span>
                            {selectedCollaborator === name && <span className="material-symbols-outlined text-[14px]">check</span>}
                        </button>
                    )) : (
                        <div className="p-4 text-center text-xs text-slate-400">Nenhum colaborador importado</div>
                    )}
                </div>
            </aside>
            <main className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Header with Filters */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold">Visão Geral de Análises</h1>
                        {selectedCollaborator && (
                            <p className="text-xs text-primary font-bold uppercase mt-1 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">person</span>
                                {selectedCollaborator}
                            </p>
                        )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Year Selector */}
                        <div className="relative min-w-[100px]">
                            <select 
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                className="w-full appearance-none bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 hover:border-primary px-3 py-2 rounded text-sm font-semibold outline-none focus:ring-2 focus:ring-primary cursor-pointer shadow-sm"
                            >
                                {availableYears.length === 0 && <option value="">Ano</option>}
                                {availableYears.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">calendar_month</span>
                        </div>

                        {/* Month Selector */}
                        <div className="relative min-w-[140px]">
                            <select 
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="w-full appearance-none bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 hover:border-primary px-3 py-2 rounded text-sm font-semibold outline-none focus:ring-2 focus:ring-primary cursor-pointer shadow-sm"
                            >
                                <option value="">Ano Inteiro</option>
                                {months.map((m, i) => (
                                    <option key={i} value={i}>{m}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">expand_more</span>
                        </div>

                        <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-1 hidden md:block"></div>

                        <button onClick={openBudgetModal} className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2 rounded text-sm font-semibold flex items-center gap-2 transition-colors">
                            <span className="material-symbols-outlined text-sm">edit</span> Orçamento
                        </button>
                        <Link to="/import" className="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-primary/20">
                            <span className="material-symbols-outlined text-sm">upload</span> Importar
                        </Link>
                    </div>
                </div>
                
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-card-dark p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4 hover:border-primary/50 transition-colors">
                        <div className="p-3 bg-slate-100 dark:bg-accent-teal/30 rounded-full"><span className="material-symbols-outlined text-primary">payments</span></div>
                        <div>
                            <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                Total Orçado <span className="text-[10px] opacity-70">({selectedMonth ? months[parseInt(selectedMonth)] : 'Anual'})</span>
                            </div>
                            <div className="text-2xl font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalBudget)}</div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-card-dark p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4 hover:border-primary/50 transition-colors">
                        <div className="p-3 bg-slate-100 dark:bg-accent-teal/30 rounded-full"><span className="material-symbols-outlined text-primary">account_balance_wallet</span></div>
                        <div>
                            <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                Realizado <span className="text-[10px] opacity-70">({selectedMonth ? months[parseInt(selectedMonth)] : 'Período'})</span>
                            </div>
                            <div className="text-2xl font-bold text-emerald-500">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalActual)}</div>
                        </div>
                    </div>
                    
                    {/* Donut Chart Card */}
                    <div className="bg-white dark:bg-card-dark p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between relative overflow-hidden">
                        <div className="w-24 h-24 relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={totalBudget > 0 ? [{ name: 'Utilizado', value: totalActual }, { name: 'Restante', value: Math.max(0, totalBudget - totalActual) }] : [{name: 'Sem Orçamento', value: 1}]}
                                        innerRadius={25}
                                        outerRadius={35}
                                        paddingAngle={5}
                                        dataKey="value"
                                        startAngle={90}
                                        endAngle={-270}
                                        stroke="none"
                                    >
                                        <Cell fill="#135bec" />
                                        <Cell fill="#3388a1" opacity={0.3} />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                             <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-primary">
                                {totalBudget > 0 ? `${Math.round((totalActual / totalBudget) * 100)}%` : '--'}
                            </div>
                        </div>
                        <div className="text-[10px] space-y-2 pr-4">
                             <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-chart-blue opacity-30"></span> 
                                <span className="text-slate-600 dark:text-slate-300">Disponível</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary"></span> 
                                <span className="text-slate-600 dark:text-slate-300">Utilizado</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white dark:bg-card-dark p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                Orçado vs Realizado <span className="text-[10px] text-slate-500 font-normal">({selectedYear})</span>
                            </h3>
                            <div className="flex items-center gap-4 text-[10px] font-semibold">
                                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-primary rounded-sm"></span> Orçado</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-chart-blue rounded-sm"></span> Realizado</span>
                            </div>
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} barGap={4}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fontSize: 10, fill: '#64748b'}} 
                                        dy={10}
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fontSize: 10, fill: '#64748b'}}
                                        tickFormatter={(value) => `R$${value/1000}k`}
                                    />
                                    <Tooltip 
                                        cursor={{fill: 'transparent'}}
                                        contentStyle={{ backgroundColor: '#162b35', borderColor: '#2c3e50', color: '#f1f5f9', fontSize: '12px', borderRadius: '4px' }}
                                        itemStyle={{ color: '#f1f5f9' }}
                                        formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                                    />
                                    <Bar dataKey="Budget" name="Orçado" fill="#135bec" radius={[2, 2, 0, 0]} barSize={20} />
                                    <Bar dataKey="Actual" name="Realizado" fill="#3388a1" radius={[2, 2, 0, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    
                    <div className="bg-white dark:bg-card-dark p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col">
                        <h3 className="text-xs font-bold uppercase tracking-wide mb-6 text-slate-700 dark:text-slate-200 flex justify-between">
                            Top 5 Custos 
                            <span className="text-[10px] text-slate-500 font-normal">({selectedMonth ? months[parseInt(selectedMonth)] : 'Total'})</span>
                        </h3>
                        {costRanking.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 opacity-50 min-h-[160px]">
                                <span className="material-symbols-outlined text-4xl text-slate-300">bar_chart</span>
                                <p className="text-xs text-slate-500">Sem dados para o período selecionado.</p>
                            </div>
                        ) : (
                            <div className="space-y-4 flex-1">
                                {costRanking.map(([type, value], i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-surface-dark flex items-center justify-center font-bold text-slate-500 text-xs shadow-sm">
                                            {i + 1}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="font-semibold truncate max-w-[120px] uppercase">{type}</span>
                                                <span className="font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}</span>
                                            </div>
                                            <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-primary rounded-full" 
                                                    style={{ width: `${(value / costRanking[0][1]) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                             <Link to="/review" className="block w-full text-center py-2 text-xs font-semibold text-primary hover:bg-primary/5 rounded transition-colors uppercase tracking-wider">Ver Relatório Completo</Link>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DashboardPage;