import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, YAxis, CartesianGrid, Legend } from 'recharts';
import { useExpenses } from '../context/ExpenseContext';
import { useAuth } from '../context/AuthContext';

const DashboardPage: React.FC = () => {
    const { expenses } = useExpenses();
    const { hasPermission } = useAuth();
    const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
    
    // Budget Category State for Modal
    const [activeBudgetTab, setActiveBudgetTab] = useState<'Geral' | 'PPRI' | 'Diárias'>('Geral');

    // Filter States
    const [selectedYear, setSelectedYear] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>(''); // '' = All months
    const [selectedCollaborator, setSelectedCollaborator] = useState<string | null>(null);

    // Chart Data States
    const [mainChartData, setMainChartData] = useState<any[]>([]);
    const [ppriChartData, setPpriChartData] = useState<any[]>([]);
    const [diariasChartData, setDiariasChartData] = useState<any[]>([]);
    
    // Temp Budget State
    const [tempData, setTempData] = useState<{ [month: string]: { [key: string]: string } }>({});

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
        } else if (!selectedYear) {
             setSelectedYear(new Date().getFullYear().toString());
        }
    }, [availableYears, selectedYear]);

    // --- DATA PROCESSING LOGIC ---

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

    const kpiExpenses = useMemo(() => {
        return trendExpenses.filter(item => {
            if (!selectedMonth) return true; // All months
            const parts = item.date.split('/');
            const monthIndex = parseInt(parts[1], 10) - 1;
            return monthIndex.toString() === selectedMonth;
        });
    }, [trendExpenses, selectedMonth]);

    // Update All Charts
    useEffect(() => {
        const template = [
            { name: 'Jan', index: 0 }, { name: 'Fev', index: 1 }, { name: 'Mar', index: 2 },
            { name: 'Abr', index: 3 }, { name: 'Mai', index: 4 }, { name: 'Jun', index: 5 },
            { name: 'Jul', index: 6 }, { name: 'Ago', index: 7 }, { name: 'Set', index: 8 },
            { name: 'Out', index: 9 }, { name: 'Nov', index: 10 }, { name: 'Dez', index: 11 }
        ];

        // 1. Calculate Actuals from IMPORTED Data
        const importedActuals = {
            Geral: new Array(12).fill(0),
            PPRI: new Array(12).fill(0),
            Diárias: new Array(12).fill(0)
        };

        trendExpenses.forEach(item => {
            const parts = item.date.split('/');
            if (parts.length === 3) {
                const monthIndex = parseInt(parts[1], 10) - 1;
                if (monthIndex >= 0 && monthIndex < 12) {
                    const val = parseCurrency(item.val);
                    importedActuals.Geral[monthIndex] += val;
                    if (item.type === 'PPRI') {
                        importedActuals.PPRI[monthIndex] += val;
                    } else if (item.type === 'Diárias') {
                        importedActuals.Diárias[monthIndex] += val;
                    }
                }
            }
        });

        // 2. Load Manual Data
        let savedData: { [month: string]: { [key: string]: number } } = {};
        try {
            const stored = localStorage.getItem('FINANCE_CORE_DATA_V3');
            if (stored) savedData = JSON.parse(stored);
        } catch (e) { console.error("Failed to load data"); }

        // 3. Construct Data for each chart
        const buildData = (category: 'Geral' | 'PPRI' | 'Diárias') => {
            return template.map(t => {
                const monthData = savedData[t.name] || {};
                const budgetVal = monthData[`${category}_Budget`] || 0;
                let actualVal = importedActuals[category][t.index];
                if (category !== 'Geral') {
                    const manualActual = monthData[`${category}_Actual`] || 0;
                    actualVal += manualActual;
                }
                return {
                    name: t.name,
                    index: t.index,
                    Budget: budgetVal,
                    Actual: actualVal
                };
            });
        };

        setMainChartData(buildData('Geral'));
        setPpriChartData(buildData('PPRI'));
        setDiariasChartData(buildData('Diárias'));

    }, [trendExpenses, expenses, isBudgetModalOpen]);

    // KPI Totals
    const totalActual = useMemo(() => kpiExpenses.reduce((acc, item) => acc + parseCurrency(item.val), 0), [kpiExpenses]);
    
    const totalBudget = useMemo(() => {
        if (selectedMonth) {
            const monthIdx = parseInt(selectedMonth);
            return mainChartData[monthIdx]?.Budget || 0;
        }
        return mainChartData.reduce((acc, item) => acc + item.Budget, 0);
    }, [mainChartData, selectedMonth]);

    // Sidebar & Rankings
    const collaborators = useMemo(() => {
        const unique = new Set(expenses.map(e => e.name));
        return Array.from(unique).filter(Boolean).sort();
    }, [expenses]);

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

    // Modal Handlers
    const openBudgetModal = () => {
        if (!hasPermission('manage_budget')) return;

        let savedData: { [month: string]: { [key: string]: number } } = {};
        try {
            const stored = localStorage.getItem('FINANCE_CORE_DATA_V3');
            if (stored) savedData = JSON.parse(stored);
        } catch (e) {}

        const currentBudgetsState: { [month: string]: { [key: string]: string } } = {};
        mainChartData.forEach((item) => {
            const mData = savedData[item.name] || {};
            currentBudgetsState[item.name] = {
                'Geral_Budget': (mData['Geral_Budget'] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                'PPRI_Budget': (mData['PPRI_Budget'] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                'PPRI_Actual': (mData['PPRI_Actual'] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                'Diárias_Budget': (mData['Diárias_Budget'] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                'Diárias_Actual': (mData['Diárias_Actual'] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            };
        });
        setTempData(currentBudgetsState);
        setIsBudgetModalOpen(true);
    };

    const handleDataChange = (month: string, keySuffix: string, value: string) => {
        const numericValue = value.replace(/\D/g, '');
        const floatValue = Number(numericValue) / 100;
        const formatted = floatValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        setTempData(prev => ({
            ...prev,
            [month]: {
                ...prev[month],
                [`${activeBudgetTab}_${keySuffix}`]: formatted
            }
        }));
    };

    const saveData = () => {
        let existingStore: { [month: string]: { [key: string]: number } } = {};
        try {
            const stored = localStorage.getItem('FINANCE_CORE_DATA_V3');
            if (stored) existingStore = JSON.parse(stored);
        } catch(e) {}

        Object.keys(tempData).forEach(month => {
            const monthObj = tempData[month];
            const getVal = (fullKey: string) => {
                const str = monthObj[fullKey];
                if (!str) return 0;
                const num = parseFloat(str.replace(/\./g, '').replace(',', '.'));
                return isNaN(num) ? 0 : num;
            };
            existingStore[month] = {
                ...(existingStore[month] || {}),
                'Geral_Budget': getVal('Geral_Budget'),
                'PPRI_Budget': getVal('PPRI_Budget'),
                'PPRI_Actual': getVal('PPRI_Actual'),
                'Diárias_Budget': getVal('Diárias_Budget'),
                'Diárias_Actual': getVal('Diárias_Actual'),
            };
        });
        localStorage.setItem('FINANCE_CORE_DATA_V3', JSON.stringify(existingStore));
        setIsBudgetModalOpen(false);
    };

    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    const renderBarChart = (data: any[], colorActual: string, colorBudget: string, title: string) => (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} tickFormatter={(value) => `R$${value/1000}k`} />
                <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ backgroundColor: '#162b35', borderColor: '#2c3e50', color: '#f1f5f9', fontSize: '12px', borderRadius: '4px' }}
                    itemStyle={{ color: '#f1f5f9' }}
                    formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                />
                <Legend iconType="rect" iconSize={10} wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                <Bar dataKey="Budget" name="Orçado" fill={colorBudget} radius={[2, 2, 0, 0]} barSize={20} />
                <Bar dataKey="Actual" name="Realizado" fill={colorActual} radius={[2, 2, 0, 0]} barSize={20} />
            </BarChart>
        </ResponsiveContainer>
    );

    return (
        <div className="flex h-full overflow-hidden relative">
            {isBudgetModalOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-card-dark w-full max-w-4xl rounded-xl shadow-2xl border border-slate-200 dark:border-border-dark flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold flex items-center gap-2 dark:text-white">
                                    <span className="material-symbols-outlined text-primary">edit_document</span>
                                    Gestão de Metas e Realizados
                                </h2>
                                <button onClick={() => setIsBudgetModalOpen(false)} className="text-slate-400 hover:text-red-500">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            
                            <div className="flex space-x-1 bg-slate-100 dark:bg-surface-dark p-1 rounded-lg">
                                {['Geral', 'PPRI', 'Diárias'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveBudgetTab(tab as any)}
                                        className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                                            activeBudgetTab === tab 
                                            ? 'bg-white dark:bg-card-dark text-primary shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 text-center">
                                Editando: <strong className="text-primary">{activeBudgetTab}</strong>
                            </p>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {mainChartData.map((item) => (
                                <div key={item.name} className="bg-slate-50 dark:bg-surface-dark/30 p-3 rounded border border-slate-100 dark:border-slate-800">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider block mb-2 border-b border-slate-200 dark:border-slate-700 pb-1">{item.name}</label>
                                    
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">Meta (Orçado)</span>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                                                <input 
                                                    type="text" 
                                                    inputMode="numeric"
                                                    value={tempData[item.name]?.[`${activeBudgetTab}_Budget`] || '0,00'}
                                                    onChange={(e) => handleDataChange(item.name, 'Budget', e.target.value)}
                                                    className="w-full pl-7 pr-2 py-1.5 bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded text-sm text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-primary outline-none font-mono text-right"
                                                    placeholder="0,00"
                                                />
                                            </div>
                                        </div>

                                        {activeBudgetTab !== 'Geral' && (
                                             <div className="space-y-1">
                                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold">Realizado (Manual)</span>
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                                                    <input 
                                                        type="text" 
                                                        inputMode="numeric"
                                                        value={tempData[item.name]?.[`${activeBudgetTab}_Actual`] || '0,00'}
                                                        onChange={(e) => handleDataChange(item.name, 'Actual', e.target.value)}
                                                        className="w-full pl-7 pr-2 py-1.5 bg-white dark:bg-card-dark border border-emerald-200 dark:border-emerald-900/50 rounded text-sm text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-emerald-500 outline-none font-mono text-right"
                                                        placeholder="0,00"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-surface-dark/50 rounded-b-xl">
                            <button onClick={() => setIsBudgetModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white transition-colors">Cancelar</button>
                            <button onClick={saveData} className="px-6 py-2 bg-primary text-white text-sm font-bold rounded shadow-lg shadow-primary/20 hover:bg-blue-700 transition-transform active:scale-95">Salvar Dados</button>
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
                    <div className="space-y-3">
                         <div className="relative">
                            <input className="w-full bg-slate-100 dark:bg-accent-teal/30 border-none rounded py-2 px-3 text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-slate-200 placeholder-slate-400" placeholder="Buscar entidade..." type="text"/>
                            <span className="material-symbols-outlined absolute right-2 top-2 text-slate-400 text-sm">search</span>
                        </div>
                        <button 
                            onClick={() => setSelectedCollaborator(null)}
                            className={`w-full text-left px-3 py-2 text-xs font-bold rounded transition-colors uppercase border border-dashed ${!selectedCollaborator 
                                ? 'bg-primary/10 text-primary border-primary/50' 
                                : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
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
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold dark:text-white">Visão Geral de Análises</h1>
                        {selectedCollaborator && (
                            <p className="text-xs text-primary font-bold uppercase mt-1 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">person</span>
                                {selectedCollaborator}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative min-w-[100px]">
                            <select 
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                className="w-full appearance-none bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 hover:border-primary px-3 py-2 rounded text-sm font-semibold outline-none focus:ring-2 focus:ring-primary cursor-pointer shadow-sm text-slate-700 dark:text-slate-200"
                            >
                                {availableYears.length === 0 && <option value="">Ano</option>}
                                {availableYears.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">calendar_month</span>
                        </div>
                        <div className="relative min-w-[140px]">
                            <select 
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="w-full appearance-none bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 hover:border-primary px-3 py-2 rounded text-sm font-semibold outline-none focus:ring-2 focus:ring-primary cursor-pointer shadow-sm text-slate-700 dark:text-slate-200"
                            >
                                <option value="">Ano Inteiro</option>
                                {months.map((m, i) => (
                                    <option key={i} value={i}>{m}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">expand_more</span>
                        </div>
                        <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-1 hidden md:block"></div>
                        
                        {hasPermission('manage_budget') && (
                            <button onClick={() => { setActiveBudgetTab('Geral'); openBudgetModal(); }} className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2 rounded text-sm font-semibold flex items-center gap-2 transition-colors">
                                <span className="material-symbols-outlined text-sm">edit</span> Metas & Dados
                            </button>
                        )}
                        
                        {hasPermission('import_data') && (
                            <Link to="/import" className="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-primary/20">
                                <span className="material-symbols-outlined text-sm">upload</span> Importar
                            </Link>
                        )}
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
                            <div className="text-2xl font-bold dark:text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalBudget)}</div>
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
                    <div className="bg-white dark:bg-card-dark p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between relative overflow-hidden">
                        <div className="w-24 h-24 relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={totalBudget > 0 ? [{ name: 'Utilizado', value: totalActual }, { name: 'Restante', value: Math.max(0, totalBudget - totalActual) }] : [{name: 'Sem Orçamento', value: 1}]} innerRadius={25} outerRadius={35} paddingAngle={5} dataKey="value" startAngle={90} endAngle={-270} stroke="none">
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
                             <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-chart-blue opacity-30"></span> <span className="text-slate-600 dark:text-slate-300">Disponível</span></div>
                            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary"></span> <span className="text-slate-600 dark:text-slate-300">Utilizado</span></div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white dark:bg-card-dark p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                VIAGEM: ORÇADO VS REALIZADO <span className="text-[10px] text-slate-500 font-normal">({selectedYear})</span>
                            </h3>
                            <div className="flex items-center gap-4 text-[10px] font-semibold">
                                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-primary rounded-sm"></span> Orçado</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-chart-blue rounded-sm"></span> Realizado</span>
                            </div>
                        </div>
                        <div className="h-64 w-full">
                            {renderBarChart(mainChartData, '#3388a1', '#135bec', 'Geral')}
                        </div>
                    </div>
                    
                    <div className="bg-white dark:bg-card-dark p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col">
                        <h3 className="text-xs font-bold uppercase tracking-wide mb-6 text-slate-700 dark:text-slate-200 flex justify-between">
                            Top 5 Custos <span className="text-[10px] text-slate-500 font-normal">({selectedMonth ? months[parseInt(selectedMonth)] : 'Total'})</span>
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
                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-surface-dark flex items-center justify-center font-bold text-slate-500 text-xs shadow-sm">{i + 1}</div>
                                        <div className="flex-1">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="font-semibold truncate max-w-[120px] uppercase dark:text-slate-300">{type}</span>
                                                <span className="font-mono dark:text-slate-300">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}</span>
                                            </div>
                                            <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${(value / costRanking[0][1]) * 100}%` }}></div></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                             {hasPermission('view_review') ? (
                                 <Link to="/review" className="block w-full text-center py-2 text-xs font-semibold text-primary hover:bg-primary/5 rounded transition-colors uppercase tracking-wider">Ver Relatório Completo</Link>
                             ) : (
                                 <span className="block w-full text-center py-2 text-xs font-semibold text-slate-400 cursor-not-allowed uppercase tracking-wider">Acesso Restrito</span>
                             )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                    <div className="bg-white dark:bg-card-dark p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col min-h-[300px]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">PPRI: ORÇADO VS REALIZADO</h3>
                            {hasPermission('manage_budget') && (
                                <button onClick={() => { setActiveBudgetTab('PPRI'); openBudgetModal(); }} className="text-[10px] text-primary hover:underline font-bold flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">edit</span> Editar Metas/Dados
                                </button>
                            )}
                        </div>
                        <div className="flex-1 w-full h-full relative">
                             {renderBarChart(ppriChartData, '#135bec', '#93c5fd', 'PPRI')}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-card-dark p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col min-h-[300px]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">Diárias: Orçado vs Realizado</h3>
                             {hasPermission('manage_budget') && (
                                <button onClick={() => { setActiveBudgetTab('Diárias'); openBudgetModal(); }} className="text-[10px] text-primary hover:underline font-bold flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">edit</span> Editar Metas/Dados
                                </button>
                            )}
                        </div>
                        <div className="flex-1 w-full h-full relative">
                             {renderBarChart(diariasChartData, '#3388a1', '#93c5fd', 'Diárias')}
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
};

export default DashboardPage;