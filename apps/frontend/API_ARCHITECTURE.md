# Arquitectura de Llamadas a API - Frontend

## 📋 Tabla de Contenidos
- [Resumen Ejecutivo](#resumen-ejecutivo)
- [Problemas Identificados](#problemas-identificados)
- [Arquitectura Propuesta](#arquitectura-propuesta)
- [Patrones de Uso](#patrones-de-uso)
- [Estructura de Carpetas](#estructura-de-carpetas)
- [Guía de Implementación](#guía-de-implementación)
- [Ejemplos de Migración](#ejemplos-de-migración)

---

## 🎯 Resumen Ejecutivo

Este documento define la **arquitectura unificada** para hacer llamadas a APIs en el frontend de Ventia. El objetivo es **eliminar la inconsistencia** actual y establecer patrones claros y mantenibles.

### Principios Fundamentales

1. **Separación clara entre Client y Server Components**
2. **Un solo punto de entrada para cada tipo de operación**
3. **Seguridad del token de acceso**
4. **Reutilización de código**
5. **Type safety con TypeScript**

---

## ❌ Problemas Identificados

### 1. Múltiples Patrones Coexistiendo
- ✗ API Routes (`/app/api/*`) usados como proxy
- ✗ Services (`/lib/services/*`) llamando directamente al backend
- ✗ Fetch directo en componentes cliente
- ✗ Mezcla de llamadas con y sin API routes
- ✗ Fetch de tokens inline en múltiples lugares

### 2. Inseguridad
- ✗ Tokens expuestos en el cliente
- ✗ `NEXT_PUBLIC_API_URL` usado desde el cliente
- ✗ No hay validación consistente de tokens

### 3. Código Duplicado
- ✗ Misma lógica de fetch en múltiples archivos
- ✗ Manejo de errores inconsistente
- ✗ Parsing de respuestas duplicado

---

## ✅ Arquitectura Propuesta

### Regla de Oro

```
┌─────────────────────────────────────────────────────────────┐
│  🚫 NUNCA llamar directamente al backend desde el cliente   │
│  ✅ SIEMPRE usar API Routes como proxy desde el cliente     │
│  ✅ Server Components pueden usar services directamente     │
└─────────────────────────────────────────────────────────────┘
```

### Diagrama de Flujo

```
Client Component
    │
    ├─ fetch("/api/...") ──► API Route ──► Backend Service ──► FastAPI Backend
    │                            │
    │                            └─► getAccessToken() (seguro)
    │
Server Component
    │
    └─ import service ──► Backend Service ──► FastAPI Backend
                              │
                              └─► getAccessToken() (seguro)
```

---

## 📚 Patrones de Uso

### Patrón 1: Client Component → API Route

**Cuándo usar:**
- Componentes con `"use client"`
- Interacciones del usuario (botones, forms)
- Componentes que necesitan estado o hooks
- Diálogos, modales, formularios

**Ejemplo:**
```tsx
// ✅ CORRECTO: En un Client Component
"use client";

async function handleSubmit() {
  const response = await fetch('/api/orders/123/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
}
```

### Patrón 2: Server Component → Service Directo

**Cuándo usar:**
- Server Components (sin `"use client"`)
- Initial data loading
- SSR (Server-Side Rendering)
- Páginas que no necesitan interactividad

**Ejemplo:**
```tsx
// ✅ CORRECTO: En un Server Component
import { getAccessToken } from '@/lib/auth0';
import { fetchOrders } from '@/lib/services/order-service';

export default async function OrdersPage() {
  const token = await getAccessToken();
  const orders = await fetchOrders(token, { limit: 100 });
  
  return <OrdersClientView orders={orders} />;
}
```

### Patrón 3: API Route como Proxy

**Cuándo crear:**
- Para cada operación que necesite el cliente
- Para proteger el token de acceso
- Para agregar lógica de autorización
- Para transformar datos si es necesario

**Ejemplo:**
```ts
// ✅ CORRECTO: API Route en /app/api/orders/[id]/validate/route.ts
import { getAccessToken } from '@/lib/auth0';
import { validateOrder } from '@/lib/services/order-service';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
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
│   │
│   ├── dashboard/                # 🖥️ Server Components (SSR)
│   │   ├── page.tsx             # Server Component
│   │   └── orders/
│   │       ├── page.tsx         # Server Component (data loading)
│   │       └── orders-client.tsx # Client Component (interactivity)
│   │
│   └── superadmin/               # Similar structure
│
├── lib/
│   ├── services/                 # 🔧 Backend Services
│   │   ├── order-service.ts     # Business logic para orders
│   │   ├── invoice-service.ts   # Business logic para invoices
│   │   └── ...                  # Un service por dominio
│   │
│   ├── api-client/              # 🆕 NEW: Client-side API helpers
│   │   ├── client.ts            # Wrapper para fetch desde cliente
│   │   ├── orders.ts            # Client API para orders
│   │   └── invoices.ts          # Client API para invoices
│   │
│   └── types/                   # TypeScript types
│
└── components/
    ├── dashboard/               # Components del dashboard
    └── superadmin/             # Components del superadmin
```

---

## 🛠️ Guía de Implementación

### 1. Services Layer (`/lib/services/*`)

**Responsabilidad:** Comunicación directa con el backend FastAPI

**Reglas:**
- ✅ Solo para uso en Server Components y API Routes
- ✅ Requieren `accessToken` como parámetro
- ✅ Usan `process.env.NEXT_PUBLIC_API_URL` (pero solo server-side)
- ✅ Retornan tipos TypeScript
- ✅ Lanzan errores que deben ser manejados

**Template:**
```typescript
// lib/services/entity-service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export async function fetchEntities(
  accessToken: string,
  params?: { skip?: number; limit?: number }
): Promise<EntityListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.skip) queryParams.append('skip', params.skip.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const url = `${API_URL}/entities?${queryParams}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ 
      detail: 'Failed to fetch entities' 
    }));
    throw new Error(error.detail || 'Failed to fetch entities');
  }

  return response.json();
}
```

### 2. API Routes (`/app/api/*`)

**Responsabilidad:** Proxy seguro entre Client Components y Backend

**Reglas:**
- ✅ Obtienen token con `getAccessToken()` (server-side)
- ✅ Llaman a services con el token
- ✅ Retornan JSON responses
- ✅ Manejan errores apropiadamente

**Template:**
```typescript
// app/api/entities/route.ts
import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth0';
import { fetchEntities } from '@/lib/services/entity-service';

export async function GET(request: Request) {
  try {
    const token = await getAccessToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const skip = parseInt(searchParams.get('skip') || '0');
    const limit = parseInt(searchParams.get('limit') || '20');

    const entities = await fetchEntities(token, { skip, limit });
    return NextResponse.json(entities);

  } catch (error) {
    console.error('Error fetching entities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entities', details: error.message },
      { status: 500 }
    );
  }
}
```

### 3. Client API Layer (`/lib/api-client/*`) - NUEVO

**Responsabilidad:** Helpers para Client Components hacer fetch a API Routes

**Reglas:**
- ✅ Solo para uso en Client Components
- ✅ Llaman a `/api/*` (no al backend directamente)
- ✅ No manejan tokens (los API routes lo hacen)
- ✅ Proporcionan type safety

**Template:**
```typescript
// lib/api-client/entities.ts
import type { Entity, EntityListResponse } from '@/lib/types/entity';

export async function getEntities(params?: {
  skip?: number;
  limit?: number;
}): Promise<EntityListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.skip) queryParams.append('skip', params.skip.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const response = await fetch(`/api/entities?${queryParams}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ 
      error: 'Failed to fetch entities' 
    }));
    throw new Error(error.error || 'Failed to fetch entities');
  }

  return response.json();
}

export async function createEntity(data: Partial<Entity>): Promise<Entity> {
  const response = await fetch('/api/entities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ 
      error: 'Failed to create entity' 
    }));
    throw new Error(error.error || 'Failed to create entity');
  }

  return response.json();
}
```

### 4. Server Components

**Responsabilidad:** Cargar datos iniciales de forma segura

**Reglas:**
- ✅ No tienen `"use client"` directive
- ✅ Usan services directamente
- ✅ Pasan datos a Client Components como props
- ✅ Son async functions

**Template:**
```tsx
// app/dashboard/entities/page.tsx
import { getAccessToken } from '@/lib/auth0';
import { fetchEntities } from '@/lib/services/entity-service';
import { EntitiesClientView } from './entities-client';

export default async function EntitiesPage() {
  let entities = [];
  let error = null;

  try {
    const token = await getAccessToken();
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetchEntities(token, { limit: 100 });
    entities = response.items;
  } catch (err) {
    console.error('Error loading entities:', err);
    error = err instanceof Error ? err.message : 'Failed to load entities';
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return <EntitiesClientView initialEntities={entities} />;
}
```

### 5. Client Components

**Responsabilidad:** Interactividad y actualizaciones dinámicas

**Reglas:**
- ✅ Tienen `"use client"` directive
- ✅ Usan Client API Layer para fetch
- ✅ Pueden usar hooks (useState, useEffect)
- ✅ Manejan interacciones del usuario

**Template:**
```tsx
// app/dashboard/entities/entities-client.tsx
"use client";

import { useState } from 'react';
import { getEntities } from '@/lib/api-client/entities';

interface EntitiesClientViewProps {
  initialEntities: Entity[];
}

export function EntitiesClientView({ initialEntities }: EntitiesClientViewProps) {
  const [entities, setEntities] = useState(initialEntities);
  const [loading, setLoading] = useState(false);

  async function handleRefresh() {
    setLoading(true);
    try {
      const response = await getEntities({ limit: 100 });
      setEntities(response.items);
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={handleRefresh} disabled={loading}>
        Refresh
      </button>
      {/* Render entities */}
    </div>
  );
}
```

---

## 🔄 Ejemplos de Migración

### Antes (❌ Incorrecto)

```tsx
// ❌ Client component llamando directamente al backend
"use client";

export function OrdersList() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    async function loadOrders() {
      // ❌ Token obtenido desde cliente
      const tokenRes = await fetch("/api/auth/token");
      const { token } = await tokenRes.json();
      
      // ❌ Llamada directa al backend desde cliente
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${API_URL}/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setOrders(data.items);
    }
    loadOrders();
  }, []);

  return <div>{/* render orders */}</div>;
}
```

### Después (✅ Correcto)

```tsx
// ✅ Server Component para carga inicial
// app/dashboard/orders/page.tsx
import { getAccessToken } from '@/lib/auth0';
import { fetchOrders } from '@/lib/services/order-service';
import { OrdersClientView } from './orders-client';

export default async function OrdersPage() {
  const token = await getAccessToken();
  const response = await fetchOrders(token, { limit: 100 });
  
  return <OrdersClientView initialOrders={response.items} />;
}

// ✅ Client Component para interactividad
// app/dashboard/orders/orders-client.tsx
"use client";

import { useState } from 'react';
import { getOrders } from '@/lib/api-client/orders';

export function OrdersClientView({ initialOrders }) {
  const [orders, setOrders] = useState(initialOrders);

  async function handleRefresh() {
    // ✅ Llamada a API route (no al backend directamente)
    const response = await getOrders({ limit: 100 });
    setOrders(response.items);
  }

  return <div>{/* render orders con interactividad */}</div>;
}

// ✅ API Route como proxy
// app/api/orders/route.ts
import { getAccessToken } from '@/lib/auth0';
import { fetchOrders } from '@/lib/services/order-service';

export async function GET(request: Request) {
  const token = await getAccessToken();
  const response = await fetchOrders(token, { limit: 100 });
  return NextResponse.json(response);
}

// ✅ Client API helper
// lib/api-client/orders.ts
export async function getOrders(params) {
  const response = await fetch(`/api/orders?${queryParams}`);
  return response.json();
}
```

---

## 🎓 Decisiones de Diseño

### ¿Por qué API Routes como proxy?

1. **Seguridad**: El token NUNCA llega al cliente
2. **Separación de concerns**: Backend vs Frontend logic
3. **Flexibilidad**: Podemos agregar lógica middleware
4. **Error handling**: Centralizado en el servidor
5. **Testing**: Más fácil de testear

### ¿Por qué Server Components para carga inicial?

1. **Performance**: SSR más rápido que CSR
2. **SEO**: Contenido renderizado en servidor
3. **Seguridad**: Token manejado server-side
4. **UX**: Menos JavaScript al cliente

### ¿Por qué Client API Layer?

1. **Type Safety**: TypeScript types compartidos
2. **Reusabilidad**: DRY (Don't Repeat Yourself)
3. **Mantenibilidad**: Cambios en un solo lugar
4. **Developer Experience**: Autocompletado en IDE

---

## 📝 Checklist de Migración

Al refactorizar un componente o feature:

- [ ] ¿Es un Server Component? → Usar service directamente
- [ ] ¿Es un Client Component? → Usar Client API Layer
- [ ] ¿Existe el API Route? → Si no, crearlo
- [ ] ¿Existe el Client API helper? → Si no, crearlo
- [ ] ¿El service está actualizado? → Verificar tipos y lógica
- [ ] ¿Manejamos errores apropiadamente? → Try/catch y mensajes
- [ ] ¿Los tipos TypeScript están actualizados? → Verificar `/lib/types`
- [ ] ¿Removimos fetch directo al backend desde cliente? → Sí
- [ ] ¿Removimos obtención de token desde cliente? → Sí
- [ ] ¿Removimos `NEXT_PUBLIC_API_URL` del cliente? → Sí

---

## 🚀 Plan de Acción

1. **Crear Client API Layer** (`/lib/api-client/`)
2. **Migrar componentes uno por uno**
3. **Actualizar API Routes faltantes**
4. **Eliminar código legacy**
5. **Testing y validación**

---

## 📞 Preguntas Frecuentes

### ¿Qué pasa con las llamadas existentes en services?

Los services siguen siendo útiles, pero **solo para Server Components y API Routes**. No los uses desde Client Components.

### ¿Debo crear una API Route para cada endpoint?

Sí, si necesitas llamarlo desde un Client Component. Si solo lo usas en Server Components, puedes usar el service directamente.

### ¿Puedo usar React Query o SWR?

Sí, perfecto. Úsalo con el Client API Layer:

```tsx
import { useQuery } from '@tanstack/react-query';
import { getOrders } from '@/lib/api-client/orders';

function OrdersList() {
  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => getOrders({ limit: 100 })
  });
}
```

### ¿Qué hago con código legacy?

Migralo gradualmente siguiendo este documento. No es necesario hacerlo todo de una vez.

---

**Última actualización:** Enero 2026  
**Mantenedor:** Equipo de Frontend Ventia
