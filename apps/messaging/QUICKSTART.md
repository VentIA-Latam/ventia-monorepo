# Guía de Inicio Rápido - Servicio de Mensajería

## Configuración Inicial

### 1. Configurar Variables de Entorno

```bash
cd apps/messaging
cp .env.example .env
```

Edita `.env` y configura:
- `POSTGRES_*`: Credenciales de base de datos
- `FACEBOOK_APP_ID` y `FACEBOOK_APP_SECRET`: De Meta for Developers
- `SECRET_KEY_BASE`: Genera con `bundle exec rails secret`

### 2. Instalar Dependencias

```bash
bundle install
```

### 3. Crear Base de Datos y Migrar

```bash
# Crear database y esquema messaging
bundle exec rails db:create
bundle exec rails db:migrate
```

Esto creará:
- Esquema `messaging` en PostgreSQL
- Todas las tablas necesarias (accounts, inboxes, conversations, etc.)

## Ejecutar con Docker (Recomendado)

Desde la raíz del monorepo:

```bash
# Iniciar todos los servicios
docker-compose -f docker-compose.dev.yml up -d

# Ver logs del servicio de mensajería
docker-compose -f docker-compose.dev.yml logs -f messaging

# Ver logs de Sidekiq
docker-compose -f docker-compose.dev.yml logs -f messaging-sidekiq
```

El servicio estará disponible en: `http://localhost:3001`

## Verificar Instalación

### Health Check

```bash
curl http://localhost:3001/health
# Debería retornar: OK
```

### Crear Cuenta de Prueba

```bash
# Entrar al contenedor
docker exec -it ventia-messaging bundle exec rails console

# En la consola de Rails:
account = Account.create!(
  name: "Test Account",
  ventia_tenant_id: "tu-tenant-uuid-aqui"
)

puts "Account created: #{account.id}"
```

## Flujo de Embedded Signup de WhatsApp

### 1. Configurar App en Meta for Developers

1. Ve a https://developers.facebook.com
2. Crea una app de tipo "Business"
3. Agrega el producto "WhatsApp"
4. Configura Embedded Signup
5. Copia `App ID` y `App Secret` a `.env`

### 2. Implementar Embedded Signup en Frontend

En tu frontend Next.js:

```typescript
// Componente para conectar WhatsApp
const WhatsAppConnect = () => {
  const handleConnect = () => {
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID!,
      config_id: 'your-config-id', // De Meta dashboard
      response_type: 'code',
      override_default_response_type: 'true',
      extras: JSON.stringify({
        setup: {
          // Datos adicionales si necesitas
        }
      })
    });

    const url = `https://www.facebook.com/v13.0/dialog/oauth?${params}`;
    window.open(url, 'whatsapp_signup', 'width=600,height=800');
  };

  // Escuchar el callback
  useEffect(() => {
    window.addEventListener('message', async (event) => {
      if (event.origin !== 'https://www.facebook.com') return;

      const { code, business_id, waba_id, phone_number_id } = event.data;

      // Enviar a tu backend de mensajería
      const response = await fetch('http://localhost:3001/api/v1/whatsapp/embedded_signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': 'your-tenant-id'
        },
        body: JSON.stringify({
          code,
          business_id,
          waba_id,
          phone_number_id
        })
      });

      const data = await response.json();
      console.log('WhatsApp connected:', data);
    });
  }, []);

  return <button onClick={handleConnect}>Conectar WhatsApp</button>;
};
```

### 3. Configurar Webhook en Meta

Una vez conectado WhatsApp, el servicio automáticamente:
1. Intercambia el código por access token
2. Crea el canal WhatsApp en la BD
3. Crea el inbox asociado
4. Configura el webhook en Meta

Tu webhook URL será:
```
https://tu-dominio.com/api/v1/whatsapp/webhooks/{inbox_id}
```

## API Endpoints Principales

### Accounts

```bash
# Listar cuentas
GET /api/v1/accounts
Headers: X-Tenant-Id: {tenant_id}

# Crear cuenta
POST /api/v1/accounts
{
  "account": {
    "name": "Mi Empresa",
    "ventia_tenant_id": "uuid-del-tenant"
  }
}
```

### Conversations

```bash
# Listar conversaciones
GET /api/v1/conversations?status=open
Headers: X-Tenant-Id: {tenant_id}

# Ver conversación
GET /api/v1/conversations/{id}
```

### Messages

```bash
# Enviar mensaje
POST /api/v1/conversations/{conversation_id}/messages
{
  "message": {
    "content": "Hola! ¿Cómo puedo ayudarte?",
    "content_type": "text"
  }
}
```

### Campaigns

```bash
# Crear campaña
POST /api/v1/campaigns
{
  "campaign": {
    "title": "Promoción Febrero",
    "message": "¡Aprovecha 20% de descuento!",
    "inbox_id": "inbox-uuid",
    "scheduled_at": "2024-02-10T10:00:00Z",
    "audience": []
  }
}

# Disparar campaña
POST /api/v1/campaigns/{id}/trigger
```

### Labels

```bash
# Crear etiqueta
POST /api/v1/labels
{
  "label": {
    "title": "vip",
    "description": "Cliente VIP",
    "color": "#FF5733"
  }
}
```

### Automation Rules

```bash
# Crear regla de automatización
POST /api/v1/automation_rules
{
  "automation_rule": {
    "name": "Bienvenida automática",
    "event_name": "conversation_created",
    "conditions": [
      {
        "attribute_key": "status",
        "filter_operator": "equal_to",
        "values": ["open"]
      }
    ],
    "actions": [
      {
        "action_name": "send_message",
        "action_params": {
          "message": "¡Hola! Bienvenido, ¿en qué puedo ayudarte?"
        }
      }
    ]
  }
}
```

## Integración con Backend Ventia (FastAPI)

Crea un servicio en tu backend FastAPI:

```python
# apps/backend/app/services/messaging_service.py
import httpx
from uuid import UUID

class MessagingService:
    def __init__(self):
        self.base_url = "http://messaging:3001/api/v1"

    async def send_whatsapp_message(
        self,
        tenant_id: UUID,
        conversation_id: UUID,
        message: str
    ):
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/conversations/{conversation_id}/messages",
                headers={"X-Tenant-Id": str(tenant_id)},
                json={
                    "message": {
                        "content": message,
                        "content_type": "text"
                    }
                }
            )
            return response.json()

    async def get_conversations(self, tenant_id: UUID):
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/conversations",
                headers={"X-Tenant-Id": str(tenant_id)}
            )
            return response.json()
```

## Troubleshooting

### Error: "Account not found for tenant"

Asegúrate de:
1. Haber creado un Account con el `ventia_tenant_id` correcto
2. Enviar el header `X-Tenant-Id` en las peticiones

### Webhook no recibe mensajes

1. Verifica que el webhook esté configurado en Meta Dashboard
2. Verifica que tu URL sea accesible públicamente (usa ngrok para desarrollo)
3. Revisa los logs: `docker logs ventia-messaging`

### Mensajes no se envían

1. Verifica que Sidekiq esté corriendo: `docker logs ventia-messaging-sidekiq`
2. Verifica que el access token de WhatsApp sea válido
3. Revisa la consola de Rails para errores

## Próximos Pasos

1. Implementar autenticación JWT compartida con Ventia
2. Agregar más tipos de mensajes (imágenes, videos, etc.)
3. Implementar métricas y reportes
4. Agregar tests automatizados
5. Documentar webhooks salientes

## Recursos

- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Meta Embedded Signup](https://developers.facebook.com/docs/whatsapp/embedded-signup)
- [Rails API Docs](https://api.rubyonrails.org/)
