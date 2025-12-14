import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Upload, Settings, Download, BarChart3, Layers, FileText, AlertCircle } from 'lucide-react';

export default function Documentation() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Документация</h1>
          <p className="text-muted-foreground mt-2">
            Руководство по использованию системы ABC-анализа продаж
          </p>
        </div>

        <Tabs defaultValue="modes" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="modes">Режимы обработки</TabsTrigger>
            <TabsTrigger value="guide">Как использовать</TabsTrigger>
            <TabsTrigger value="output">Выходные файлы</TabsTrigger>
          </TabsList>

          {/* Modes Tab */}
          <TabsContent value="modes" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileSpreadsheet className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      1C_RAW
                      <Badge variant="secondary">Рекомендуемый</Badge>
                    </CardTitle>
                    <CardDescription>Экспорт напрямую из 1С</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  Используйте этот режим для файлов, экспортированных напрямую из 1С:Предприятие.
                  Система автоматически обработает сложную структуру заголовков с объединёнными ячейками.
                </p>
                
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <h4 className="font-medium">Ожидаемый формат файла:</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Первые строки — служебная информация (параметры отчёта, фильтры)</li>
                    <li>Период отчёта в формате «01.10.2024 - 30.09.2025»</li>
                    <li>Многострочные заголовки с объединёнными ячейками</li>
                    <li>Колонки с месяцами: «Октябрь 2024», «Ноябрь 2024» и т.д.</li>
                    <li>Подзаголовки: «Кол-во», «Сумма», «Остаток» для каждого месяца</li>
                  </ul>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <h4 className="font-medium">Автоматическое определение:</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Колонка артикула (по заголовку или паттерну данных)</li>
                    <li>Колонка выручки/суммы</li>
                    <li>Периоды по названиям русских месяцев</li>
                    <li>Диапазон дат отчёта</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary/50 rounded-lg">
                    <Layers className="h-6 w-6 text-foreground" />
                  </div>
                  <div>
                    <CardTitle>RAW</CardTitle>
                    <CardDescription>Простой Excel без сложных заголовков</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  Режим для Excel-файлов с простой структурой — одна строка заголовков, 
                  данные начинаются со второй строки.
                </p>
                
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <h4 className="font-medium">Ожидаемый формат файла:</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Первая строка — заголовки колонок</li>
                    <li>Обязательно: колонка с артикулом</li>
                    <li>Обязательно: колонка с выручкой/суммой</li>
                    <li>Опционально: колонки с категориями, месячными данными</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <FileText className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <CardTitle>PROCESSED</CardTitle>
                    <CardDescription>Уже обработанный файл</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  Используйте этот режим, если файл уже был обработан ранее и содержит 
                  стандартные колонки системы.
                </p>
                
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <h4 className="font-medium">Ожидаемые листы в файле:</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>«Данные» или «data» — основной лист с данными</li>
                    <li>«АБЦ по группам» — опционально, ABC по группам товаров</li>
                    <li>«АБЦ по артикулам» — опционально, ABC по артикулам</li>
                  </ul>
                </div>

                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    ABC-анализ не пересчитывается — используются данные из файла
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Guide Tab */}
          <TabsContent value="guide" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Шаг 1: Загрузка файла
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p>
                  Перетащите Excel-файл (.xlsx, .xls) в область загрузки или кликните для выбора файла.
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Максимальный размер файла: 50 МБ</li>
                  <li>Поддерживаемые форматы: .xlsx, .xls</li>
                  <li>Файл должен содержать хотя бы один лист с данными</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Шаг 2: Выбор режима
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p>
                  Выберите режим обработки, соответствующий формату вашего файла:
                </p>
                <div className="grid gap-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Badge>1C_RAW</Badge>
                    <span className="text-sm">Файл напрямую из 1С со сложными заголовками</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Badge variant="outline">RAW</Badge>
                    <span className="text-sm">Простой Excel с одной строкой заголовков</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Badge variant="outline">PROCESSED</Badge>
                    <span className="text-sm">Уже обработанный ранее файл</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Шаг 3: Обработка
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p>
                  Нажмите «Начать обработку» и дождитесь завершения. Система выполнит:
                </p>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                  <li>Парсинг структуры файла и определение колонок</li>
                  <li>Извлечение артикулов и групп товаров</li>
                  <li>Расчёт ABC-классификации по группам</li>
                  <li>Расчёт ABC-классификации по артикулам</li>
                  <li>Определение периодов и их сортировка</li>
                  <li>Генерация выходных файлов</li>
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Шаг 4: Скачивание результатов
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p>
                  После успешной обработки вы сможете скачать два файла:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li><strong>report_processed.xlsx</strong> — обработанные данные с ABC</li>
                  <li><strong>Production_Plan_Result.xlsx</strong> — итоговый план производства</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Output Tab */}
          <TabsContent value="output" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>report_processed.xlsx</CardTitle>
                <CardDescription>Обработанные данные с ABC-классификацией</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  Файл содержит 3 листа с полными результатами анализа:
                </p>
                
                <div className="space-y-3">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Лист «Данные»</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Все строки исходного файла с добавленными колонками:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Группа товаров</Badge>
                      <Badge variant="outline">Артикул</Badge>
                      <Badge variant="outline">ABC Группа</Badge>
                      <Badge variant="outline">ABC Артикул</Badge>
                      <Badge variant="outline">Категория</Badge>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Лист «АБЦ по группам»</h4>
                    <p className="text-sm text-muted-foreground">
                      Сводная таблица ABC-классификации по группам товаров с выручкой и долей
                    </p>
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Лист «АБЦ по артикулам»</h4>
                    <p className="text-sm text-muted-foreground">
                      Сводная таблица ABC-классификации по отдельным артикулам
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Production_Plan_Result.xlsx</CardTitle>
                <CardDescription>Итоговый файл для планирования</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  Файл аналогичен report_processed.xlsx, но предназначен для использования 
                  в системах планирования производства.
                </p>
                
                <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Может использоваться для импорта в ERP-системы или для дальнейшего 
                    XYZ-анализа и расчёта трендов
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>ABC-классификация</CardTitle>
                <CardDescription>Методология расчёта</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  ABC-анализ распределяет товары по трём категориям на основе их вклада в выручку:
                </p>
                
                <div className="grid gap-3">
                  <div className="flex items-center gap-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <Badge className="bg-green-600 text-white text-lg px-3 py-1">A</Badge>
                    <div>
                      <div className="font-medium">Категория A — 80% выручки</div>
                      <div className="text-sm text-muted-foreground">Самые важные товары, требующие приоритетного внимания</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <Badge className="bg-amber-600 text-white text-lg px-3 py-1">B</Badge>
                    <div>
                      <div className="font-medium">Категория B — следующие 15% выручки</div>
                      <div className="text-sm text-muted-foreground">Товары средней важности</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <Badge className="bg-red-600 text-white text-lg px-3 py-1">C</Badge>
                    <div>
                      <div className="font-medium">Категория C — оставшиеся 5% выручки</div>
                      <div className="text-sm text-muted-foreground">Наименее значимые товары</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
