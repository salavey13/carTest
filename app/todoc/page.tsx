"use client";

import React, { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { generateAndSendDocumentAction } from '@/app/todoc/actions';
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
    const [docContent, setDocContent] = useState('Здесь будет основной текст вашего документа.\n\nКаждая новая строка будет новым параграфом.');
    const [docCode, setDocCode] = useState('РК.ТТ-761.102 ПЗ');
    const [docTitle, setDocTitle] = useState('РЕФЕРАТ');
    const [razrab, setRazrab] = useState('Иванов И.И.');
    const [prov, setProv] = useState('Петров П.П.');
    const [nkontr, setNkontr] = useState('Сидоров С.С.');
    const [utv, setUtv] = useState('Смирнов А.А.');
    const [lit, setLit] = useState('У');
    const [list, setList] = useState('3');
    const [listov, setListov] = useState('33');
    const [orgName, setOrgName] = useState('ВНУ им. В. Даля\nКафедра ТТ\nГруппа ТТ-761');

    const handleGenerateAndSend = async () => {
        if (!docContent.trim()) {
            toast.error('Основной текст документа не может быть пустым.');
            return;
        }
        if (!user?.id) {
            toast.error('Информация о пользователе недоступна. Убедитесь, что вы авторизованы через Telegram.');
            return;
        }

        setIsLoading(true);
        toast.loading('Генерация DOCX файла...', { id: 'doc-processing-toast' });

        const payload = {
            docContent,
            docDetails: { docCode, docTitle, razrab, prov, nkontr, utv, lit, list, listov, orgName }
        };

        try {
            const result = await generateAndSendDocumentAction(payload, String(user.id));

            if (result.success) {
                toast.success(result.message || 'Документ успешно сгенерирован и отправлен в Telegram!', { id: 'doc-processing-toast' });
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
        <div className={cn("min-h-screen flex flex-col items-center justify-center pt-24 sm:pt-12 pb-10", "bg-gradient-to-br from-gray-900 via-blue-900/50 to-gray-900 text-foreground px-4 font-sans")}>
            <Toaster position="bottom-center" richColors theme="dark" toastOptions={{ className: '!font-mono !shadow-lg' }} />
            <div className="w-full max-w-3xl mx-auto p-6 md:p-8 space-y-8 bg-card rounded-xl shadow-xl border border-border/50">
                <div className="text-center">
                    <VibeContentRenderer content="::FaFileWord className='text-5xl text-brand-blue mx-auto mb-4'::" />
                    <h1 className="text-3xl font-orbitron font-bold text-foreground">DOCX Генератор с Колонтитулом</h1>
                    <p className="text-muted-foreground mt-2">Введите текст документа и настройте данные для колонтитула (основной надписи).</p>
                </div>

                <div className="space-y-6">
                    <div>
                        <Label htmlFor="docContent" className="text-lg font-semibold">Основной текст документа</Label>
                        <Textarea
                            id="docContent"
                            value={docContent}
                            onChange={(e) => setDocContent(e.target.value)}
                            placeholder="Вставьте сюда текст вашего документа..."
                            rows={10}
                            className="w-full mt-2 input-cyber simple-scrollbar"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="border-t border-border/50 pt-6">
                      <h3 className="text-lg font-semibold mb-4">Настройки колонтитула</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <div><Label htmlFor="docCode">Код документа</Label><Input id="docCode" value={docCode} onChange={e => setDocCode(e.target.value)} className="input-cyber mt-1"/></div>
                        <div><Label htmlFor="docTitle">Название документа</Label><Input id="docTitle" value={docTitle} onChange={e => setDocTitle(e.target.value)} className="input-cyber mt-1"/></div>
                        <div><Label htmlFor="razrab">Разработал</Label><Input id="razrab" value={razrab} onChange={e => setRazrab(e.target.value)} className="input-cyber mt-1"/></div>
                        <div><Label htmlFor="prov">Проверил</Label><Input id="prov" value={prov} onChange={e => setProv(e.target.value)} className="input-cyber mt-1"/></div>
                        <div><Label htmlFor="nkontr">Н. контроль</Label><Input id="nkontr" value={nkontr} onChange={e => setNkontr(e.target.value)} className="input-cyber mt-1"/></div>
                        <div><Label htmlFor="utv">Утвердил</Label><Input id="utv" value={utv} onChange={e => setUtv(e.target.value)} className="input-cyber mt-1"/></div>
                        <div><Label htmlFor="lit">Лит.</Label><Input id="lit" value={lit} onChange={e => setLit(e.target.value)} className="input-cyber mt-1"/></div>
                        <div><Label htmlFor="list">Лист</Label><Input id="list" value={list} onChange={e => setList(e.target.value)} className="input-cyber mt-1"/></div>
                        <div><Label htmlFor="listov">Листов</Label><Input id="listov" value={listov} onChange={e => setListov(e.target.value)} className="input-cyber mt-1"/></div>
                        <div className="sm:col-span-2 md:col-span-3">
                            <Label htmlFor="orgName">Организация (каждая строка с новой строки)</Label>
                            <Textarea id="orgName" value={orgName} onChange={e => setOrgName(e.target.value)} className="input-cyber mt-1" rows={3}/>
                        </div>
                      </div>
                    </div>

                    <Button 
                        onClick={handleGenerateAndSend} 
                        disabled={isLoading}
                        size="lg" 
                        className="w-full bg-brand-gradient-purple-blue text-white font-semibold py-3 text-lg shadow-md hover:opacity-90 transition-opacity"
                    >
                        {isLoading 
                            ? <><VibeContentRenderer content="::FaSpinner className='animate-spin mr-2'::"/> Генерация...</> 
                            : <><VibeContentRenderer content="::FaPooStorm className='mr-2'::"/> Сгенерировать и отправить в Telegram</>
                        }
                    </Button>
                </div>
            </div>
        </div>
    );
}