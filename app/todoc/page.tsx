"use client";

import React, { useState, useRef, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { processAndSendDocumentAction } from '@/app/todoc/actions';
import { logger } from '@/lib/logger';
import { Toaster, toast } from 'sonner';
import { cn } from "@/lib/utils";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ToDocPage() {
    const { user, isAuthenticated, isLoading: appContextLoading } = useAppContext();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string>('Выберите .doc или .docx файл для обработки.');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            setSelectedFile(null);
            setStatusMessage('Файл не выбран. Пожалуйста, попробуйте снова.');
            return;
        }

        if (!file.name.endsWith('.docx') && !file.name.endsWith('.doc')) {
            toast.error('Неверный тип файла. Принимаются только .doc и .docx файлы.');
            setSelectedFile(null);
            if (event.target) event.target.value = "";
            return;
        }
        
        setSelectedFile(file);
        setStatusMessage(`Выбран файл: ${file.name}`);
    };

    const triggerFileSelect = useCallback(() => {
        if (!isLoading) {
            fileInputRef.current?.click();
        }
    }, [isLoading]);

    const handleProcessAndSend = async () => {
        if (!selectedFile) {
            toast.error('Пожалуйста, сначала выберите файл.');
            return;
        }
        if (!user?.id) {
            toast.error('Информация о пользователе недоступна. Убедитесь, что вы авторизованы через Telegram.');
            return;
        }

        setIsLoading(true);
        setStatusMessage('Загрузка и обработка документа...');
        toast.loading('Обработка файла...', { id: 'doc-processing-toast' });

        try {
            const formData = new FormData();
            formData.append('document', selectedFile);

            const result = await processAndSendDocumentAction(formData, String(user.id));

            if (result.success) {
                toast.success(result.message || 'Документ успешно обработан и отправлен в Telegram!', { id: 'doc-processing-toast' });
                setStatusMessage('Готово! Проверьте свой чат в Telegram.');
                setSelectedFile(null);
                if(fileInputRef.current) fileInputRef.current.value = "";
            } else {
                toast.error(result.error || 'Произошла неизвестная ошибка.', { id: 'doc-processing-toast', duration: 8000 });
                setStatusMessage(`Ошибка: ${result.error}`);
            }
        } catch (error) {
            logger.error('[ToDocPage] Error calling action:', error);
            const errorMessage = error instanceof Error ? error.message : 'Непредвиденная ошибка на клиенте.';
            toast.error(errorMessage, { id: 'doc-processing-toast', duration: 8000 });
            setStatusMessage(`Критическая ошибка: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    if (appContextLoading) {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen bg-background text-foreground">
                <VibeContentRenderer content="::FaSpinner className='animate-spin text-brand-purple text-4xl'::" />
                <span className="mt-4 text-lg font-mono">Загрузка данных пользователя...</span>
            </div>
        );
    }
    
    if (!isAuthenticated) {
        return (
             <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center text-foreground">
                <VibeContentRenderer content="::FaLock className='text-7xl text-brand-red mb-6'::" />
                <h1 className="text-3xl sm:text-4xl font-orbitron font-bold text-brand-red mb-4">Доступ закрыт</h1>
                <p className="text-md sm:text-lg text-muted-foreground mb-8 max-w-md">Пожалуйста, авторизуйтесь через Telegram, чтобы использовать этот инструмент.</p>
                <Link href="/hotvibes">
                    <Button variant="outline" className="border-brand-blue text-brand-blue hover:bg-brand-blue/10">
                        <VibeContentRenderer content="::FaArrowLeft:: Назад в Хаб" />
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className={cn("min-h-screen flex flex-col items-center justify-center pt-10 sm:pt-12 pb-10", "bg-gradient-to-br from-gray-900 via-blue-900/50 to-gray-900 text-foreground px-4 font-sans")}>
            <Toaster position="bottom-center" richColors theme="dark" toastOptions={{ className: '!font-mono !shadow-lg' }} />
            <div className="w-full max-w-lg mx-auto p-6 md:p-8 space-y-8 bg-card rounded-xl shadow-xl border border-border/50">
                <div className="text-center">
                    <VibeContentRenderer content="::FaFileWord className='text-5xl text-brand-blue mx-auto mb-4'::" />
                    <h1 className="text-3xl font-orbitron font-bold text-foreground">DOCX Колонтитул-Инжектор</h1>
                    <p className="text-muted-foreground mt-2">Загрузите `.doc` или `.docx` файл, чтобы добавить стандартный колонтитул (основную надпись).</p>
                </div>

                <div className="space-y-4">
                    <div
                      onClick={triggerFileSelect}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') triggerFileSelect(); }}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "w-full flex flex-col items-center justify-center px-6 py-10 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
                        "border-input-border hover:border-brand-blue text-muted-foreground hover:text-brand-blue",
                        isLoading ? "opacity-50 cursor-not-allowed animate-pulse" : "hover:bg-brand-blue/10",
                        selectedFile ? "border-green-500 hover:border-green-400 text-green-400" : ""
                      )}
                    >
                        <VibeContentRenderer content={selectedFile ? "::FaCheckCircle className='text-3xl mb-3'::" : "::FaUpload className='text-3xl mb-3'::"} />
                        <span className="font-semibold text-center">{statusMessage}</span>
                        <input
                            id="doc-file-upload"
                            ref={fileInputRef}
                            type="file"
                            accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            onChange={handleFileChange}
                            className="sr-only"
                            disabled={isLoading}
                        />
                    </div>

                    <Button 
                        onClick={handleProcessAndSend} 
                        disabled={isLoading || !selectedFile}
                        size="lg" 
                        className="w-full bg-brand-gradient-purple-blue text-white font-semibold py-3 text-lg shadow-md hover:opacity-90 transition-opacity"
                    >
                        {isLoading 
                            ? <><VibeContentRenderer content="::FaSpinner className='animate-spin mr-2'::"/> Обработка...</> 
                            : <><VibeContentRenderer content="::FaWandMagicSparkles className='mr-2'::"/> Обработать и отправить в Telegram</>
                        }
                    </Button>
                </div>
                 <div className="text-center text-xs text-muted-foreground/80 pt-4 border-t border-border/30">
                     <p><VibeContentRenderer content="::FaCircleInfo::" /> Этот инструмент использует серверную библиотеку для модификации `.docx` файлов. Файлы старого формата `.doc` требуют установки серверного конвертера (например, `unoconv`) и не поддерживаются напрямую.</p>
                </div>
            </div>
        </div>
    );
}