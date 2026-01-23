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
    
    // UI States
    const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Data States
    const [file, setFile] = useState<File | null>(null);
    const [urlInput, setUrlInput] = useState('');

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

    // --- HELPER FUNCTIONS ---

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

    const normalizeDate = (val: any): string => {
        if (!val) return 'N/A';
        if (val instanceof Date) {
            const day = String(val.getUTCDate()).padStart(2, '0');
            const month = String(val.getUTCMonth() + 1).padStart(2, '0');
            const year = val.getUTCFullYear();
            return `${day}/${month}/${year}`;
        }
        const asNumber = Number(val);
        if (!isNaN(asNumber) && asNumber > 20000 && asNumber < 60000) {
            const date = new Date(Math.round((asNumber - 25569) * 86400 * 1000));
            const day = String(date.getUTCDate()).padStart(2, '0');
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const year = date.getUTCFullYear();
            return `${day}/${month}/${year}`;
        }
        const strVal = String(val).trim();
        if (strVal.match(/^\d{4}-\d{2}-\d{2}/)) {
            const [y, m, d] = strVal.split('-');
            return `${d}/${m}/${y}`;
        }
        if (strVal.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
             const parts = strVal.split('/');
             const d = parts[0].padStart(2, '0');
             const m = parts[1].padStart(2, '0');
             const y = parts[2];
             return `${d}/${m}/${y}`;
        }
        return strVal;
    }

    // --- CORE PROCESSING LOGIC (Reusable for File & URL) ---
    const processWorkbookData = (workbook: XLSX.WorkBook) => {
        try {
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: true, defval: "" });

            const currentYear = new Date().getFullYear();

            const mappedData: ExpenseItem[] = jsonData.map((row: any) => {
                const valRaw = getRowValue(row, 'VALOR', 'Valor', 'Vlr', 'Quantia');
                const nameRaw = getRowValue(row, 'COLABORADOR PARA DEPOSITO', 'Colaborador', 'Nome', 'Funcionário');
                const dateRaw = getRowValue(row, 'DATA', 'Data', 'Dt', 'Dia', 'DATA DO PAGAMENTO');
                const typeRaw = getRowValue(row, 'FINALIDADE', 'Finalidade', 'Categoria', 'Tipo', 'Descrição');
                const idRaw = getRowValue(row, 'Nº INT.', 'Nº INT', 'N INT', 'ID', 'Código', 'N. Int', 'N° INT.');

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
                
                let finalType = typeRaw ? String(typeRaw) : 'Geral';
                const lowerType = finalType.toLowerCase();
                const lowerName = finalName.toLowerCase();

                if (!finalType.toUpperCase().includes('PPRI') && !finalType.toUpperCase().includes('DIÁRIA')) {
                    if (lowerType.includes('ppri') || lowerName.includes('ppri')) {
                        finalType = 'PPRI';
                    } else if (lowerType.includes('diaria') || lowerType.includes('diária') || lowerName.includes('diaria') || lowerName.includes('diária')) {
                        finalType = 'Diárias';
                    }
                } else {
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
            console.error("Error processing workbook:", error);
            alert("Erro ao processar os dados da planilha. Verifique o layout.");
            setIsProcessing(false);
        }
    };

    // --- HANDLERS ---

    // 1. Local File Handler
    const processLocalFile = async () => {
        if (!file) return;
        setIsProcessing(true);

        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target?.result;
            if (!data) return;
            const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
            processWorkbookData(workbook);
        };
        reader.readAsBinaryString(file);
    };

    // 2. URL Handler
    const processUrl = async () => {
        if (!urlInput) return;
        setIsProcessing(true);

        try {
            // Fetch as ArrayBuffer to handle both CSV and XLSX
            const response = await fetch(urlInput);
            if (!response.ok) throw new Error('Falha ao baixar arquivo');
            
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
            processWorkbookData(workbook);
        } catch (error) {
            console.error(error);
            alert("Erro ao acessar a URL. Certifique-se que o link é público (Arquivo -> Compartilhar -> Publicar na Web -> CSV/XLSX) e permite acesso.");
            setIsProcessing(false);
        }
    };

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
            setActiveTab('upload');
        }
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
                
                {/* Header */}
                <div>
                    <h2 className="text-2xl font-bold dark:text-white">Importar Dados</h2>
                    <p className="text-slate-500 dark:text-slate-400">Escolha a fonte dos seus dados financeiros.</p>
                </div>

                {/* Tabs */}
                <div className="flex space-x-1 bg-slate-100 dark:bg-surface-dark p-1 rounded-lg w-full md:w-fit">
                    <button
                        onClick={() => setActiveTab('upload')}
                        className={`px-6 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${
                            activeTab === 'upload' 
                            ? 'bg-white dark:bg-card-dark text-primary shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                    >
                        <span className="material-symbols-outlined text-lg">upload_file</span> Upload Local
                    </button>
                    <button
                        onClick={() => setActiveTab('url')}
                        className={`px-6 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${
                            activeTab === 'url' 
                            ? 'bg-white dark:bg-card-dark text-primary shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                    >
                        <span className="material-symbols-outlined text-lg">link</span> Planilha Online
                    </button>
                </div>

                {/* Content Area */}
                <div className="bg-white dark:bg-card-dark rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm min-h-[300px] flex flex-col justify-center">
                    
                    {activeTab === 'upload' ? (
                        /* UPLOAD TAB */
                        <div 
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`relative border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center transition-all cursor-pointer group h-full
                                ${isDragging 
                                    ? 'border-primary bg-primary/5 scale-[1.01]' 
                                    : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                        >
                            <input 
                                type="file" 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => { if(e.target.files && e.target.files[0]) setFile(e.target.files[0]); }}
                                accept=".xlsx, .xls, .csv"
                            />
                            <div className="bg-primary/10 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform duration-300">
                                <span className="material-symbols-outlined text-primary text-4xl">
                                    {file ? 'description' : 'cloud_upload'}
                                </span>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                                {file ? file.name : 'Arraste ou Selecione seu arquivo'}
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                                {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Suporta .xlsx, .xls e .csv'}
                            </p>
                        </div>
                    ) : (
                        /* URL TAB */
                        <div className="flex flex-col items-center justify-center space-y-6 h-full text-center max-w-lg mx-auto">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-4xl text-green-600 dark:text-green-400">table_chart</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Conectar Google Sheets</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                    No Google Sheets, vá em <strong>Arquivo {'>'} Compartilhar {'>'} Publicar na Web</strong>.
                                    Selecione o formato <strong>CSV</strong> ou <strong>Excel</strong> e cole o link abaixo.
                                </p>
                            </div>
                            <div className="w-full relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">link</span>
                                <input 
                                    type="text" 
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all dark:text-white"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Detected Layout Section */}
                <section className="space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold flex items-center gap-2 dark:text-white">
                            <span className="material-symbols-outlined text-primary">alt_route</span> Mapeamento
                        </h2>
                        {file || urlInput ? (
                            <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">check</span> Fonte: {activeTab === 'upload' ? 'Arquivo Local' : 'Link Web'}
                            </span>
                        ) : null}
                    </div>
                    
                    {/* Collapsible or simple view of mappings */}
                    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                             <span className="material-symbols-outlined text-sm">info</span>
                             O sistema tentará identificar automaticamente as colunas abaixo no arquivo fornecido.
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                            {detectedColumns.map((field, i) => (
                                <div key={i} className="flex items-center gap-3 p-2 rounded border border-slate-100 dark:border-slate-800/50">
                                    <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                        {i+1}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold dark:text-slate-200">{field.sys}</span>
                                        <span className="text-[10px] text-slate-400">Busca: {field.excelCol}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                    <button onClick={() => { setFile(null); setUrlInput(''); }} className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors">Limpar Seleção</button>
                    
                    <button 
                        onClick={activeTab === 'upload' ? processLocalFile : processUrl} 
                        disabled={(!file && !urlInput) || isProcessing}
                        className={`px-8 py-3 text-sm font-bold bg-primary text-white rounded-lg shadow-lg shadow-primary/20 flex items-center gap-2 transition-all transform active:scale-95 ${((!file && !urlInput) || isProcessing) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
                    >
                        {isProcessing ? (
                            <>
                                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> Processando...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-lg">sync_saved_locally</span> 
                                {activeTab === 'upload' ? 'Importar Arquivo' : 'Baixar e Importar'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportPage;