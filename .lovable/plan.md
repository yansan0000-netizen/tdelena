

# План: Исправление загрузки XLSX в Web Workers

## Проблема

Web Worker `excel-worker-raw.js` не может загрузить библиотеку XLSX с CDN:
```
Failed to execute 'importScripts': The script at 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js' failed to load.
```

**Причины:**
1. CDN `cdn.sheetjs.com` нестабилен или заблокирован
2. В `excel-worker-raw.js` библиотека загружается **внутри функции** (строка 471), а не в начале файла
3. Разные воркеры используют разные версии с разных CDN:
   - `excel-worker.js` → `xlsx-0.20.2` с sheetjs.com
   - `excel-worker-streaming.js` → `0.18.5` с cdnjs.cloudflare.com
   - `excel-worker-raw.js` → `xlsx-0.20.0` с sheetjs.com (проблемный!)

## Решение

Унифицировать все воркеры на **стабильный CDN Cloudflare** с последней доступной версией `0.18.5`, загружая библиотеку **в начале файла**.

---

## Файлы для изменения

### 1. `public/excel-worker-raw.js`

**Изменения:**
- Переместить `importScripts` в **начало файла** (строка 1)
- Использовать стабильный CDN: `https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js`
- Удалить `importScripts` из функции `processExcelRaw()` (строка 471)

До:
```javascript
// Строка 471 внутри функции:
importScripts('https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js');
```

После:
```javascript
// Строка 1 файла:
importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');

// Строка 471 — удалить вызов importScripts
```

### 2. `public/excel-worker.js`

**Изменения:**
- Обновить CDN на стабильный Cloudflare

До:
```javascript
importScripts('https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js');
```

После:
```javascript
importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
```

### 3. `public/excel-worker-streaming.js`

Уже использует правильный CDN — **без изменений**:
```javascript
importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
```

---

## Техническая реализация

### excel-worker-raw.js (основные изменения)

```javascript
// Строка 1 — добавить загрузку библиотеки
importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');

// ...остальной код...

async function processExcelRaw(arrayBuffer, categoryFilter, maxDataRows) {
  sendProgress('Загрузка библиотеки XLSX...', 0);
  // УДАЛИТЬ строку 471: importScripts(...)
  
  // Validate file signature...
```

### excel-worker.js (одна строка)

```javascript
// Строка 3 — изменить CDN
importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
```

---

## Почему Cloudflare CDN лучше

1. **Стабильность** — Cloudflare имеет глобальную CDN сеть
2. **Кеширование** — файлы кешируются на серверах по всему миру
3. **Скорость** — быстрая загрузка из ближайшей точки присутствия
4. **Версия 0.18.5** — проверена и работает стабильно

---

## Результат

- Все 3 воркера будут использовать единую стабильную версию XLSX
- Загрузка отчётов будет работать без ошибок CDN
- Не нужно хранить XLSX библиотеку локально (экономия размера проекта)

