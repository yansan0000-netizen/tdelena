

# План: Гарантированная очистка базы данных

## Текущая ситуация

1. **В базе 2960 записей** — это накопленные данные от нескольких импортов
2. **Функция `deleteAllCosts()` существует** в `useCosts.ts` (строки 539-556)
3. **Чекбокс уже включен по умолчанию** (`clearBeforeImport = true`)
4. **Виртуализация** — это оптимизация отрисовки, НЕ проблема с данными. Просто показывает, что в списке много строк и отрисовываются только видимые.

## Почему удаление не работает?

Возможные причины:
- Ошибка при вызове `deleteAllCosts()` не показывается пользователю
- Сессия пользователя не активна в момент удаления
- RLS блокирует удаление

---

## Решение

### Шаг 1: Создать Edge Function для гарантированной очистки

Создаю функцию `clear-unit-econ` которая использует `service_role` ключ для гарантированного удаления.

Файл: `supabase/functions/clear-unit-econ/index.ts`

### Шаг 2: Добавить кнопку "Очистить базу" на страницу

Добавляю кнопку на страницу юнит-экономики для ручной очистки.

Файл: `src/pages/UnitEconomics.tsx`

### Шаг 3: Обновить импорт для использования Edge Function

Меняю `CostImport.tsx` чтобы вызывать Edge Function вместо `deleteAllCosts()`.

Файл: `src/components/costs/CostImport.tsx`

---

## Файлы для изменения

1. **Создать**: `supabase/functions/clear-unit-econ/index.ts` — Edge Function для очистки
2. **Изменить**: `supabase/config.toml` — добавить конфигурацию функции
3. **Изменить**: `src/pages/UnitEconomics.tsx` — добавить кнопку "Очистить базу"
4. **Изменить**: `src/components/costs/CostImport.tsx` — использовать Edge Function

---

## Техническая реализация

### Edge Function (clear-unit-econ)

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Получаем токен пользователя
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401, 
      headers: corsHeaders 
    })
  }

  // Используем service_role для гарантированного удаления
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Получаем user_id из токена
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: userError } = await supabase.auth.getUser(token)
  
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { 
      status: 401, 
      headers: corsHeaders 
    })
  }

  console.log(`Clearing all unit_econ_inputs for user: ${user.id}`)

  // Удаляем все записи пользователя
  const { error, count } = await supabase
    .from('unit_econ_inputs')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    console.error('Delete error:', error)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: corsHeaders 
    })
  }

  console.log(`Deleted records for user ${user.id}`)
  return new Response(JSON.stringify({ success: true, deleted: count }), { 
    status: 200, 
    headers: corsHeaders 
  })
})
```

### Кнопка "Очистить базу" (UnitEconomics.tsx)

Добавлю кнопку в header страницы:

```tsx
<Button 
  variant="destructive" 
  onClick={handleClearDatabase}
  className="gap-2"
>
  <Trash2 className="h-4 w-4" />
  Очистить базу
</Button>
```

### Обновление CostImport.tsx

Вместо `deleteAllCosts()` вызываю Edge Function:

```typescript
if (clearBeforeImport) {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await supabase.functions.invoke('clear-unit-econ', {
    headers: {
      Authorization: `Bearer ${session?.access_token}`
    }
  });
  
  if (response.error) {
    setError('Не удалось очистить базу данных');
    return;
  }
}
```

---

## Результат

- База будет очищена гарантированно через Edge Function с service_role
- Появится кнопка для ручной очистки базы
- При следующем импорте останется ровно столько артикулов, сколько в Excel файле (~1755)

