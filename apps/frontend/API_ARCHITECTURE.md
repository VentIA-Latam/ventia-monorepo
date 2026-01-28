# Arquitectura de API Calls - Guía para IA Agent

## Regla de Oro

```
ARQUITECTURA HÍBRIDA:
1. Client Component ("use client") → API Route → Backend
2. Server Component (sin "use client") → Service directo → Backend

NUNCA llamar directamente al backend desde Client Components
NUNCA exponer tokens en el cliente
```

---

## Patrones Obligatorios

### Patrón 1: Client Component

**Usar cuando:**
- Componente tiene `"use client"`
- Interacciones del usuario (botones, forms, dialogs)
- Necesita useState, useEffect, o eventos

**Código:**
```tsx
"use client";
import { getOrders, createOrder } from '@/lib/api-client';

async function handleSubmit() {
  const orders = await getOrders({ limit: 50 });
  await createOrder(data);
}
```

### Patrón 2: Server Component

**Usar cuando:**
- NO tiene `"use client"`
- Carga inicial de datos
- SSR (Server-Side Rendering)

**Código:**
```tsx
import { getAccessToken } from '@/lib/auth0';
import { fetchOrders } from '@/lib/services/order-service';

export default async function OrdersPage() {
  const token = await getAccessToken();
  const orders = await fetchOrders(token, { limit: 100 });
  return <OrdersClientView orders={orders} />;
}
```

### Patrón 3: API Route (si no existe)

**Crear cuando:**
- Client Component necesita llamar al backend
- Operación no tiene API Route todavía

**Código:**
```ts
// app/api/orders/[id]/validate/route.ts
import { getAccessToken } from '@/lib/auth0';
import { validateOrder } from '@/lib/services/order-service';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const body = await request.json();
  const result = await validateOrder(token, parseInt(params.id), body);
  return NextResponse.json(result);
}
```

---

## 📁 Estructura de Carpetas

```
apps/frontend/
├── app/
│   ├── api/                      # 🔒 API Routes (Server-side only)
│   │   ├── orders/
│   │   │   ├── route.ts         # GET /api/orders
│   │   │   └── [id]/
│   │   │       ├── route.ts     # GET /api/orders/:id
│   │   │       └── validate/
│   │   │           └── route.ts # POST /api/orders/:id/validate
│   │   ├── invoices/
│   │   ├── superadmin/
│   │   └── ...
│  Estructura

```
lib/
├── api-client/          # Para Client Components
│   ├── orders.ts
│   ├── invoices.ts
│   └── superadmin.ts
├── services/            # Para Server Components y API Routes
│   ├── order-service.ts
│   └── invoice-service.ts
└── types/               # TypeScript types

app/
├── api/                 # API Routes (proxy seguro)
│   ├── orders/
│   └── invoices/
└── dashboard/
    ├── page.tsx         # Server Component
    └── orders-client.tsx # Client Component
```

---

## Templates de Código

### Client API Function
```typescript
// lib/api-client/entities.ts
import { apiGet, apiPost } from './client';

export async function getEntities(params?: { skip?: number; limit?: number }) {
  return apiGet('/api/entities', params);
}

export async function createEntity(data: any) {
  return apiPost('/api/entities', data);
}
```

### API Route
```typescript
// app/api/entities/route.ts
import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth0';
import { fetchEntities } from '@/lib/services/entity-service';

export async function GET(request: Request) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { searchParams } = new URL(request.url);
  const skip = parseInt(searchParams.get('skip') || '0');
  const limit = parseInt(searchParams.get('limit') || '20');

  const entities = await fetchEntities(token, { skip, limit });
  return NextResponse.json(entities);
}
```

### Service Function
```typescript
// lib/services/entity-service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export async function fetchEntities(accessToken: string, params?: { skip?: number; limit?: number }) {
  const queryParams = new URLSearchParams();
  if (params?.skip) queryParams.append('skip', params.skip.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const response = await fetch(`${API_URL}/entities?${queryParams}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch entities' }));
    throw new Error(error.detail || 'Failed to fetch entities');
  }

  return response.json();
}
```

### Server Component
```tsx
// app/dashboard/entities/page.tsx
import { getAccessToken } from '@/lib/auth0';
import { fetchEntities } from '@/lib/services/entity-service';
import { EntitiesClientView } from './entities-client';

export default async function EntitiesPage() {
  const token = await getAccessToken();
  const response = await fetchEntities(token, { limit: 100 });
  return <EntitiesClientView initialEntities={response.items} />;
}
```

### Client Component
```tsx
// app/dashboard/entities/entities-client.tsx
"use client";
import { useState } from 'react';
import { getEntities } from '@/lib/api-client/entities';

export function EntitiesClientView({ initialEntities }) {
  const [entities, setEntities] = useState(initialEntities);

  async function handleRefresh() {
    const response = await getEntities({ limit: 100 });
    setEntities(response.items);
  }

  return <button onClick={handleRefresh}>Refresh</button>;
}
```

---

## Checklist para Implementar Feature

1. ¿Es Client Component?
   - [ ] Crear función en `/lib/api-client/`
   - [ ] Crear API Route en `/app/api/`
   - [ ] Usar `import { getX } from '@/lib/api-client'`

2. ¿Es Server Component?
   - [ ] Usar service directamente de `/lib/services/`
   - [ ] Llamar `getAccessToken()` primero
   - [ ] Pasar datos como props a Client Component

3. ¿Falta API Route?
   - [ ] Crear en `/app/api/` siguiendo template
   - [ ] Validar token con `getAccessToken()`
   - [ ] Llamar service correspondiente

4. ¿Falta Service?
   - [ ] Crear en `/lib/services/` siguiendo template
   - [ ] Requiere `accessToken` como parámetro
   - [ ] Usa `process.env.NEXT_PUBLIC_API_URL`

---

## Ejemplos Rápidos

### Antes (Incorrecto)
```tsx
"use client";
const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### Después (Correcto)
```tsx
"use client";
import { getOrders } from '@/lib/api-client';
const orders = await getOrders();
```---

**Arquitectura:** Híbrida (Server Components + API Routes)  
**Principio:** Client Components usan API Routes, Server Components usan Services  
**Beneficio:** Carga rápida + Interactividad segur