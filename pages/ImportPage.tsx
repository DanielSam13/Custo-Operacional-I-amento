import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useExpenses } from '../context/ExpenseContext';
import { ExpenseItem } from '../types';
import { useAuth } from '../context/AuthContext';

const ImportPage: React.FC = () => {
    const navigate = useNavigate();
    const { setExpenses } = useExpenses();
    const { hasPermission } = useAuth();
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    if (!hasPermission('import_data')) {
        return (
            <div className="flex h-full flex-col items-center justify-center p-8 bg-background-light dark:bg-background-dark text-center">
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-4xl text-red-500">block</span>
                </div>
                <h2 className="text-2xl font-bold dark:text-white mb-2">Acesso Negado</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">Você não tem permissão para importar dados financeiros.</p>
                <button onClick={() => navigate('/')} className="px-6 py-2 bg-primary text-white rounded font-bold hover:bg-blue-700 transition-colors">Voltar ao Dashboard</button>
            </div>
        );
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const getRowValue = (row: any, ...possibleKeys: string[]) => {
        const rowKeys = Object.keys(row);
        for (const key of possibleKeys) {
            const exactMatch = row[key];
            if (exactMatch !== undefined && exactMatch !== null) return exactMatch;
            
            const cleanTarget = key.trim().toLowerCase().replace(/\./g, '');
            const foundKey = rowKeys.find(k => k.trim().toLowerCase().replace(/\./g, '') === cleanTarget);
            if (foundKey) return row[foundKey];
        }
        return undefined;
    };

    // Helper to convert Excel Serial Date or strings to DD/MM/YYYY
    const normalizeDate = (val: any): string => {
        if (!val) return 'N/A';

        // 1. Handle Excel Serial Number (e.g. 45300)
        if (typeof val === 'number') {
            // Excel counts from 1900. Approx check for valid recent dates.
            if (val > 20000) {
                const date = new Date(Math.round((val - 25569) * 86400 * 1000));
                const day = String(date.getUTCDate()).padStart(2, '0');
                const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                const year = date.getUTCFullYear();
                return `${day}/${month}/${year}`;
            }
        }

        const strVal = String(val).trim();

        // 2. Handle YYYY-MM-DD (ISO)
        if (strVal.match(/^\d{4}-\d{2}-\d{2}/)) {
            const [y, m, d] = strVal.split('-');
            return `${d}/${m}/${y}`; // Convert to DD/MM/YYYY
        }

        // 3. Handle Already DD/MM/YYYY
        if (strVal.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
             const parts = strVal.split('/');
             const d = parts[0].padStart(2, '0');
             const m = parts[1].padStart(2, '0');
             const y = parts[2];
             return `${d}/${m}/${y}`;
        }
        
        return strVal;
    }

    const processFile = async () => {
        if (!file) return;
        setIsProcessing(true);

        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target?.result;
            if (!data) return;

            try {
                const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: true, defval: "" });

                const currentYear = new Date().getFullYear();

                const mappedData: ExpenseItem[] = jsonData.map((row: any) => {
                    const valRaw = getRowValue(row, 'VALOR', 'Valor', 'Vlr', 'Quantia');
                    const nameRaw = getRowValue(row, 'COLABORADOR PARA DEPOSITO', 'Colaborador', 'Nome', 'Funcionário');
                    const dateRaw = getRowValue(row, 'DATA', 'Data', 'Dt', 'Dia');
                    const typeRaw = getRowValue(row, 'FINALIDADE', 'Finalidade', 'Categoria', 'Tipo', 'Descrição');
                    const idRaw = getRowValue(row, 'Nº INT.', 'Nº INT', 'N INT', 'ID', 'Código', 'N. Int');

                    const valorStr = valRaw ? String(valRaw) : '0';
                    let finalDate = normalizeDate(dateRaw);
                    
                    if (finalDate === 'N/A' || !finalDate.includes('/')) {
                        finalDate = `01/01/${currentYear}`; 
                    }

                    let numericVal = 0;
                    try {
                        const cleanVal = valorStr.replace('R$', '').trim();
                        if (cleanVal.includes(',') && cleanVal.includes('.')) {
                             numericVal = parseFloat(cleanVal.replace(/\./g, '').replace(',', '.'));
                        } else if (cleanVal.includes(',')) {
                            numericVal = parseFloat(cleanVal.replace(',', '.'));
                        } else {
                             numericVal = parseFloat(cleanVal);
                        }
                    } catch (e) {
                        numericVal = 0;
                    }
                    
                    const isExceeded = numericVal > 2000;
                    const finalName = nameRaw ? String(nameRaw).trim() : 'Não Identificado';
                    
                    // Smart Categorization for PPRI and Diárias
                    let finalType = typeRaw ? String(typeRaw) : 'Geral';
                    const lowerType = finalType.toLowerCase();
                    const lowerName = finalName.toLowerCase();

                    // Prioritize detection unless the column explicitly stated "PPRI" in the type column already
                    if (!finalType.toUpperCase().includes('PPRI') && !finalType.toUpperCase().includes('DIÁRIA')) {
                        if (lowerType.includes('ppri') || lowerName.includes('ppri')) {
                            finalType = 'PPRI';
                        } else if (lowerType.includes('diaria') || lowerType.includes('diária') || lowerName.includes('diaria') || lowerName.includes('diária')) {
                            finalType = 'Diárias';
                        }
                    } else {
                        // Normalize existing
                         if (lowerType.includes('ppri')) finalType = 'PPRI';
                         if (lowerType.includes('diaria') || lowerType.includes('diária')) finalType = 'Diárias';
                    }

                    return {
                        id: idRaw ? String(idRaw) : `AUTO-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                        date: finalDate,
                        name: finalName.length > 0 ? finalName : 'Não Identificado',
                        val: valorStr.includes('R$') ? valorStr : `R$ ${valorStr}`,
                        type: finalType,
                        status: 'Pendente', 
                        budget: isExceeded ? 'Exceeded' : 'Within',
                        _numericVal: isNaN(numericVal) ? 0 : numericVal
                    } as any;
                });

                const validData = mappedData.filter((item: any) => {
                    const hasValidValue = item._numericVal > 0.01; 
                    return hasValidValue;
                }).map(item => {
                    const { _numericVal, ...rest } = item as any;
                    return rest as ExpenseItem;
                });

                if (validData.length === 0) {
                    alert("A planilha não contém dados financeiros válidos (valores > 0).");
                    setIsProcessing(false);
                    return;
                }

                setExpenses(validData);
                
                setTimeout(() => {
                    setIsProcessing(false);
                    navigate('/review');
                }, 800);

            } catch (error) {
                console.error("Error parsing excel:", error);
                alert("Erro ao ler o arquivo. Verifique o formato.");
                setIsProcessing(false);
            }
        };

        reader.readAsBinaryString(file);
    };

    const detectedColumns = [
        { sys: 'Data da Despesa', pt: 'Data', excelCol: 'DATA', example: '02/01/2025' },
        { sys: 'Nome do Colaborador', pt: 'Colaborador', excelCol: 'COLABORADOR PARA DEPOSITO', example: 'RAFAEL OLIVEIRA...' },
        { sys: 'CPF', pt: 'CPF', excelCol: 'CPF DO COLABORADOR', example: '073.706.704-73' },
        { sys: 'Tipo de Depósito', pt: 'Tipo', excelCol: 'TIPO DE DEPOSITO', example: 'CXT' },
        { sys: 'Finalidade / Categoria', pt: 'Finalidade', excelCol: 'FINALIDADE', example: 'PASSAGEM' },
        { sys: 'Número Interno', pt: 'Nº Controle', excelCol: 'Nº INT.', example: '630022' },
        { sys: 'Valor da Despesa', pt: 'Valor', excelCol: 'VALOR', example: 'R$ 500,00' }
    ];

    return (
        <div className="flex h-full flex-col overflow-y-auto bg-background-light dark:bg-background-dark p-8">
            <div className="max-w-4xl mx-auto space-y-8 w-full">
                <section>
                    <div className="mb-4">
                        <h2 className="text-2xl font-bold dark:text-white">Importar Dados</h2>
                        <p className="text-slate-500 dark:text-slate-400">Envie sua planilha para mapear e processar as despesas de viagem.</p>
                    </div>
                    
                    <div 
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`relative border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center transition-all cursor-pointer group
                            ${isDragging 
                                ? 'border-primary bg-primary/5 scale-[1.01]' 
                                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <input 
                            type="file" 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleFileChange}
                            accept=".xlsx, .xls, .csv"
                        />
                        <div className="bg-primary/10 p-5 rounded-full mb-4 group-hover:scale-110 transition-transform duration-300">
                            <span className="material-symbols-outlined text-primary text-4xl">
                                {file ? 'check_circle' : 'cloud_upload'}
                            </span>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                            {file ? file.name : 'Arraste e Solte sua planilha aqui'}
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                            {file ? 'Arquivo pronto para processamento' : 'Suporta .xlsx, .xls e .csv'}
                        </p>
                    </div>
                </section>

                <section className="space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold flex items-center gap-2 dark:text-white">
                            <span className="material-symbols-outlined text-primary">alt_route</span> Mapeamento Inteligente
                        </h2>
                        {file ? (
                            <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">check</span> Layout Detectado: {file.name}
                            </span>
                        ) : (
                            <span className="text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500 border border-slate-200 dark:border-slate-700">
                                Aguardando arquivo...
                            </span>
                        )}
                    </div>
                    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Campo do Sistema</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Coluna Excel Detectada</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Prévia (Linha 1)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                                {detectedColumns.map((field, i) => (
                                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 font-medium flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                            <div className="flex flex-col">
                                                <span className="dark:text-slate-200">{field.sys}</span>
                                                <span className="text-[10px] text-slate-400 font-normal">{field.pt}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="relative">
                                                <select className="appearance-none bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded text-xs w-full py-2 pl-3 pr-8 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none cursor-pointer font-medium text-emerald-700 dark:text-emerald-400">
                                                    <option value={field.excelCol} selected>✓ {field.excelCol}</option>
                                                    <option>Ignorar Coluna</option>
                                                </select>
                                                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500 text-sm pointer-events-none">expand_more</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs bg-slate-50/50 dark:bg-slate-900/20 rounded">
                                            {field.example}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                    <button onClick={() => setFile(null)} className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors">Cancelar Importação</button>
                    <div className="flex gap-3">
                        <button className="px-6 py-2 text-sm font-semibold border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300">Validar Dados</button>
                        <button 
                            onClick={processFile} 
                            disabled={!file || isProcessing}
                            className={`px-8 py-2 text-sm font-bold bg-primary text-white rounded shadow-lg shadow-primary/20 flex items-center gap-2 transition-all transform active:scale-95 ${(!file || isProcessing) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
                        >
                            {isProcessing ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> Processando...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-lg">sync_saved_locally</span> Importar Agora
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImportPage;