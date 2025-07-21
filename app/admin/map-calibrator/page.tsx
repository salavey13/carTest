// /app/admin/map-calibrator/page.tsx
"use client";

import { VibeMapCalibrator } from "@/components/VibeMapCalibrator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const INITIAL_MAP_BOUNDS = {
  top:    56.422313387,
  bottom: 56.123051835,
  left:  43.354366846,
  right: 44.435477408,
};

export default function MapCalibratorPage() {
    return (
        <div className="container mx-auto p-4 pt-24">
            <h1 className="text-4xl font-orbitron mb-8 text-brand-cyan">Калибровщик Карты</h1>
            <Card className="max-w-3xl mx-auto">
                <CardHeader>
                    <CardTitle>Инструкция</CardTitle>
                    <CardDescription className="font-mono">
                        Этот инструмент поможет вам определить точные географические границы для любого изображения карты и сохранить их как пресет.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                   <ol className="list-decimal list-inside space-y-2 text-sm">
                        <li>Вставьте URL вашего изображения карты.</li>
                        <li>Нажмите "Начать Калибровку". Появятся два зеленых маркера.</li>
                        <li>Перетащите маркер "Главная Площадь" на место главной площади на вашей карте.</li>
                        <li>Перетащите маркер "Аэропорт" на место аэропорта.</li>
                        <li>Ниже появятся вычисленные географические границы.</li>
                        <li>Введите название для вашего пресета и нажмите "Сохранить".</li>
                   </ol>
                    <div className="pt-4 border-t border-border">
                         <VibeMapCalibrator initialBounds={INITIAL_MAP_BOUNDS} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}