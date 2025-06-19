"use client";

import React, { useState, useRef } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { generateAndSendDocumentAction, extractDataFromDocxAction } from '@/app/todoc/actions';
import { logger } from '@/lib/logger';
import { Toaster, toast } from 'sonner';
import { cn } from "@/lib/utils";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import Image from 'next/image';

const initialDocContent = `> **КИБЕРВАЙБ: ВСТРЕЧАЙ БУДУЩЕЕ, ПОКА ОСТАЛЬНЫЕ ПРОСПАЛИ**

> Сделано на телефоне. Без компа. Без "серьёзных" IDE. Просто Telegram, нейросети и вайб.
> 
> Ты читаешь это — значит, ты в шаге от самого крутого апгрейда за последние 10 лет.

---

### НАСТАЛО ВРЕМЯ. ЧТО ЭТО?
- CYBERVIBE STUDIO — твоя кибер-лаборатория, где ИИ реально помогает, а не просто болтает.
- Всё работает прямо с телефона:
- Грабь код
- Стучи в ИИ идею или баг в пару кликов
- Получай PR с готовым решением
- AI сам находит галлюцинации (иконки, баги, ошибки) и чинит их
- Геймификация
- За каждый шаг — левел-ап, новые перки, ачивки, профит
- Всё как в игре, только ты реально строишь будущее.
`;

export default function ToDocPage() {
    const { user, isAuthenticated, isLoading: appContextLoading } = useAppContext();
    const [isLoading, setIsLoading] = useState(false);
    
    // State for all configurable fields
    const [docContent, setDocContent] = useState(initialDocContent);
    const [docCode, setDocCode] = useState('РК.ТТ-761.102 ПЗ');
    const [docTitle, setDocTitle] = useState('РЕФЕРАТ');
    const [razrab, setRazrab] = useState('Иванов И.И.');
    const [prov, setProv] = useState('Петров П.П.');
    const [nkontr, setNkontr] = useState('Сидоров С.С.');
    const [utv, setUtv] = useState('Смирнов А.А.');
    const [lit, setLit] = useState('У');
    const [orgName, setOrgName] = useState('ВНУ им. В. Даля\nКафедра ТТ\nГруппа ТТ-761');

    const [extractedImageUrls, setExtractedImageUrls] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileExtract = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.docx')) {
            toast.error("Для извлечения данных поддерживаются только .docx файлы.");
            return;
        }

        setIsLoading(true);
        setExtractedImageUrls([]);
        toast.loading("Извлечение текста и изображений из DOCX...", { id: 'extract-toast' });

        try {
            const formData = new FormData();
            formData.append('document', file);
            const result = await extractDataFromDocxAction(formData);

            if (result.success) {
                setDocContent(result.text || '');
                setExtractedImageUrls(result.imageUrls || []);
                toast.success(`Данные извлечены! Найдено изображений: ${result.imageUrls?.length || 0}.`, { id: 'extract-toast' });
            } else {
                toast.error(result.error || "Не удалось извлечь данные.", { id: 'extract-toast' });
            }
        } catch (e) {
            logger.error("File extraction failed", e);
            toast.error("Критическая ошибка при обработке файла.", { id: 'extract-toast' });
        } finally {
            setIsLoading(false);
            if(fileInputRef.current) fileInputRef.current.value = ''; // Reset file input
        }
    };

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
            docDetails: { docCode, docTitle, razrab, prov, nkontr, utv, lit, orgName }
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
    
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success("Ссылка на изображение скопирована!");
        }).catch(() => {
            toast.error("Не удалось скопировать ссылку.");
        });
    };

    if (appContextLoading) return ( <div className="flex flex-col justify-center items-center min-h-screen"><VibeContentRenderer content="::FaSpinner className='animate-spin text-brand-purple text-4xl'::" /><span className="mt-4">Загрузка...</span></div> );
    if (!isAuthenticated) return ( <div className="min-h-screen flex flex-col items-center justify-center text-center p-6"><VibeContentRenderer content="::FaLock className='text-7xl text-brand-red mb-6'::" /> <h1 className="text-3xl font-bold mb-4">Доступ закрыт</h1> <p className="mb-8">Пожалуйста, авторизуйтесь через Telegram.</p> <Link href="/"><Button variant="outline">На главную</Button></Link> </div> );

    return (
        <div className={cn("min-h-screen flex flex-col items-center justify-center pt-24 sm:pt-12 pb-10", "bg-gradient-to-br from-gray-900 via-blue-900/50 to-gray-900 text-foreground px-4 font-sans")}>
            <Toaster position="bottom-center" richColors theme="dark" toastOptions={{ className: '!font-mono !shadow-lg' }} />
            <div className="w-full max-w-4xl mx-auto p-6 md:p-8 space-y-8 bg-card rounded-xl shadow-xl border border-border/50">
                <div className="text-center">
                    <VibeContentRenderer content="::FaFileWord className='text-5xl text-brand-blue mx-auto mb-4'::" />
                    <h1 className="text-3xl font-orbitron font-bold text-foreground">DOCX Генератор с Колонтитулом</h1>
                    <p className="text-muted-foreground mt-2">Заполните поля, вставьте текст и получите готовый документ с основной надписью по ГОСТ.</p>
                </div>
                
                <div className="text-center">
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                        <VibeContentRenderer content="::FaFileImport className='mr-2'::" />
                        Извлечь текст и картинки из .docx
                    </Button>
                    <input type="file" ref={fileInputRef} onChange={handleFileExtract} className="hidden" accept=".docx" />
                </div>

                <div className="space-y-6">
                    <div>
                        <Label htmlFor="docContent" className="text-lg font-semibold">Основной текст документа (поддерживает Markdown)</Label>
                        <Textarea id="docContent" value={docContent} onChange={(e) => setDocContent(e.target.value)} placeholder="Вставьте сюда текст вашего документа..." rows={15} className="w-full mt-2 input-cyber simple-scrollbar" disabled={isLoading}/>
                    </div>

                    {extractedImageUrls.length > 0 && (
                        <div className="border-t border-border/50 pt-6">
                             <h3 className="text-lg font-semibold mb-4">Извлеченные изображения</h3>
                             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {extractedImageUrls.map((url, index) => (
                                    <div key={index} className="group relative aspect-square border border-border rounded-lg overflow-hidden">
                                        <Image src={url} alt={`Extracted image ${index + 1}`} layout="fill" objectFit="cover" className="group-hover:opacity-50 transition-opacity" />
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button size="sm" onClick={() => copyToClipboard(`![Image ${index+1}](${url})`)}><VibeContentRenderer content="::FaCopy::" /></Button>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}

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
                        <div className="sm:col-span-2 md:col-span-3">
                            <Label htmlFor="orgName">Организация (каждая строка с новой строки)</Label>
                            <Textarea id="orgName" value={orgName} onChange={e => setOrgName(e.target.value)} className="input-cyber mt-1" rows={3}/>
                        </div>
                      </div>
                    </div>

                    <Button onClick={handleGenerateAndSend} disabled={isLoading} size="lg" className="w-full bg-brand-gradient-purple-blue text-white font-semibold py-3 text-lg">
                        {isLoading 
                            ? <><VibeContentRenderer content="::FaSpinner className='animate-spin mr-2'::"/> Генерация...</> 
                            : <><VibeContentRenderer content="::FaPlane className='mr-2'::"/> Сгенерировать и отправить в TG</>
                        }
                    </Button>
                </div>
            </div>
        </div>
    );
}