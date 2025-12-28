import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Upload, BarChart3, Download, TrendingUp, Package, Calculator, AlertTriangle, CheckCircle, DollarSign, Layers, FileUp, Link2, Settings, History, Store } from 'lucide-react';

export default function Documentation() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header with glass effect */}
        <div className="glass-panel rounded-2xl p-6">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Документация
          </h1>
          <p className="text-muted-foreground mt-2 leading-relaxed">
            Система ABC/XYZ анализа, планирования производства и юнит-экономики
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex flex-wrap gap-1 h-auto p-2">
            <TabsTrigger value="overview">Обзор</TabsTrigger>
            <TabsTrigger value="format">Формат файла</TabsTrigger>
            <TabsTrigger value="analysis">Анализ</TabsTrigger>
            <TabsTrigger value="output">Результаты</TabsTrigger>
            <TabsTrigger value="unit-economics">Юнит-экономика</TabsTrigger>
            <TabsTrigger value="settings">Настройки</TabsTrigger>
            <TabsTrigger value="quality">Качество</TabsTrigger>
          </TabsList>

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
                      <strong>Юнит-экономика</strong> — расчёт себестоимости, маржи, прибыли и WB-сценариев
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>История изменений</strong> — отслеживание всех изменений карточек товаров
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
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">4</Badge>
                    <div>
                      <strong>Заполните себестоимость</strong> — перейдите в раздел «Юнит-экономика» и добавьте данные
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">5</Badge>
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
                        <td className="p-2 text-center bg-amber-500/10">Регулярное пополнение</td>
                        <td className="p-2 text-center bg-orange-500/10">Анализ причин</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2 font-medium">B</td>
                        <td className="p-2 text-center bg-blue-500/10">Стандартное управление</td>
                        <td className="p-2 text-center bg-purple-500/10">Периодический контроль</td>
                        <td className="p-2 text-center bg-orange-500/10">Оптимизация</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-medium">C</td>
                        <td className="p-2 text-center bg-gray-500/10">Минимум запасов</td>
                        <td className="p-2 text-center bg-red-500/10">Сокращение</td>
                        <td className="p-2 text-center bg-red-500/10">Вывод из ассортимента</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Output Tab */}
          <TabsContent value="output" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Выходные файлы
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30 space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Обработанный отчёт (CSV/XLSX)
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Полный отчёт со всеми показателями по каждому артикулу:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="glass">Артикул</Badge>
                    <Badge variant="glass">Категория</Badge>
                    <Badge variant="glass">ABC</Badge>
                    <Badge variant="glass">XYZ</Badge>
                    <Badge variant="glass">Кол-во продаж</Badge>
                    <Badge variant="glass">Остаток</Badge>
                    <Badge variant="glass">Скорость/день</Badge>
                    <Badge variant="glass">Дней до 0</Badge>
                    <Badge variant="glass">План 1м/3м/6м</Badge>
                    <Badge variant="glass">Рекомендация</Badge>
                  </div>
                </div>

                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl backdrop-blur-sm space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Колонки с юнит-экономикой
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    При наличии данных о себестоимости добавляются:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="glass" className="bg-primary/10">Себестоимость</Badge>
                    <Badge variant="glass" className="bg-primary/10">Маржа/шт</Badge>
                    <Badge variant="glass" className="bg-primary/10">Маржинальность %</Badge>
                    <Badge variant="glass" className="bg-primary/10">Прибыль</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Формулы расчёта</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm">
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <strong>Ср. месячные продажи</strong> = Общее кол-во продаж / Число периодов
                  </div>
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <strong>Скорость продаж/день</strong> = Ср.мес.продажи × Тренд / 30
                  </div>
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <strong>Дней до нуля</strong> = Текущий остаток / Скорость в день
                  </div>
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <strong>План на N мес.</strong> = max(0, Ср.мес.продажи × Тренд × N − Остаток)
                  </div>
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <strong>CV (коэфф. вариации)</strong> = (Стандартное отклонение / Среднее) × 100%
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Unit Economics Tab */}
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
                      <strong>Категории из справочника</strong> — единые значения с возможностью добавления своих
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
                      <strong>Флаги «Новинка» и «Перерасчёт»</strong> — для отслеживания новых товаров и пересчётов
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>Дата обновления</strong> — автоматически обновляется при реальных изменениях
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>История изменений</strong> — полный лог всех изменений карточки товара
                    </div>
                  </li>
                </ul>
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
                      Вводите «Цена без СПП» и «СПП %» — система автоматически рассчитывает «Цена с СПП»
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Формула: Цена с СПП = Цена без СПП / (1 - СПП%)
                    </p>
                  </div>
                  
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">🚚 Логистика с возвратами</h4>
                    <p className="text-sm text-muted-foreground">
                      Учитывается % выкупа, логистика до клиента и возврата. Рассчитывается стоимость доставки на 1 выкуп.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">💰 Инвестиции</h4>
                    <p className="text-sm text-muted-foreground">
                      Автоматический расчёт вложений: Инвестиции = Кол-во отгрузки × Себестоимость
                    </p>
                  </div>
                  
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">📋 Налоги</h4>
                    <p className="text-sm text-muted-foreground">
                      Выбор режима: «УСН доход-расход» или «УСН доход-расход + НДС». Налог считается только в WB-модуле.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  История изменений
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Система ведёт полный аудит-лог изменений каждого товара:
                </p>
                <ul className="space-y-2 text-sm">
                  <li>• Отслеживаются все ключевые поля: цена, себестоимость, категория, флаги и т.д.</li>
                  <li>• Записывается дата, старое и новое значение</li>
                  <li>• Дата «Обновлено» меняется только при реальных изменениях</li>
                  <li>• Доступ к истории — кнопка «История» в карточке товара</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  Добавление категорий
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Категории товаров и типы тканей выбираются из справочника. Для добавления новой категории:
                </p>
                <ol className="space-y-2 text-sm">
                  <li>1. Откройте выпадающий список категорий</li>
                  <li>2. Введите название новой категории в поле внизу списка</li>
                  <li>3. Нажмите «+» для добавления</li>
                  <li>4. Новая категория сохраняется в вашем профиле и доступна везде</li>
                </ol>
                <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                  <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-sm">
                    Пользовательские категории помечаются как «(свой)» в списке.
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
                <CardDescription>Параметры, применяемые ко всем расчётам</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">💱 Курс валюты</h4>
                    <p className="text-sm text-muted-foreground">
                      USD/RUB для пересчёта цен на ткани. По умолчанию: 90₽
                    </p>
                  </div>
                  
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">📊 Накладные расходы</h4>
                    <p className="text-sm text-muted-foreground">
                      Административные расходы (%) добавляются к себестоимости. По умолчанию: 15%
                    </p>
                  </div>
                  
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">💰 Оптовая наценка</h4>
                    <p className="text-sm text-muted-foreground">
                      Наценка для расчёта оптовой цены. По умолчанию: 35%
                    </p>
                  </div>
                  
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">📋 Налоги</h4>
                    <p className="text-sm text-muted-foreground">
                      УСН: 7%, НДС: 0% (по умолчанию). Режим: «УСН доход-расход» или «+ НДС»
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Настройки WB по умолчанию
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Значения применяются автоматически при создании нового товара:
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <strong>Выкуп:</strong> 90%
                  </div>
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <strong>Логистика до клиента:</strong> 50₽
                  </div>
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <strong>Логистика возврата:</strong> 50₽
                  </div>
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <strong>Приёмка:</strong> 50₽
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Пороги XYZ и тренд
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <h4 className="font-medium mb-2">📈 Пороги XYZ</h4>
                    <p className="text-sm text-muted-foreground">
                      X ≤ 30%, Y ≤ 60% (по умолчанию). Позволяет расширить категорию X до 70% для включения большего числа товаров.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <span className="text-lg">🌍</span>
                      Глобальный тренд
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Коэффициент для корректировки прогнозов с учётом общего тренда рынка.
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                      <li>• 1.0 = без изменений</li>
                      <li>• 0.8 = падение 20%</li>
                      <li>• 1.2 = рост 20%</li>
                    </ul>
                    <div className="bg-background/80 backdrop-blur-sm rounded-lg px-4 py-3 border border-border/50 mb-3">
                      <code className="text-sm font-mono font-medium text-foreground">
                        forecast = base × trend_coef × global_trend
                      </code>
                    </div>
                    <div className="grid gap-2 text-xs">
                      <div className="flex items-start gap-2">
                        <code className="bg-muted px-2 py-0.5 rounded font-mono font-medium shrink-0">forecast</code>
                        <span className="text-muted-foreground">— итоговый прогноз продаж на период</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <code className="bg-muted px-2 py-0.5 rounded font-mono font-medium shrink-0">base</code>
                        <span className="text-muted-foreground">— базовый расчёт (средние продажи за период)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <code className="bg-muted px-2 py-0.5 rounded font-mono font-medium shrink-0">trend_coef</code>
                        <span className="text-muted-foreground">— коэффициент тренда товара (рассчитывается автоматически по истории)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <code className="bg-muted px-2 py-0.5 rounded font-mono font-medium shrink-0">global_trend</code>
                        <span className="text-muted-foreground">— глобальный тренд рынка (задаётся вручную в настройках)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quality Tab */}
          <TabsContent value="quality" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Контроль качества данных
                </CardTitle>
                <CardDescription>Метрики и логирование обработки</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <strong>Сырых строк</strong> — общее количество записей: артикул×размер×период
                  </div>
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <strong>Уникальных артикулов</strong> — количество уникальных артикулов без учёта размеров
                  </div>
                  <div className="p-4 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <strong>Сжатие данных</strong> — коэффициент агрегации от сырых строк к аналитике
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Этапы обработки</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="space-y-3">
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">1</Badge>
                    <div>
                      <strong>Загрузка файла</strong> — парсинг Excel, разбиение на чанки и загрузка в БД
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">2</Badge>
                    <div>
                      <strong>Агрегация</strong> — группировка по артикулам, расчёт сумм и средних
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">3</Badge>
                    <div>
                      <strong>XYZ-анализ</strong> — расчёт CV с учётом пользовательских порогов
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">4</Badge>
                    <div>
                      <strong>ABC-анализ</strong> — ранжирование по выручке
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">5</Badge>
                    <div>
                      <strong>Прогнозы</strong> — расчёт планов с учётом глобального тренда
                    </div>
                  </li>
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Логирование</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Логи доступны на странице деталей запуска:
                </p>
                <div className="grid gap-2">
                  <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <Badge variant="glass" className="bg-primary/10 text-primary">INFO</Badge>
                    <span className="text-sm">Информационные сообщения</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <Badge variant="glass" className="bg-green-500/10 text-green-600">ACTION</Badge>
                    <span className="text-sm">Успешное завершение этапов</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <Badge variant="glass" className="bg-amber-500/10 text-amber-600">WARN</Badge>
                    <span className="text-sm">Предупреждения</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl backdrop-blur-sm border border-border/30">
                    <Badge variant="glass" className="bg-red-500/10 text-red-600">ERROR</Badge>
                    <span className="text-sm">Ошибки</span>
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