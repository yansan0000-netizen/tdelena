import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Upload, BarChart3, Download, TrendingUp, Package, Calculator, AlertTriangle, CheckCircle, DollarSign, Layers, FileUp, Link2 } from 'lucide-react';

export default function Documentation() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Документация</h1>
          <p className="text-muted-foreground mt-2">
            Система ABC/XYZ анализа и планирования производства
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Обзор</TabsTrigger>
            <TabsTrigger value="format">Формат файла</TabsTrigger>
            <TabsTrigger value="analysis">Анализ</TabsTrigger>
            <TabsTrigger value="output">Результаты</TabsTrigger>
            <TabsTrigger value="unit-economics">Юнит-экономика</TabsTrigger>
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
                      <strong>XYZ-анализ</strong> — классификация по стабильности спроса (X — стабильный, Y — средний, Z — нестабильный)
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>План производства</strong> — расчёт необходимого объёма производства на 1, 3 и 6 месяцев
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>Рекомендации</strong> — автоматические рекомендации по управлению запасами для каждого артикула
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>Юнит-экономика</strong> — расчёт себестоимости, маржинальности и прибыльности по каждому артикулу
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
                      <strong>Загрузите файл</strong> — экспортируйте отчёт из 1С в Excel и загрузите его в систему
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">2</Badge>
                    <div>
                      <strong>Дождитесь обработки</strong> — система автоматически распознает структуру и обработает данные
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">3</Badge>
                    <div>
                      <strong>Заполните себестоимость</strong> — перейдите в раздел «Юнит-экономика» и добавьте данные по артикулам
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">4</Badge>
                    <div>
                      <strong>Скачайте результаты</strong> — получите готовые отчёты с анализом, планом производства и экономикой
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
                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <h4 className="font-medium">Структура файла:</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
                    <li>Заголовок с 3-мя строками (даты, метрики, технические поля)</li>
                    <li>Периоды в формате «Декабрь 2024» или «DD.MM.YYYY»</li>
                    <li>Для каждого периода 3 колонки: <strong>Кол-во</strong>, <strong>Сумма</strong>, <strong>Остаток</strong></li>
                    <li>Колонка артикула («Номенклатура.Артикул» или подобная)</li>
                    <li>Опционально: колонка категории</li>
                  </ul>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <h4 className="font-medium">Пример структуры заголовков:</h4>
                  <div className="overflow-x-auto">
                    <table className="text-sm border-collapse w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="p-2 text-left">Строка 1</th>
                          <th className="p-2 text-left">Артикул</th>
                          <th className="p-2 text-left" colSpan={3}>Декабрь 2024</th>
                          <th className="p-2 text-left" colSpan={3}>Январь 2025</th>
                        </tr>
                        <tr className="border-b">
                          <th className="p-2 text-left">Строка 2</th>
                          <th className="p-2 text-left">—</th>
                          <th className="p-2 text-left">Кол-во</th>
                          <th className="p-2 text-left">Сумма</th>
                          <th className="p-2 text-left">Остаток</th>
                          <th className="p-2 text-left">Кол-во</th>
                          <th className="p-2 text-left">Сумма</th>
                          <th className="p-2 text-left">Остаток</th>
                        </tr>
                      </thead>
                    </table>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
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
                  <div className="flex items-center gap-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <Badge className="bg-green-600 text-white text-lg px-3 py-1">A</Badge>
                    <div>
                      <div className="font-medium">Категория A — первые 80% выручки</div>
                      <div className="text-sm text-muted-foreground">Ключевые товары, требующие максимального внимания к запасам</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <Badge className="bg-amber-600 text-white text-lg px-3 py-1">B</Badge>
                    <div>
                      <div className="font-medium">Категория B — следующие 15% выручки</div>
                      <div className="text-sm text-muted-foreground">Товары средней важности, стандартное управление</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <Badge className="bg-red-600 text-white text-lg px-3 py-1">C</Badge>
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
                <div className="grid gap-3">
                  <div className="flex items-center gap-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <Badge className="bg-blue-600 text-white text-lg px-3 py-1">X</Badge>
                    <div>
                      <div className="font-medium">Категория X — CV ≤ 10%</div>
                      <div className="text-sm text-muted-foreground">Стабильный спрос, легко прогнозируемый</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                    <Badge className="bg-purple-600 text-white text-lg px-3 py-1">Y</Badge>
                    <div>
                      <div className="font-medium">Категория Y — CV 10-25%</div>
                      <div className="text-sm text-muted-foreground">Умеренные колебания, требуется страховой запас</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                    <Badge className="bg-orange-600 text-white text-lg px-3 py-1">Z</Badge>
                    <div>
                      <div className="font-medium">Категория Z — CV {'>'} 25%</div>
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
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Обработанный отчёт (CSV/XLSX)
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Полный отчёт со всеми показателями по каждому артикулу:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Артикул</Badge>
                    <Badge variant="outline">Категория</Badge>
                    <Badge variant="outline">ABC</Badge>
                    <Badge variant="outline">XYZ</Badge>
                    <Badge variant="outline">Выручка</Badge>
                    <Badge variant="outline">Доля выручки</Badge>
                    <Badge variant="outline">Кол-во продаж</Badge>
                    <Badge variant="outline">Остаток</Badge>
                    <Badge variant="outline">Цена</Badge>
                    <Badge variant="outline">CV %</Badge>
                    <Badge variant="outline">Ср.мес.продажи</Badge>
                    <Badge variant="outline">Дней до 0</Badge>
                    <Badge variant="outline">План 1м/3м/6м</Badge>
                    <Badge variant="outline">Рекомендация</Badge>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    План производства (CSV)
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Отфильтрованный список артикулов, которым нужно пополнение запасов:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Артикул</Badge>
                    <Badge variant="outline">Категория</Badge>
                    <Badge variant="outline">ABC/XYZ</Badge>
                    <Badge variant="outline">Остаток</Badge>
                    <Badge variant="outline">Ср.мес.продажи</Badge>
                    <Badge variant="outline">План 1м</Badge>
                    <Badge variant="outline">План 3м</Badge>
                    <Badge variant="outline">План 6м</Badge>
                    <Badge variant="outline">Рекомендация</Badge>
                  </div>
                </div>

                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Дополнительные колонки с юнит-экономикой
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    При наличии данных о себестоимости в экспорт добавляются:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-primary/10">Себестоимость</Badge>
                    <Badge variant="outline" className="bg-primary/10">Факт ср.цена</Badge>
                    <Badge variant="outline" className="bg-primary/10">Маржа/шт</Badge>
                    <Badge variant="outline" className="bg-primary/10">Маржинальность %</Badge>
                    <Badge variant="outline" className="bg-primary/10">Рентабельность %</Badge>
                    <Badge variant="outline" className="bg-primary/10">Прибыль</Badge>
                    <Badge variant="outline" className="bg-primary/10">Капитализация</Badge>
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
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <strong>Ср. месячные продажи</strong> = Общее кол-во продаж / Число периодов
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <strong>Скорость продаж/день</strong> = Ср. месячные продажи / 30
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <strong>Дней до нуля</strong> = Текущий остаток / Скорость продаж в день
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <strong>План на N мес.</strong> = max(0, Ср.мес.продажи × N − Текущий остаток)
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
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
                <p>
                  Модуль «Юнит-экономика» позволяет рассчитать реальную себестоимость каждого артикула
                  и оценить прибыльность на основе фактических продаж:
                </p>
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
                      <strong>Оптовые и розничные цены</strong> — автоматический расчёт с наценками
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>Маржинальность по продажам</strong> — сравнение себестоимости с фактической ценой
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>WB-сценарии</strong> — расчёт с учётом СПП, комиссии и логистики
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  Как начать работу
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4">
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">1</Badge>
                    <div>
                      <strong>Перейдите в раздел</strong> — откройте меню «Юнит-экономика» в левой панели
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">2</Badge>
                    <div>
                      <strong>Добавьте артикулы</strong> — вручную через форму или импортируйте из Excel
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">3</Badge>
                    <div>
                      <strong>Заполните данные</strong> — материалы, работа, накладные расходы
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">4</Badge>
                    <div>
                      <strong>Посмотрите расчёты</strong> — себестоимость, цены и маржа рассчитаются автоматически
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">5</Badge>
                    <div>
                      <strong>Свяжите с продажами</strong> — откройте запуск и перейдите на вкладку «Экономика»
                    </div>
                  </li>
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  Структура карточки артикула
                </CardTitle>
                <CardDescription>6 секций для полного описания затрат</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">📦 Карточка</h4>
                    <p className="text-sm text-muted-foreground">
                      Артикул, наименование, категория, URL товара, признак новинки
                    </p>
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">🧵 Материалы (до 3 тканей)</h4>
                    <p className="text-sm text-muted-foreground">
                      Для каждой ткани: название, вес в крое (кг), расход на единицу, цена USD и RUB за кг
                    </p>
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">✂️ Работа и прочее</h4>
                    <p className="text-sm text-muted-foreground">
                      Швейный цех, закройный цех, фурнитура, вышивка/принт — стоимость за единицу
                    </p>
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">📊 Себестоимость и наценка</h4>
                    <p className="text-sm text-muted-foreground">
                      Курс валюты, % административных расходов, % оптовой наценки
                    </p>
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">🏪 Параметры WB</h4>
                    <p className="text-sm text-muted-foreground">
                      СПП %, комиссия WB %, логистика, приёмка, налог УСН, сценарии цен
                    </p>
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">🔍 Конкурент</h4>
                    <p className="text-sm text-muted-foreground">
                      Ссылка и цена конкурента для сравнения
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Формулы расчёта себестоимости</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <strong>Стоимость ткани (RUB/кг)</strong> = Цена USD × Курс валюты
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <strong>Стоимость ткани на единицу</strong> = Цена RUB/кг × Расход кг на единицу
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <strong>Базовая себестоимость</strong> = Ткани + Швейный + Закройный + Фурнитура + Вышивка
                  </div>
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <strong>Реальная себестоимость</strong> = Базовая × (1 + Админ расходы %)
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <strong>Оптовая цена</strong> = Себестоимость × (1 + Наценка %), округление до 10
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <strong>Розничная цена</strong> = Оптовая цена × 1.15
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Факт-показатели по продажам</CardTitle>
                <CardDescription>Расчёт на основе данных из запусков</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  При связи с запуском система автоматически рассчитывает:
                </p>
                <div className="grid gap-3 text-sm">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <strong>Факт ср. цена</strong> = Общая выручка / Общее количество
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <strong>Маржа на единицу</strong> = Факт цена − Себестоимость
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <strong>Маржинальность %</strong> = (Маржа / Факт цена) × 100
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <strong>Рентабельность %</strong> = (Маржа / Себестоимость) × 100
                  </div>
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <strong>Общая прибыль</strong> = Маржа × Количество продаж
                  </div>
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <strong>Капитализация</strong> = Себестоимость × Текущий остаток
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileUp className="h-5 w-5 text-primary" />
                  Импорт из Excel
                </CardTitle>
                <CardDescription>Массовая загрузка данных</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Подготовьте Excel-файл с колонками (поддерживаются русские и английские названия):
                </p>
                
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <h4 className="font-medium">Обязательные колонки:</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Артикул / article</Badge>
                    <Badge variant="outline">Наименование / name</Badge>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <h4 className="font-medium">Опциональные колонки материалов:</h4>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">Ткань 1 название</Badge>
                    <Badge variant="outline">Ткань 1 вес в крое</Badge>
                    <Badge variant="outline">Ткань 1 расход</Badge>
                    <Badge variant="outline">Ткань 1 цена USD</Badge>
                    <Badge variant="outline">Ткань 2...</Badge>
                    <Badge variant="outline">Ткань 3...</Badge>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <h4 className="font-medium">Опциональные колонки работы:</h4>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">Швейный цех</Badge>
                    <Badge variant="outline">Закройный цех</Badge>
                    <Badge variant="outline">Фурнитура</Badge>
                    <Badge variant="outline">Вышивка/принт</Badge>
                    <Badge variant="outline">Курс валюты</Badge>
                    <Badge variant="outline">Админ %</Badge>
                    <Badge variant="outline">Наценка %</Badge>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm">
                    Частичный импорт поддерживается — система обработает только те колонки, которые найдёт в файле.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-primary" />
                  Интеграция с запусками
                </CardTitle>
                <CardDescription>Связь себестоимости с продажами</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Данные юнит-экономики автоматически связываются с результатами анализа продаж:
                </p>
                
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>Вкладка «Экономика»</strong> — появляется в деталях каждого запуска
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>Сводка по запуску</strong> — общая прибыль, капитализация, средняя маржа
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <strong>Экспорт с экономикой</strong> — CSV/XLSX с дополнительными колонками
                    </div>
                  </li>
                </ul>

                <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-sm">
                    Связь происходит по артикулу. Себестоимость одинакова для всех размеров одного артикула.
                  </p>
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
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <strong>Сырых строк</strong> — общее количество записей в БД: каждая комбинация артикул×размер×период с продажами или остатками
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <strong>Уникальных артикулов</strong> — количество уникальных артикулов без учёта размеров
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <strong>Артикул+размер</strong> — количество уникальных комбинаций в итоговой аналитике
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <strong>Сжатие данных</strong> — коэффициент агрегации от сырых строк к аналитике (например, 3% означает сжатие в ~33 раза)
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Этапы обработки</CardTitle>
                <CardDescription>Процесс анализа данных</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="space-y-3">
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">1</Badge>
                    <div>
                      <strong>Загрузка файла</strong> — парсинг Excel, разбиение на чанки и загрузка в базу данных
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">2</Badge>
                    <div>
                      <strong>Агрегация</strong> — группировка по артикулам, расчёт сумм и средних значений
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">3</Badge>
                    <div>
                      <strong>XYZ-анализ</strong> — расчёт коэффициента вариации для каждого артикула
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">4</Badge>
                    <div>
                      <strong>ABC-анализ</strong> — ранжирование по выручке и расчёт кумулятивных долей
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Badge className="shrink-0">5</Badge>
                    <div>
                      <strong>Рекомендации</strong> — формирование планов производства и рекомендаций
                    </div>
                  </li>
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Логирование</CardTitle>
                <CardDescription>Отслеживание процесса обработки</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Система записывает логи на каждом этапе обработки. Логи доступны на странице деталей запуска и содержат:
                </p>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                    <Badge variant="outline" className="bg-primary/10 text-primary">INFO</Badge>
                    <span className="text-sm">Информационные сообщения о начале этапов</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                    <Badge variant="outline" className="bg-green-500/10 text-green-600">ACTION</Badge>
                    <span className="text-sm">Успешное завершение этапов с метриками</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600">WARN</Badge>
                    <span className="text-sm">Предупреждения о возможных проблемах</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                    <Badge variant="outline" className="bg-red-500/10 text-red-600">ERROR</Badge>
                    <span className="text-sm">Ошибки обработки</span>
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
