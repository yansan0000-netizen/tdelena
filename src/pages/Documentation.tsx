import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileSpreadsheet, Upload, BarChart3, Download, TrendingUp, Package, Calculator, 
  AlertTriangle, CheckCircle, DollarSign, Layers, FileUp, Link2, Settings, History, 
  Store, Filter, FileDown, Ban, Sparkles, UserPlus, LineChart, FileText, Lock,
  Users, Shield, Eye, EyeOff, Skull, Target, Percent, ArrowDownUp
} from 'lucide-react';
import { exportDocumentationToPDF } from '@/lib/documentationExport';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';
import { Skeleton } from '@/components/ui/skeleton';

export default function Documentation() {
  const { role, isAdmin, hasFullAccess, shouldHideCost, loading } = useUserRole();

  const handleExportPDF = () => {
    try {
      exportDocumentationToPDF();
      toast.success('Документация экспортирована в PDF');
    } catch (error) {
      console.error('Error exporting documentation:', error);
      toast.error('Ошибка экспорта документации');
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-8">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header with glass effect */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Документация
              </h1>
              <p className="text-muted-foreground mt-2 leading-relaxed">
                Система ABC/XYZ анализа, планирования производства и юнит-экономики
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <Shield className="h-3 w-3" />
                  Ваша роль: {role === 'admin' ? 'Администратор' : role === 'full_access' ? 'Полный доступ' : 'Скрытая себестоимость'}
                </Badge>
              </div>
            </div>
            <Button onClick={handleExportPDF} variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              Скачать PDF
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <div className="overflow-x-auto pb-2 -mx-1 px-1">
            <TabsList className="inline-flex w-max gap-1 p-2">
              <TabsTrigger value="overview">Обзор</TabsTrigger>
              <TabsTrigger value="format">Формат</TabsTrigger>
              <TabsTrigger value="analysis">Анализ</TabsTrigger>
              {!shouldHideCost && <TabsTrigger value="assortment">Ассортимент</TabsTrigger>}
              <TabsTrigger value="killlist">Kill-лист</TabsTrigger>
              {hasFullAccess && <TabsTrigger value="unit-economics">Юнит-экономика</TabsTrigger>}
              <TabsTrigger value="forecast">Прогноз</TabsTrigger>
              <TabsTrigger value="export">Экспорт</TabsTrigger>
              <TabsTrigger value="settings">Настройки</TabsTrigger>
              {isAdmin && <TabsTrigger value="admin">Админ</TabsTrigger>}
              <TabsTrigger value="roles">Роли</TabsTrigger>
            </TabsList>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Что делает система?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  Система анализирует выгрузку продаж из 1С за несколько месяцев и формирует:
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>ABC-анализ</strong> — классификация товаров по вкладу в выручку (A — 80%, B — 15%, C — 5%)
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>XYZ-анализ</strong> — классификация по стабильности спроса с настраиваемыми порогами
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>План производства</strong> — расчёт на 1, 3 и 6 месяцев с учётом глобального тренда
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>Рекомендации</strong> — автоматические рекомендации по управлению запасами
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>Анализ ассортимента</strong> — выявление прибыльных, убыточных и залежавшихся товаров
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>Kill-лист</strong> — управление выводом товаров с автоматической лесенкой цен
                    </div>
                  </li>
                  {hasFullAccess && (
                    <>
                      <li className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                        <div>
                          <strong>Юнит-экономика</strong> — расчёт себестоимости, маржи, прибыли и WB-сценариев
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                        <div>
                          <strong>История изменений</strong> — отслеживание всех изменений карточек товаров
                        </div>
                      </li>
                    </>
                  )}
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>Прогнозирование</strong> — расчёт прогноза методами линейной регрессии, экспоненциального сглаживания, скользящего среднего с сезонной корректировкой
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  Как пользоваться
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4">
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">1</Badge>
                    <div>
                      <strong>Настройте параметры</strong> — курс валюты, наценки, пороги XYZ, глобальный тренд
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">2</Badge>
                    <div>
                      <strong>Загрузите файл</strong> — экспортируйте отчёт из 1С в Excel и загрузите его в систему
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">3</Badge>
                    <div>
                      <strong>Дождитесь обработки</strong> — система автоматически распознает структуру и обработает данные
                    </div>
                  </li>
                  {hasFullAccess && (
                    <li className="flex items-start gap-3">
                      <Badge className="shrink-0">4</Badge>
                      <div>
                        <strong>Заполните себестоимость</strong> — перейдите в раздел «Юнит-экономика» и добавьте данные
                      </div>
                    </li>
                  )}
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">{hasFullAccess ? '5' : '4'}</Badge>
                    <div>
                      <strong>Анализируйте ассортимент</strong> — выявите товары на развитие и на вывод
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">{hasFullAccess ? '6' : '5'}</Badge>
                    <div>
                      <strong>Скачайте результаты</strong> — получите готовые отчёты с анализом и экономикой
                    </div>
                  </li>
                </ol>
              </CardContent>
            </Card>
          </TabsContent>

          {/* File Format Tab */}
          <TabsContent value="format" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileSpreadsheet className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Формат файла из 1С</CardTitle>
                    <CardDescription>Требования к входному файлу</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/40 p-4 rounded-xl backdrop-blur-sm border border-border/30 space-y-3">
                  <h4 className="font-medium">Структура файла:</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
                    <li>Заголовок с 3-мя строками (даты, метрики, технические поля)</li>
                    <li>Периоды в формате «Декабрь 2024» или «DD.MM.YYYY»</li>
                    <li>Для каждого периода 3 колонки: <strong>Кол-во</strong>, <strong>Сумма</strong>, <strong>Остаток</strong></li>
                    <li>Колонка артикула («Номенклатура.Артикул» или подобная)</li>
                    <li>Опционально: колонка категории</li>
                  </ul>
                </div>

                <div className="bg-muted/40 p-4 rounded-xl backdrop-blur-sm border border-border/30 space-y-3">
                  <h4 className="font-medium">Пример структуры заголовков:</h4>
                  <div className="overflow-x-auto">
                    <table className="text-sm border-collapse w-full">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="p-2.5 text-left">Строка 1</th>
                          <th className="p-2.5 text-left">Артикул</th>
                          <th className="p-2.5 text-left" colSpan={3}>Декабрь 2024</th>
                          <th className="p-2.5 text-left" colSpan={3}>Январь 2025</th>
                        </tr>
                        <tr className="border-b border-border/50">
                          <th className="p-2.5 text-left">Строка 2</th>
                          <th className="p-2.5 text-left">—</th>
                          <th className="p-2.5 text-left">Кол-во</th>
                          <th className="p-2.5 text-left">Сумма</th>
                          <th className="p-2.5 text-left">Остаток</th>
                          <th className="p-2.5 text-left">Кол-во</th>
                          <th className="p-2.5 text-left">Сумма</th>
                          <th className="p-2.5 text-left">Остаток</th>
                        </tr>
                      </thead>
                    </table>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl backdrop-blur-sm">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm">
                    Колонки «Итого» автоматически пропускаются. Размер файла: до 50 МБ, до 100 000+ строк.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analysis Tab */}
          <TabsContent value="analysis" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>ABC-анализ</CardTitle>
                <CardDescription>Классификация по вкладу в выручку</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl backdrop-blur-sm hover:bg-green-500/15 transition-colors duration-220">
                    <Badge className="bg-green-600 text-white text-lg px-3 py-1 shadow-sm">A</Badge>
                    <div>
                      <div className="font-medium">Категория A — первые 80% выручки</div>
                      <div className="text-sm text-muted-foreground">Ключевые товары, требующие максимального внимания к запасам</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl backdrop-blur-sm hover:bg-amber-500/15 transition-colors duration-220">
                    <Badge className="bg-amber-600 text-white text-lg px-3 py-1 shadow-sm">B</Badge>
                    <div>
                      <div className="font-medium">Категория B — следующие 15% выручки</div>
                      <div className="text-sm text-muted-foreground">Товары средней важности, стандартное управление</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl backdrop-blur-sm hover:bg-red-500/15 transition-colors duration-220">
                    <Badge className="bg-red-600 text-white text-lg px-3 py-1 shadow-sm">C</Badge>
                    <div>
                      <div className="font-medium">Категория C — оставшиеся 5% выручки</div>
                      <div className="text-sm text-muted-foreground">Наименее значимые товары, кандидаты на оптимизацию</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>XYZ-анализ</CardTitle>
                <CardDescription>Классификация по стабильности спроса (коэффициент вариации)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl backdrop-blur-sm">
                  <p className="text-sm">
                    <strong>Пороги настраиваются</strong> в разделе «Настройки». По умолчанию: X ≤ 30%, Y ≤ 60%.
                  </p>
                </div>
                <div className="grid gap-3">
                  <div className="flex items-center gap-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl backdrop-blur-sm hover:bg-blue-500/15 transition-colors duration-220">
                    <Badge className="bg-blue-600 text-white text-lg px-3 py-1 shadow-sm">X</Badge>
                    <div>
                      <div className="font-medium">Категория X — CV ≤ порог X%</div>
                      <div className="text-sm text-muted-foreground">Стабильный спрос, легко прогнозируемый</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl backdrop-blur-sm hover:bg-purple-500/15 transition-colors duration-220">
                    <Badge className="bg-purple-600 text-white text-lg px-3 py-1 shadow-sm">Y</Badge>
                    <div>
                      <div className="font-medium">Категория Y — CV между порогами X и Y</div>
                      <div className="text-sm text-muted-foreground">Умеренные колебания, требуется страховой запас</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl backdrop-blur-sm hover:bg-orange-500/15 transition-colors duration-220">
                    <Badge className="bg-orange-600 text-white text-lg px-3 py-1 shadow-sm">Z</Badge>
                    <div>
                      <div className="font-medium">Категория Z — CV {'>'} порог Y%</div>
                      <div className="text-sm text-muted-foreground">Нестабильный спрос, требуется индивидуальный анализ</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Матрица рекомендаций ABC-XYZ</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2"></th>
                        <th className="p-2 text-center">X</th>
                        <th className="p-2 text-center">Y</th>
                        <th className="p-2 text-center">Z</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="p-2 font-medium">A</td>
                        <td className="p-2 text-center bg-green-500/10">Максимальный контроль</td>
                        <td className="p-2 text-center bg-blue-500/10">Регулярное пополнение</td>
                        <td className="p-2 text-center bg-amber-500/10">Анализировать</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2 font-medium">B</td>
                        <td className="p-2 text-center bg-blue-500/10">Регулярный заказ</td>
                        <td className="p-2 text-center bg-amber-500/10">Страховой запас</td>
                        <td className="p-2 text-center bg-orange-500/10">Сократить запас</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-medium">C</td>
                        <td className="p-2 text-center bg-amber-500/10">Минимальные заказы</td>
                        <td className="p-2 text-center bg-orange-500/10">Сократить ассортимент</td>
                        <td className="p-2 text-center bg-red-500/10">Вывести</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assortment Analysis Tab - Only for non-hidden_cost users */}
          {!shouldHideCost && (
          <TabsContent value="assortment" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Анализ ассортимента
                </CardTitle>
                <CardDescription>Выявление прибыльных, убыточных и залежавшихся товаров</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Модуль помогает понять:</p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>Какие товары развивать</strong> — прибыльные товары с хорошими продажами
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>Какие товары убрать</strong> — невыгодные или залежавшиеся товары
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>Где расширить линейку</strong> — категории с высоким спросом
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Экраны модуля</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">📊 Сводка ассортимента</h4>
                    <p className="text-sm text-muted-foreground">
                      Общая картина: сколько товаров продаётся хорошо/средне/плохо, сколько убыточных, 
                      сколько денег и прибыли даёт ассортимент.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">📋 Таблица товаров</h4>
                    <p className="text-sm text-muted-foreground">
                      Для каждого товара: продажи, остаток, дней хватит, прогноз, 
                      {hasFullAccess && ' прибыль на штуку, '} рекомендация и причина.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Типы рекомендаций</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <Badge className="bg-green-600 text-white">Расширить</Badge>
                    <div className="text-sm text-muted-foreground">
                      Товар хорошо продаётся и выгоден — добавить варианты, увеличить закупку
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <Badge className="bg-blue-600 text-white">Оставить</Badge>
                    <div className="text-sm text-muted-foreground">
                      Стабильные показатели — поддерживать текущий уровень
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <Badge className="bg-amber-600 text-white">Сократить</Badge>
                    <div className="text-sm text-muted-foreground">
                      Низкая эффективность — уменьшить объём закупки
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <Badge className="bg-red-600 text-white">Убрать</Badge>
                    <div className="text-sm text-muted-foreground">
                      Убыточный или залежавшийся товар — кандидат в kill-лист
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Критерии рекомендаций</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <h4 className="font-medium mb-2">🚫 Кандидат на вывод (убрать)</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Товар не приносит прибыль (в минус или почти в ноль)</li>
                    <li>• Плохо продаётся и лежит на складе слишком долго</li>
                    <li>• Нет продаж за выбранный период, а остаток есть</li>
                  </ul>
                </div>
                
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <h4 className="font-medium mb-2">✅ Кандидат на расширение</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Товар в топе по продажам/выручке</li>
                    <li>• Товар прибыльный</li>
                    <li>• Остаток быстро заканчивается или прогноз показывает высокий спрос</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {/* Kill-list Tab */}
          <TabsContent value="killlist" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Skull className="h-5 w-5 text-primary" />
                  Kill-лист
                </CardTitle>
                <CardDescription>Управление выводом товаров из ассортимента</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  Kill-лист — это список товаров, которые компания решила вывести из ассортимента.
                  Система помогает распродать остатки правильно.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>Список на вывод</strong> — с причинами и датами
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>Автоматическая лесенка цен</strong> — постепенное снижение по графику
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>Контроль прогресса</strong> — отслеживание выполнения плана
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>История действий</strong> — кто добавил, кто менял цены
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowDownUp className="h-5 w-5 text-primary" />
                  Лесенка цен
                </CardTitle>
                <CardDescription>Автоматический расчёт постепенного снижения</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">⚙️ Параметры лесенки</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Срок распродажи (например, 30 дней)</li>
                      <li>• Количество шагов (например, 4 шага)</li>
                      <li>• Минимальная цена (ниже которой не опускаться)</li>
                      <li>• Округление (до 10/50 или .99)</li>
                    </ul>
                  </div>
                  
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">📊 Пример плана</h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>Шаг 1: 01.02 → 2 990 ₽</div>
                      <div>Шаг 2: 08.02 → 2 490 ₽</div>
                      <div>Шаг 3: 15.02 → 1 990 ₽</div>
                      <div>Шаг 4: 22.02 → 1 490 ₽</div>
                    </div>
                  </div>
                </div>

                {hasFullAccess && (
                  <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                    <Percent className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm">
                      На каждом шаге показывается прибыль/убыток на штуку для контроля маржинальности.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Добавление товаров</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">Способы добавления</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Из «Анализа ассортимента» одной кнопкой</li>
                      <li>• Вручную по поиску артикула</li>
                      <li>• Импортом списка</li>
                    </ul>
                  </div>
                  
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">Что указывается</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Причина вывода (из списка + комментарий)</li>
                      <li>• Срок распродажи (14/30/60 дней)</li>
                      <li>• Минимальная допустимая цена</li>
                      <li>• Стратегия: авто-лесенка или ручная</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Контроль прогресса</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <Badge className="bg-green-600 text-white">По плану</Badge>
                    <div className="text-sm text-muted-foreground">
                      Распродажа идёт согласно графику
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <Badge className="bg-amber-600 text-white">Отстаём</Badge>
                    <div className="text-sm text-muted-foreground">
                      Нужно сделать скидку сильнее или увеличить срок
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <Badge className="bg-blue-600 text-white">Завершено</Badge>
                    <div className="text-sm text-muted-foreground">
                      Товар успешно распродан
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Unit Economics Tab - Only for full_access and admin */}
          {hasFullAccess && (
            <TabsContent value="unit-economics" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Назначение модуля
                  </CardTitle>
                  <CardDescription>Расчёт себестоимости и маржинальности</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                      <div>
                        <strong>Расчёт себестоимости</strong> — материалы, работа, накладные расходы
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                      <div>
                        <strong>Маржинальность и чистая прибыль</strong> — отображаются в таблице товаров
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                      <div>
                        <strong>История изменений</strong> — полный лог всех изменений карточки товара
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                      <div>
                        <strong>Экспорт в Excel</strong> — выгрузка всех данных со сводкой
                      </div>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-primary" />
                    Структура себестоимости
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                      <h4 className="font-medium mb-2">🧵 Ткани (до 3-х видов)</h4>
                      <p className="text-sm text-muted-foreground">
                        Название, цена ($/кг), вес на единицу. Автоматический пересчёт по курсу.
                      </p>
                    </div>
                    
                    <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                      <h4 className="font-medium mb-2">✂️ Работа</h4>
                      <p className="text-sm text-muted-foreground">
                        Раскрой и пошив — отдельные поля для точного учёта.
                      </p>
                    </div>
                    
                    <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                      <h4 className="font-medium mb-2">🎨 Вышивка/Принт</h4>
                      <p className="text-sm text-muted-foreground">
                        Разделены на работу и материалы для точного учёта затрат.
                      </p>
                    </div>
                    
                    <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                      <h4 className="font-medium mb-2">🔧 Фурнитура</h4>
                      <p className="text-sm text-muted-foreground">
                        Молнии, пуговицы, лейблы и т.д.
                      </p>
                    </div>
                    
                    <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                      <h4 className="font-medium mb-2">📊 Накладные расходы</h4>
                      <p className="text-sm text-muted-foreground">
                        % от себестоимости на административные расходы.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="h-5 w-5 text-primary" />
                    Wildberries (WB-модуль)
                  </CardTitle>
                  <CardDescription>Расчёт юнит-экономики для маркетплейса</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl backdrop-blur-sm">
                    <p className="text-sm">
                      Модуль активируется переключателем <strong>«Продавать на WB»</strong> в карточке товара.
                    </p>
                  </div>
                  <div className="grid gap-3">
                    <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                      <h4 className="font-medium mb-2">📊 Ценообразование с СПП</h4>
                      <p className="text-sm text-muted-foreground">
                        Цена без СПП × (1 - СПП%) = Цена с СПП
                      </p>
                    </div>
                    
                    <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                      <h4 className="font-medium mb-2">🚚 Логистика с возвратами</h4>
                      <p className="text-sm text-muted-foreground">
                        Учитывается % выкупа, логистика до клиента и возврата.
                      </p>
                    </div>
                    
                    <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                      <h4 className="font-medium mb-2">💰 Налоги</h4>
                      <p className="text-sm text-muted-foreground">
                        УСН или УСН + НДС — налог считается в WB-модуле.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Forecast Tab */}
          <TabsContent value="forecast" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5 text-primary" />
                  Методы прогнозирования
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">📈 Линейная регрессия</h4>
                    <p className="text-sm text-muted-foreground">
                      Вычисляет линию тренда на основе исторических данных: y = a + b×x
                    </p>
                  </div>
                  
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">📊 Экспоненциальное сглаживание</h4>
                    <p className="text-sm text-muted-foreground">
                      Недавние наблюдения имеют больший вес: F(t+1) = α × Y(t) + (1-α) × F(t)
                    </p>
                  </div>
                  
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">📉 Скользящая средняя</h4>
                    <p className="text-sm text-muted-foreground">
                      Среднее за последние N периодов с сезонной корректировкой.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Глобальный тренд</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Коэффициент применяется ко всем прогнозам:
                </p>
                <div className="grid gap-3">
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <code className="text-sm">= 1.0</code> — без изменений
                  </div>
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <code className="text-sm">&gt; 1.0</code> — ожидается рост (например, 1.2 = +20%)
                  </div>
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <code className="text-sm">&lt; 1.0</code> — ожидается падение (например, 0.8 = -20%)
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-primary" />
                  Варианты экспорта
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">📊 Отчёт ABC/XYZ (Excel)</h4>
                    <p className="text-sm text-muted-foreground">
                      Полный анализ со всеми метриками и группировками.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">📋 План производства (Excel)</h4>
                    <p className="text-sm text-muted-foreground">
                      Приоритетный план на 1, 3 и 6 месяцев.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">📄 Отчёты (PDF)</h4>
                    <p className="text-sm text-muted-foreground">
                      Печатные версии с цветовой кодировкой.
                    </p>
                  </div>
                  
                  {hasFullAccess && (
                    <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                      <h4 className="font-medium mb-2">💰 Юнит-экономика (Excel)</h4>
                      <p className="text-sm text-muted-foreground">
                        Все поля по каждому артикулу: себестоимость, ткани, маржа.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-primary" />
                  Фильтры экспорта
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                    📅 По периодам (выбор месяцев)
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                    📂 По категориям
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                    🏷️ По ABC/XYZ группам
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                    📦 По остаткам (все / с остатками / без)
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowDownUp className="h-5 w-5 text-primary" />
                  Сортировка таблиц
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Все таблицы поддерживают сортировку по колонкам. Кликните на заголовок для сортировки:
                </p>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                    🔼 Первый клик — по возрастанию (A-Я, 0-9)
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                    🔽 Второй клик — по убыванию (Я-A, 9-0)
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                    ↕️ Третий клик — сброс сортировки
                  </div>
                </div>
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
                  <p className="text-sm">
                    <strong>Совет:</strong> В таблице ассортимента можно сортировать по марже и прибыльности,
                    чтобы быстро найти лучшие и худшие товары.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  Глобальные настройки
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  {hasFullAccess && (
                    <>
                      <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                        <h4 className="font-medium mb-2">💱 Курс валюты</h4>
                        <p className="text-sm text-muted-foreground">
                          Курс USD к RUB для пересчёта стоимости тканей.
                        </p>
                      </div>
                      
                      <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                        <h4 className="font-medium mb-2">📊 Накладные расходы</h4>
                        <p className="text-sm text-muted-foreground">
                          % от производственных затрат на административные расходы.
                        </p>
                      </div>
                      
                      <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                        <h4 className="font-medium mb-2">💰 Налоговый режим</h4>
                        <p className="text-sm text-muted-foreground">
                          УСН (ставка по умолчанию 7%) или НДС.
                        </p>
                      </div>
                    </>
                  )}
                  
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">📈 Пороги XYZ</h4>
                    <p className="text-sm text-muted-foreground">
                      Порог X (по умолчанию 30%) и порог Y (по умолчанию 60%).
                    </p>
                  </div>
                  
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">📉 Глобальный тренд</h4>
                    <p className="text-sm text-muted-foreground">
                      Ручной режим или автоматический расчёт из данных.
                    </p>
                  </div>

                  {hasFullAccess && (
                    <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                      <h4 className="font-medium mb-2">🚚 Параметры WB по умолчанию</h4>
                      <p className="text-sm text-muted-foreground">
                        Логистика к клиенту, возврата, приёмка, % выкупа.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Admin Tab - Only for admin */}
          {isAdmin && (
            <TabsContent value="admin" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Панель администратора
                  </CardTitle>
                  <CardDescription>Управление пользователями и настройками системы</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                      <div>
                        <strong>Управление пользователями</strong> — просмотр, одобрение, изменение ролей
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                      <div>
                        <strong>Назначение ролей</strong> — admin, full_access, hidden_cost
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                      <div>
                        <strong>Правила рекомендаций</strong> — настройка автоматических рекомендаций
                      </div>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Permissions Matrix */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-primary" />
                    Матрица прав доступа
                  </CardTitle>
                  <CardDescription>Полная таблица разрешений по ролям</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-3 font-medium bg-muted/30">Функция</th>
                          <th className="text-center p-3 font-medium bg-green-500/10">
                            <div className="flex items-center justify-center gap-1">
                              <Shield className="h-4 w-4 text-green-600" />
                              admin
                            </div>
                          </th>
                          <th className="text-center p-3 font-medium bg-blue-500/10">
                            <div className="flex items-center justify-center gap-1">
                              <Eye className="h-4 w-4 text-blue-600" />
                              full_access
                            </div>
                          </th>
                          <th className="text-center p-3 font-medium bg-amber-500/10">
                            <div className="flex items-center justify-center gap-1">
                              <EyeOff className="h-4 w-4 text-amber-600" />
                              hidden_cost
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-border/50">
                          <td className="p-3 font-medium" colSpan={4}>📊 Аналитика</td>
                        </tr>
                        <tr className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-3 pl-6">ABC/XYZ анализ</td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                        </tr>
                        <tr className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-3 pl-6">Прогноз производства</td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                        </tr>
                        <tr className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-3 pl-6">Загрузка данных</td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                        </tr>
                        
                        <tr className="border-b border-border/50">
                          <td className="p-3 font-medium" colSpan={4}>💰 Финансы</td>
                        </tr>
                        <tr className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-3 pl-6">Юнит-экономика (просмотр)</td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><Ban className="h-4 w-4 text-red-400 mx-auto" /></td>
                        </tr>
                        <tr className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-3 pl-6">Юнит-экономика (редактирование)</td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><Ban className="h-4 w-4 text-red-400 mx-auto" /></td>
                        </tr>
                        <tr className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-3 pl-6">Себестоимость и маржа</td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><Ban className="h-4 w-4 text-red-400 mx-auto" /></td>
                        </tr>
                        <tr className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-3 pl-6">История изменений цен</td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><Ban className="h-4 w-4 text-red-400 mx-auto" /></td>
                        </tr>
                        
                        <tr className="border-b border-border/50">
                          <td className="p-3 font-medium" colSpan={4}>📦 Ассортимент</td>
                        </tr>
                        <tr className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-3 pl-6">Анализ ассортимента</td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><Ban className="h-4 w-4 text-red-400 mx-auto" /></td>
                        </tr>
                        <tr className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-3 pl-6">Kill-лист (управление)</td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                        </tr>
                        <tr className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-3 pl-6">Kill-лист (цены/лесенка)</td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><Ban className="h-4 w-4 text-red-400 mx-auto" /></td>
                        </tr>
                        <tr className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-3 pl-6">Каталог артикулов</td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                        </tr>
                        
                        <tr className="border-b border-border/50">
                          <td className="p-3 font-medium" colSpan={4}>⚙️ Настройки</td>
                        </tr>
                        <tr className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-3 pl-6">Курс валюты, налоги</td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><Ban className="h-4 w-4 text-red-400 mx-auto" /></td>
                        </tr>
                        <tr className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-3 pl-6">Пороги XYZ</td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                        </tr>
                        <tr className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-3 pl-6">Глобальный тренд</td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                        </tr>
                        
                        <tr className="border-b border-border/50">
                          <td className="p-3 font-medium" colSpan={4}>👥 Администрирование</td>
                        </tr>
                        <tr className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-3 pl-6">Управление пользователями</td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><Ban className="h-4 w-4 text-red-400 mx-auto" /></td>
                          <td className="p-3 text-center"><Ban className="h-4 w-4 text-red-400 mx-auto" /></td>
                        </tr>
                        <tr className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-3 pl-6">Назначение ролей</td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><Ban className="h-4 w-4 text-red-400 mx-auto" /></td>
                          <td className="p-3 text-center"><Ban className="h-4 w-4 text-red-400 mx-auto" /></td>
                        </tr>
                        <tr className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-3 pl-6">Правила рекомендаций</td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><Ban className="h-4 w-4 text-red-400 mx-auto" /></td>
                          <td className="p-3 text-center"><Ban className="h-4 w-4 text-red-400 mx-auto" /></td>
                        </tr>
                        <tr className="hover:bg-muted/20">
                          <td className="p-3 pl-6">Админ-панель</td>
                          <td className="p-3 text-center"><CheckCircle className="h-4 w-4 text-green-500 mx-auto" /></td>
                          <td className="p-3 text-center"><Ban className="h-4 w-4 text-red-400 mx-auto" /></td>
                          <td className="p-3 text-center"><Ban className="h-4 w-4 text-red-400 mx-auto" /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4 text-green-500" /> Доступно</span>
                    <span className="flex items-center gap-1"><Ban className="h-4 w-4 text-red-400" /> Недоступно</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Настройки kill-листа</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                      <h4 className="font-medium mb-2">📅 Порог залёживания</h4>
                      <p className="text-sm text-muted-foreground">
                        Сколько дней считать «товар залежался» (по умолчанию 90 дней).
                      </p>
                    </div>
                    
                    <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                      <h4 className="font-medium mb-2">💰 Уровень прибыльности</h4>
                      <p className="text-sm text-muted-foreground">
                        Какой уровень прибыльности считать нормальным.
                      </p>
                    </div>
                    
                    <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                      <h4 className="font-medium mb-2">📉 Стандартная лесенка</h4>
                      <p className="text-sm text-muted-foreground">
                        Количество шагов и частота снижения по умолчанию.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Roles Tab */}
          <TabsContent value="roles" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Система ролей
                </CardTitle>
                <CardDescription>Три уровня доступа к функциям системы</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className={`p-4 rounded-xl border ${role === 'admin' ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/40 border-border/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-5 w-5 text-green-600" />
                      <h4 className="font-medium">Администратор (admin)</h4>
                      {role === 'admin' && <Badge variant="outline" className="ml-auto">Ваша роль</Badge>}
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Полный доступ ко всем функциям</li>
                      <li>• Управление пользователями и ролями</li>
                      <li>• Настройка правил рекомендаций</li>
                      <li>• Просмотр всех данных включая себестоимость</li>
                    </ul>
                  </div>
                  
                  <div className={`p-4 rounded-xl border ${role === 'full_access' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-muted/40 border-border/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="h-5 w-5 text-blue-600" />
                      <h4 className="font-medium">Полный доступ (full_access)</h4>
                      {role === 'full_access' && <Badge variant="outline" className="ml-auto">Ваша роль</Badge>}
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Просмотр и редактирование юнит-экономики</li>
                      <li>• Доступ к себестоимости и марже</li>
                      <li>• Работа с kill-листом и ассортиментом</li>
                      <li>• Экспорт всех отчётов</li>
                    </ul>
                  </div>
                  
                  <div className={`p-4 rounded-xl border ${role === 'hidden_cost' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-muted/40 border-border/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <EyeOff className="h-5 w-5 text-amber-600" />
                      <h4 className="font-medium">Скрытая себестоимость (hidden_cost)</h4>
                      {role === 'hidden_cost' && <Badge variant="outline" className="ml-auto">Ваша роль</Badge>}
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Просмотр аналитики без финансовых данных</li>
                      <li>• ABC/XYZ анализ и рекомендации</li>
                      <li>• Работа с kill-листом (без цен)</li>
                      <li>• Себестоимость и маржа скрыты</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Доступ к разделам по ролям</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2 text-left">Раздел</th>
                        <th className="p-2 text-center">admin</th>
                        <th className="p-2 text-center">full_access</th>
                        <th className="p-2 text-center">hidden_cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="p-2">ABC/XYZ анализ</td>
                        <td className="p-2 text-center text-green-600">✓</td>
                        <td className="p-2 text-center text-green-600">✓</td>
                        <td className="p-2 text-center text-green-600">✓</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2">Анализ ассортимента</td>
                        <td className="p-2 text-center text-green-600">✓</td>
                        <td className="p-2 text-center text-green-600">✓</td>
                        <td className="p-2 text-center text-red-600">✗</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2">Kill-лист</td>
                        <td className="p-2 text-center text-green-600">✓</td>
                        <td className="p-2 text-center text-green-600">✓</td>
                        <td className="p-2 text-center text-green-600">✓</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2">Юнит-экономика</td>
                        <td className="p-2 text-center text-green-600">✓</td>
                        <td className="p-2 text-center text-green-600">✓</td>
                        <td className="p-2 text-center text-red-600">✗</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2">Себестоимость / маржа</td>
                        <td className="p-2 text-center text-green-600">✓</td>
                        <td className="p-2 text-center text-green-600">✓</td>
                        <td className="p-2 text-center text-red-600">✗</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2">Администрирование</td>
                        <td className="p-2 text-center text-green-600">✓</td>
                        <td className="p-2 text-center text-red-600">✗</td>
                        <td className="p-2 text-center text-red-600">✗</td>
                      </tr>
                      <tr>
                        <td className="p-2">Управление пользователями</td>
                        <td className="p-2 text-center text-green-600">✓</td>
                        <td className="p-2 text-center text-red-600">✗</td>
                        <td className="p-2 text-center text-red-600">✗</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {shouldHideCost && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-5 w-5" />
                    Ограниченный доступ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Ваша роль <strong>hidden_cost</strong> ограничивает доступ к финансовым данным.
                    Вы не видите себестоимость, маржу и прибыль по товарам.
                    Для получения полного доступа обратитесь к администратору.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
