"use client";

import React, { useState, useRef } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { processAndSendDocumentAction } from '@/app/todoc/actions';
import { logger } from '@/lib/logger';
import { Toaster, toast } from 'sonner';
import { cn } from "@/lib/utils";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';

export default function ToDocPage() {
    const { user, isAuthenticated, isLoading: appContextLoading } = useAppContext();
    const [isLoading, setIsLoading] = useState(false);
    
    // State for all configurable fields
    const [docCode, setDocCode] = useState('РК.ТТ-761.102 ПЗ');
    const [docTitle, setDocTitle] = useState('РЕФЕРАТ');
    const [razrab, setRazrab] = useState('Иванов И.И.');
    const [prov, setProv] = useState('Петров П.П.');
    const [nkontr, setNkontr] = useState('Сидоров С.С.');
    const [utv, setUtv] = useState('Смирнов А.А.');
    const [lit, setLit] = useState('У');
    const [orgName, setOrgName] = useState('ВНУ им. В. Даля\nКафедра ТТ\nГруппа ТТ-761');

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            setSelectedFile(null);
            return;
        }

        if (!file.name.endsWith('.docx')) {
            toast.error("Поддерживаются только .docx файлы.");
            setSelectedFile(null);
            if(fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        setSelectedFile(file);
    };

    const handleProcessAndSend = async () => {
        if (!selectedFile) {
            toast.error('Пожалуйста, выберите .docx файл для обработки.');
            return;
        }
        if (!user?.id) {
            toast.error('Информация о пользователе недоступна. Убедитесь, что вы авторизованы через Telegram.');
            return;
        }

        setIsLoading(true);
        toast.loading('Обработка DOCX файла... Это может занять некоторое время.', { id: 'doc-processing-toast' });

        const formData = new FormData();
        formData.append('document', selectedFile);
        formData.append('docCode', docCode);
        formData.append('docTitle', docTitle);
        formData.append('razrab', razrab);
        formData.append('prov', prov);
        formData.append('nkontr', nkontr);
        formData.append('utv', utv);
        formData.append('lit', lit);
        formData.append('orgName', orgName);
        
        try {
            const result = await processAndSendDocumentAction(formData, String(user.id));

            if (result.success) {
                toast.success(result.message || 'Документ успешно обработан и отправлен в Telegram!', { id: 'doc-processing-toast' });
            } else {
                toast.error(result.error || 'Произошла неизвестная ошибка.', { id: 'doc-processing-toast', duration: 8000 });
            }
        } catch (error) {
            logger.error('[ToDocPage] Error calling action:', error);
            const errorMessage = error instanceof Error ? error.message : 'Непредвиденная ошибка на клиенте.';
            toast.error(errorMessage, { id: 'doc-processing-toast', duration: 8000 });
        } finally {
            setIsLoading(false);
        }
    };

    if (appContextLoading) return ( <div className="flex flex-col justify-center items-center min-h-screen"><VibeContentRenderer content="::FaSpinner className='animate-spin text-brand-purple text-4xl'::" /><span className="mt-4">Загрузка...</span></div> );
    if (!isAuthenticated) return ( <div className="min-h-screen flex flex-col items-center justify-center text-center p-6"><VibeContentRenderer content="::FaLock className='text-7xl text-brand-red mb-6'::" /> <h1 className="text-3xl font-bold mb-4">Доступ закрыт</h1> <p className="mb-8">Пожалуйста, авторизуйтесь через Telegram.</p> <Link href="/"><Button variant="outline">На главную</Button></Link> </div> );

    return (
        <div className={cn("min-h-screen flex flex-col items-center justify-center pt-24 sm:pt-12 pb-10", "bg-gradient-to-br from-gray-900 via-blue-900/50 to-gray-900 text-foreground px-4 font-sans")}>
            <Toaster position="bottom-center" richColors theme="dark" toastOptions={{ className: '!font-mono !shadow-lg' }} />
            <div className="w-full max-w-3xl mx-auto p-6 md:p-8 space-y-8 bg-card rounded-xl shadow-xl border border-border/50">
                <div className="text-center">
                    <VibeContentRenderer content="::FaFileWord className='text-5xl text-brand-blue mx-auto mb-4'::" />
                    <h1 className="text-3xl font-orbitron font-bold text-foreground">DOCX Процессор с Колонтитулом</h1>
                    <p className="text-muted-foreground mt-2">Загрузите DOCX, настройте колонтитул и получите готовый документ с сохраненным текстом и картинками.</p>
                </div>
                
                <div className="space-y-6">
                     <div>
                        <Label htmlFor="doc-file-upload" className="text-lg font-semibold">1. Загрузите ваш .docx файл</Label>
                        <div className="mt-2">
                           <Input 
                                id="doc-file-upload"
                                ref={fileInputRef}
                                type="file"
                                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                onChange={handleFileChange}
                                className="input-cyber file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-blue/10 file:text-brand-blue hover:file:bg-brand-blue/20"
                                disabled={isLoading}
                            />
                        </div>
                    </div>


                    <div className="border-t border-border/50 pt-6">
                      <h3 className="text-lg font-semibold mb-4">2. Настройте данные колонтитула</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <div><Label htmlFor="docCode">Код документа</Label><Input id="docCode" value={docCode} onChange={e => setDocCode(e.target.value)} className="input-cyber mt-1"/></div>
                        <div><Label htmlFor="docTitle">Название документа</Label><Input id="docTitle" value={docTitle} onChange={e => setDocTitle(e.target.value)} className="input-cyber mt-1"/></div>
                        <div><Label htmlFor="razrab">Разработал</Label><Input id="razrab" value={razrab} onChange={e => setRazrab(e.target.value)} className="input-cyber mt-1"/></div>
                        <div><Label htmlFor="prov">Проверил</Label><Input id="prov" value={prov} onChange={e => setProv(e.target.value)} className="input-cyber mt-1"/></div>
                        <div><Label htmlFor="nkontr">Н. контроль</Label><Input id="nkontr" value={nkontr} onChange={e => setNkontr(e.target.value)} className="input-cyber mt-1"/></div>
                        <div><Label htmlFor="utv">Утвердил</Label><Input id="utv" value={utv} onChange={e => setUtv(e.target.value)} className="input-cyber mt-1"/></div>
                        <div><Label htmlFor="lit">Лит.</Label><Input id="lit" value={lit} onChange={e => setLit(e.target.value)} className="input-cyber mt-1"/></div>
                        <div className="sm:col-span-2 md:col-span-3">
                            <Label htmlFor="orgName">Организация (каждая строка с новой строки)</Label>
                            <Textarea id="orgName" value={orgName} onChange={e => setOrgName(e.target.value)} className="input-cyber mt-1" rows={3}/>
                        </div>
                      </div>
                    </div>

                    <Button onClick={handleProcessAndSend} disabled={isLoading || !selectedFile} size="lg" className="w-full bg-brand-gradient-purple-blue text-white font-semibold py-3 text-lg">
                        {isLoading 
                            ? <><VibeContentRenderer content="::FaSpinner className='animate-spin mr-2'::"/> Обработка...</> 
                            : <><VibeContentRenderer content="::FaPoo className='mr-2'::"/> 3. Сгенерировать и отправить в TG</>
                        }
                    </Button>
                </div>
            </div>
        </div>
    );
}