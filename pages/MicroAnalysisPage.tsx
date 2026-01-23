import React, { useState, useMemo, useEffect } from 'react';
import { useExpenses } from '../context/ExpenseContext';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const MicroAnalysisPage: React.FC = () => {
    const { expenses } = useExpenses();
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    // Chaves usadas no localStorage (DashboardPage usa abreviações)
    const monthKeys = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    // --- HELPER FUNCTIONS ---
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

    const formatMoney = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    // --- DATA AGGREGATION ---
    const analysisData = useMemo(() => {
        // 1. Get Budget Data from LocalStorage
        let budgets: any = {};
        try {
            const stored = localStorage.getItem('FINANCE_CORE_DATA_V3');
            if (stored) budgets = JSON.parse(stored);
        } catch(e) {}

        const monthIndex = parseInt(selectedMonth);
        const monthKey = monthKeys[monthIndex]; // Use a chave abreviada (Jan, Fev...)
        const monthBudget = budgets[monthKey] || {};
        
        const totalBudget = monthBudget['Geral_Budget'] || 0;
        const ppriBudget = monthBudget['PPRI_Budget'] || 0;
        const diariasBudget = monthBudget['Diárias_Budget'] || 0;
        const othersBudget = Math.max(0, totalBudget - ppriBudget - diariasBudget);

        // 2. Filter Actuals
        const filteredExpenses = expenses.filter(item => {
            const parts = item.date.split('/');
            if (parts.length !== 3) return false;
            const itemMonth = parseInt(parts[1]) - 1;
            const itemYear = parts[2];
            return itemMonth.toString() === selectedMonth && itemYear === selectedYear;
        });

        // 3. Group Actuals by Category
        const actuals = {
            Total: 0,
            PPRI: 0,
            Diárias: 0,
            Outros: 0,
            Breakdown: {} as Record<string, number>
        };

        filteredExpenses.forEach(item => {
            const val = parseCurrency(item.val);
            actuals.Total += val;
            
            const typeUpper = item.type ? item.type.toUpperCase() : 'OUTROS';
            
            // Main buckets
            if (typeUpper.includes('PPRI')) actuals.PPRI += val;
            else if (typeUpper.includes('DIÁRIA') || typeUpper.includes('DIARIA')) actuals.Diárias += val;
            else actuals.Outros += val;

            // Granular breakdown
            actuals.Breakdown[typeUpper] = (actuals.Breakdown[typeUpper] || 0) + val;
        });

        // 4. Calculate Deviations (Gap)
        const deviations = [
            { name: 'PPRI', budget: ppriBudget, actual: actuals.PPRI, gap: actuals.PPRI - ppriBudget, pct: ppriBudget > 0 ? (actuals.PPRI - ppriBudget)/ppriBudget : 0 },
            { name: 'Diárias', budget: diariasBudget, actual: actuals.Diárias, gap: actuals.Diárias - diariasBudget, pct: diariasBudget > 0 ? (actuals.Diárias - diariasBudget)/diariasBudget : 0 },
            { name: 'Outros (Geral)', budget: othersBudget, actual: actuals.Outros, gap: actuals.Outros - othersBudget, pct: othersBudget > 0 ? (actuals.Outros - othersBudget)/othersBudget : 0 }
        ];

        // 5. Sort "Outros" breakdown to find top offenders
        const topOffenders = Object.entries(actuals.Breakdown)
            .sort(([, a], [, b]) => b - a)
            .map(([name, val]) => ({ name, val }));

        return {
            totalBudget,
            totalActual: actuals.Total,
            totalGap: actuals.Total - totalBudget,
            totalGapPct: totalBudget > 0 ? (actuals.Total - totalBudget) / totalBudget : 0,
            deviations,
            topOffenders
        };
    }, [expenses, selectedMonth, selectedYear]);

    // --- CONTROLLER LOGIC ENGINE ---

    // 1. Executive Status
    const getStatus = () => {
        const pct = analysisData.totalGapPct;
        if (pct <= 0) return { label: 'DENTRO DA META', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
        if (pct < 0.10) return { label: 'ALERTA AMARELO', color: 'text-amber-500', bg: 'bg-amber-500/10' };
        return { label: 'CRÍTICO', color: 'text-red-500', bg: 'bg-red-500/10' };
    };

    const status = getStatus();

    // 2. Identification of Root Causes (Heuristics)
    const getCausality = (item: {name: string, gap: number, pct: number}) => {
        const name = item.name.toUpperCase();
        
        if (item.gap <= 0) return { type: 'Eficiência', desc: 'Gastos controlados abaixo do orçado.' };

        if (name.includes('PPRI')) {
            return { type: 'Fator Externo / Escopo', desc: 'Provável aumento no preço do combustível ou rodagem acima do planejado (rotas não otimizadas).' };
        }
        if (name.includes('DIÁRIA') || name.includes('DIARIA')) {
            return { type: 'Erro de Planejamento', desc: 'Número de dias em campo superior ao orçado ou equipe maior que a prevista.' };
        }
        if (name.includes('OUTROS')) {
            return { type: 'Escopo', desc: 'Despesas não categorizadas ou emergenciais consumindo a reserva técnica.' };
        }
        
        // General Logic
        if (item.pct > 0.5) return { type: 'Erro de Planejamento', desc: 'Orçamento severamente subestimado para a realidade da operação.' };
        return { type: 'Ineficiência Operacional', desc: 'Pequenos desvios acumulados ou compras de última hora com preço premium.' };
    };

    // 3. Action Plan Recommendations
    const getActions = () => {
        const actions = [];
        const worst = analysisData.deviations.reduce((prev, current) => (prev.gap > current.gap) ? prev : current);

        if (analysisData.totalGap <= 0) {
            actions.push({ title: 'Manutenção de Controle', desc: 'Manter a política atual de aprovações. Identificar áreas com "savings" para possível realocação futura.' });
            actions.push({ title: 'Análise de Histórico', desc: 'Verificar se o orçamento não está superestimado (folga excessiva) para ajustar metas futuras.' });
            actions.push({ title: 'Benchmarking Interno', desc: 'Replicar as boas práticas deste mês para outros períodos.' });
        } else {
            // Specific Actions based on worst offender
            if (worst.name === 'PPRI') {
                actions.push({ title: 'Auditoria de Rotas', desc: 'Solicitar relatório detalhado de KM rodado vs planejado. Validar justificativas para desvios de rota.' });
                actions.push({ title: 'Política de Abastecimento', desc: 'Verificar média de consumo dos veículos. Há indícios de ineficiência ou veículos desregulados?' });
            } else if (worst.name === 'Diárias') {
                actions.push({ title: 'Revisão de Cronograma', desc: 'Cruzar dias pagos com o cronograma de entrega. Houve atraso na obra que gerou estadias extras?' });
                actions.push({ title: 'Teto de Gastos', desc: 'Reforçar o limite diário por colaborador e exigir pré-aprovação para extensões.' });
            } else {
                actions.push({ title: 'Classificação de "Outros"', desc: 'O item "Outros" está estourando. Realizar "Deep Dive" nas notas fiscais para categorizar corretamente e criar orçamentos específicos.' });
            }
            
            // General Actions for overbudget
            actions.push({ title: 'Congelamento de Gastos Não Essenciais', desc: 'Suspender aprovações de novos custos não críticos até a normalização do fluxo de caixa do projeto.' });
        }
        
        return actions;
    };

    return (
        <div className="flex h-full flex-col min-w-0 overflow-hidden bg-white dark:bg-background-dark">
            {/* Header */}
            <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-border-dark z-10">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-semibold flex items-center gap-2 dark:text-white">
                        <span className="material-symbols-outlined text-primary">psychology</span>
                        Análise Micro de Custos
                    </h1>
                    <div className="hidden md:flex items-center text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2"></span>
                        CONTROLLER_AI_ACTIVE
                    </div>
                </div>
                <div className="flex items-center gap-3">
                     <select 
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-slate-700 rounded text-sm outline-none focus:ring-1 focus:ring-primary dark:text-slate-200"
                    >
                        {months.map((m, i) => (
                            <option key={i} value={i}>{m}</option>
                        ))}
                    </select>
                    <select 
                         value={selectedYear}
                         onChange={(e) => setSelectedYear(e.target.value)}
                         className="px-3 py-1.5 bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-slate-700 rounded text-sm outline-none focus:ring-1 focus:ring-primary dark:text-slate-200"
                    >
                         {['2023', '2024', '2025', '2026'].map(y => (
                             <option key={y} value={y}>{y}</option>
                         ))}
                    </select>
                    <button className="p-2 text-slate-400 hover:text-primary transition-colors" title="Imprimir Relatório">
                        <span className="material-symbols-outlined">print</span>
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-background-dark/50">
                <div className="max-w-6xl mx-auto space-y-6">

                    {/* SECTION 1: EXECUTIVE SUMMARY */}
                    <section className="bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-slate-200 dark:border-border-dark p-6 relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-1 h-full ${status.label === 'CRÍTICO' ? 'bg-red-500' : status.label === 'ALERTA AMARELO' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    1. Resumo Executivo
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Diagnóstico de saúde financeira para <span className="font-semibold text-primary">{months[parseInt(selectedMonth)]}/{selectedYear}</span>.
                                </p>
                            </div>
                            <div className={`px-4 py-2 rounded-lg border ${status.color} ${status.bg} border-current flex items-center gap-2 mt-4 md:mt-0`}>
                                <span className="material-symbols-outlined text-lg">
                                    {status.label === 'DENTRO DA META' ? 'check_circle' : 'warning'}
                                </span>
                                <span className="font-bold text-sm tracking-wider">{status.label}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-4 bg-slate-50 dark:bg-card-dark rounded border border-slate-100 dark:border-slate-700">
                                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Orçamento Total</div>
                                <div className="text-2xl font-mono font-bold text-slate-700 dark:text-slate-200">{formatMoney(analysisData.totalBudget)}</div>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-card-dark rounded border border-slate-100 dark:border-slate-700">
                                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Realizado Total</div>
                                <div className={`text-2xl font-mono font-bold ${analysisData.totalGap > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                    {formatMoney(analysisData.totalActual)}
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-card-dark rounded border border-slate-100 dark:border-slate-700">
                                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Desvio (Gap)</div>
                                <div className={`text-2xl font-mono font-bold flex items-center gap-2 ${analysisData.totalGap > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                    {analysisData.totalGap > 0 ? '+' : ''}{formatMoney(analysisData.totalGap)}
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 border border-current">
                                        {(analysisData.totalGapPct * 100).toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm text-slate-700 dark:text-slate-300 leading-relaxed border-l-4 border-primary">
                            <strong>Análise do Controller:</strong> Com base no ritmo atual, o projeto apresenta uma tendência 
                            {analysisData.totalGap > 0 ? ' de extrapolação orçamentária.' : ' de estabilidade financeira.'} 
                            {analysisData.totalGap > 0 
                                ? ` Se não houver correção, o desvio de ${(analysisData.totalGapPct * 100).toFixed(1)}% impactará o fluxo de caixa acumulado do ano. Recomenda-se intervenção imediata nos itens críticos listados abaixo.` 
                                : ` Os gastos estão sob controle, gerando uma economia de ${formatMoney(Math.abs(analysisData.totalGap))}. Este valor pode compor uma reserva técnica para meses futuros de alta demanda.`
                            }
                        </div>
                    </section>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* SECTION 2: POINTS OF ATTENTION */}
                        <section className="bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-slate-200 dark:border-border-dark p-6 flex flex-col">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-amber-500">search</span>
                                2. Pontos de Atenção (Gaps)
                            </h2>
                            <div className="flex-1 space-y-4">
                                {analysisData.deviations.sort((a,b) => b.gap - a.gap).map((item, idx) => (
                                    <div key={idx} className="group">
                                        <div className="flex justify-between items-end mb-1">
                                            <span className="text-sm font-semibold dark:text-slate-200">{item.name}</span>
                                            <span className={`text-xs font-mono font-bold ${item.gap > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                {item.gap > 0 ? `Excedido: ${formatMoney(item.gap)}` : `Sobra: ${formatMoney(Math.abs(item.gap))}`}
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden flex">
                                            <div 
                                                className={`h-full ${item.gap > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                                style={{ width: `${Math.min(100, Math.max(0, (item.actual / (item.budget || 1)) * 100))}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                                            <span>Orçado: {formatMoney(item.budget)}</span>
                                            <span>Realizado: {formatMoney(item.actual)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Maiores Ofensores (Top 3 Detalhado)</h4>
                                <div className="space-y-2">
                                    {analysisData.topOffenders.slice(0, 3).map((off, i) => (
                                        <div key={i} className="flex justify-between text-xs p-2 bg-slate-50 dark:bg-card-dark rounded border border-slate-100 dark:border-slate-800">
                                            <span className="font-medium dark:text-slate-300">{off.name}</span>
                                            <span className="font-mono text-slate-600 dark:text-slate-400">{formatMoney(off.val)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* SECTION 3: CAUSALITY */}
                        <section className="bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-slate-200 dark:border-border-dark p-6 flex flex-col">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">analytics</span>
                                3. Análise de Causalidade
                            </h2>
                            <div className="flex-1 space-y-3">
                                {analysisData.deviations.filter(i => i.gap > 0).length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60">
                                        <span className="material-symbols-outlined text-4xl text-emerald-500 mb-2">thumb_up</span>
                                        <p className="text-sm text-slate-500">Nenhum desvio negativo relevante detectado. O diagnóstico indica alta eficiência operacional neste período.</p>
                                    </div>
                                ) : (
                                    analysisData.deviations
                                        .filter(i => i.gap > 0) // Only show problems
                                        .sort((a,b) => b.gap - a.gap)
                                        .map((item, idx) => {
                                            const diagnosis = getCausality(item);
                                            return (
                                                <div key={idx} className="p-3 bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500 rounded-r shadow-sm">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-bold text-sm text-red-700 dark:text-red-400">{item.name}</span>
                                                        <span className="text-[10px] bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 font-semibold uppercase">{diagnosis.type}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
                                                        {diagnosis.desc}
                                                    </p>
                                                </div>
                                            );
                                        })
                                )}
                            </div>
                        </section>
                    </div>

                    {/* SECTION 4: ACTION PLAN */}
                    <section className="bg-slate-800 text-white rounded-xl shadow-lg p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl"></div>
                        <h2 className="text-lg font-bold mb-6 flex items-center gap-2 relative z-10">
                            <span className="material-symbols-outlined text-yellow-400">lightbulb</span>
                            4. Plano de Ação Recomendado
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                            {getActions().map((action, i) => (
                                <div key={i} className="bg-white/10 backdrop-blur-sm border border-white/10 p-5 rounded-lg hover:bg-white/15 transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold mb-3 shadow-lg">
                                        {i + 1}
                                    </div>
                                    <h3 className="font-bold text-sm mb-2 text-yellow-400">{action.title}</h3>
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                        {action.desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>

                </div>
            </div>
        </div>
    );
};

export default MicroAnalysisPage;