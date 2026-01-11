# Plan de Integración de Facturación Electrónica eFact-OSE

## 🎯 Visión del Proyecto

Implementar facturación electrónica SUNAT (Perú) mediante integración con eFact-OSE, permitiendo a los tenants de Ventia generar facturas, boletas, notas de crédito y débito electrónicas para sus órdenes validadas.

### Arquitectura Propuesta

**Normalización:** Tablas separadas `invoices` e `invoice_series` (no campos en `orders`)

**Relaciones:**
- Order 1:N Invoice (una orden puede tener múltiples comprobantes)
- Invoice 1:N Invoice (auto-referencia para NC/ND)
- Tenant 1:N Invoice, Tenant 1:N InvoiceSerie

**Autenticación eFact (Ventia):**
- POST `https://ose-gw1.efact.pe:443/api-efact-ose/oauth/token`
- Header: `Authorization: Basic Y2xpZW50OnNlY3JldA==` (fijo)
- Body: `username={RUC_VENTIA}&password={PASSWORD_REST}&grant_type=password`
- Token cache: 11 horas

**Archivos:** Proxy en tiempo real (no almacenar localmente)

---

## 📋 Historias de Usuario

### ÉPICA 1: Base de Datos - Modelos y Migraciones

---

#### **US-001: Crear Modelo Invoice para Comprobantes Electrónicos**

**Como** desarrollador del sistema
**Quiero** crear el modelo SQLAlchemy `Invoice` para almacenar comprobantes electrónicos
**Para** tener una tabla normalizada separada de `orders` con toda la información de facturación

**Descripción:**
Crear el modelo `Invoice` en `apps/backend/app/models/invoice.py` que represente comprobantes electrónicos SUNAT (Facturas, Boletas, Notas de Crédito, Notas de Débito).

**Criterios de Aceptación:**

1. **Estructura del Modelo:**
   - ✅ Hereda de `Base` y `TimestampMixin`
   - ✅ Tabla: `invoices`
   - ✅ Tiene relación FK con `tenants.id` (CASCADE)
   - ✅ Tiene relación FK con `orders.id` (CASCADE)
   - ✅ Tiene auto-referencia FK `reference_invoice_id` para NC/ND (SET NULL)

2. **Campos Principales:**
   - ✅ `invoice_type` (String 2): "01"=Factura, "03"=Boleta, "07"=NC, "08"=ND
   - ✅ `serie` (String 4): Serie del comprobante (ej: "F001", "B001")
   - ✅ `correlativo` (Integer): Número correlativo
   - ✅ `emisor_ruc` (String 11): RUC del tenant emisor
   - ✅ `emisor_razon_social` (String 200): Razón social del tenant
   - ✅ `cliente_tipo_documento` (String 1): "1"=DNI, "6"=RUC
   - ✅ `cliente_numero_documento` (String 11): DNI o RUC del cliente
   - ✅ `cliente_razon_social` (String 200): Nombre del cliente
   - ✅ `currency` (String 3): "PEN", "USD"
   - ✅ `subtotal` (Float): Subtotal sin IGV
   - ✅ `igv` (Float): IGV (18%)
   - ✅ `total` (Float): Total a pagar
   - ✅ `items` (JSON): Line items desde `order.line_items`

3. **Campos de Referencia (NC/ND):**
   - ✅ `reference_invoice_id` (Integer, FK, NULLABLE)
   - ✅ `reference_type` (String 2, NULLABLE)
   - ✅ `reference_serie` (String 4, NULLABLE)
   - ✅ `reference_correlativo` (Integer, NULLABLE)
   - ✅ `reference_reason` (String 200, NULLABLE)

4. **Campos de Integración eFact:**
   - ✅ `efact_ticket` (String 100, UNIQUE, INDEX): UUID de eFact
   - ✅ `efact_status` (String 20, INDEX): "pending", "processing", "success", "error"
   - ✅ `efact_response` (JSON, NULLABLE): CDR de SUNAT
   - ✅ `efact_error` (String 500, NULLABLE): Mensaje de error
   - ✅ `efact_sent_at` (DateTime, NULLABLE)
   - ✅ `efact_processed_at` (DateTime, NULLABLE)

5. **Constraints e Índices:**
   - ✅ UNIQUE: (tenant_id, serie, correlativo) → `uq_tenant_serie_correlativo`
   - ✅ INDEX: `tenant_id`, `order_id`, `efact_ticket`, `efact_status`
   - ✅ INDEX compuesto: (order_id, invoice_type)

6. **Relaciones SQLAlchemy:**
   - ✅ `tenant = relationship("Tenant", back_populates="invoices")`
   - ✅ `order = relationship("Order", back_populates="invoices")`
   - ✅ Auto-referencia: `reference_invoice` y `credit_debit_notes`

**Archivos Afectados:**
- `apps/backend/app/models/invoice.py` (CREAR)

---

#### **US-002: Crear Modelo InvoiceSerie para Gestión de Correlativos**

**Como** desarrollador del sistema
**Quiero** crear el modelo `InvoiceSerie` para gestionar series y correlativos de forma thread-safe
**Para** evitar duplicación de números de comprobantes en concurrencia

**Descripción:**
Crear modelo `InvoiceSerie` que almacena las series activas de cada tenant y el último correlativo usado, permitiendo obtener el siguiente correlativo de forma atómica.

**Criterios de Aceptación:**

1. **Estructura del Modelo:**
   - ✅ Hereda de `Base` y `TimestampMixin`
   - ✅ Tabla: `invoice_series`
   - ✅ Tiene relación FK con `tenants.id` (CASCADE)

2. **Campos:**
   - ✅ `tenant_id` (Integer, FK, INDEX)
   - ✅ `invoice_type` (String 2): "01", "03", "07", "08"
   - ✅ `serie` (String 4): Código de serie (ej: "F001", "B001")
   - ✅ `last_correlativo` (Integer, default=0): Último número usado
   - ✅ `is_active` (Boolean, default=True): Serie activa o no
   - ✅ `description` (String 100, NULLABLE): Descripción opcional

3. **Constraints:**
   - ✅ UNIQUE: (tenant_id, serie) → `uq_tenant_serie`
   - ✅ INDEX: `tenant_id`

4. **Relaciones:**
   - ✅ `tenant = relationship("Tenant", back_populates="invoice_series")`

**Archivos Afectados:**
- `apps/backend/app/models/invoice_serie.py` (CREAR)

---

#### **US-003: Actualizar Modelo Tenant con Campos de Facturación**

**Como** desarrollador del sistema
**Quiero** agregar campos de facturación al modelo `Tenant`
**Para** que cada tenant pueda tener su RUC y gestionar sus comprobantes

**Descripción:**
Modificar el modelo `Tenant` existente para agregar el campo `efact_ruc` y las relaciones con `Invoice` e `InvoiceSerie`.

**Criterios de Aceptación:**

1. **Nuevo Campo:**
   - ✅ `efact_ruc` (String 11, NULLABLE): RUC del tenant para facturación
   - ✅ Comment: "RUC del tenant para facturación electrónica"

2. **Nuevas Relaciones:**
   - ✅ `invoices = relationship("Invoice", back_populates="tenant", cascade="all, delete-orphan")`
   - ✅ `invoice_series = relationship("InvoiceSerie", back_populates="tenant", cascade="all, delete-orphan")`

3. **Comportamiento:**
   - ✅ Al eliminar un tenant, se eliminan sus invoices e invoice_series (CASCADE)

**Archivos Afectados:**
- `apps/backend/app/models/tenant.py` (MODIFICAR)

---

#### **US-004: Actualizar Modelo Order con Relación a Invoices**

**Como** desarrollador del sistema
**Quiero** agregar relación de `Order` a `Invoice`
**Para** poder listar todos los comprobantes de una orden

**Descripción:**
Modificar el modelo `Order` para agregar relación bidireccional con `Invoice`.

**Criterios de Aceptación:**

1. **Nueva Relación:**
   - ✅ `invoices = relationship("Invoice", back_populates="order", cascade="all, delete-orphan")`

2. **Comportamiento:**
   - ✅ Al eliminar una orden, se eliminan sus invoices (CASCADE)
   - ✅ Desde una orden se puede acceder a `order.invoices` (lista)

**Archivos Afectados:**
- `apps/backend/app/models/order.py` (MODIFICAR)

---

#### **US-005: Actualizar __init__ de Modelos**

**Como** desarrollador del sistema
**Quiero** registrar los nuevos modelos en `__init__.py`
**Para** que Alembic los detecte y genere migraciones

**Criterios de Aceptación:**

1. **Imports Agregados:**
   - ✅ `from app.models.invoice import Invoice`
   - ✅ `from app.models.invoice_serie import InvoiceSerie`

**Archivos Afectados:**
- `apps/backend/app/models/__init__.py` (MODIFICAR)

---

#### **US-006: Crear Migración para Tabla Invoices**

**Como** desarrollador del sistema
**Quiero** crear una migración Alembic para la tabla `invoices`
**Para** aplicar los cambios en la base de datos de forma versionada

**Descripción:**
Generar migración Alembic que crea la tabla `invoices` con todos sus campos, FKs, índices y constraints.

**Criterios de Aceptación:**

1. **Nombre de Migración:**
   - ✅ `20260106_1000-add_invoices_table.py`

2. **Método upgrade():**
   - ✅ Crea tabla `invoices` con todas las columnas
   - ✅ FK a `tenants.id` (ondelete='CASCADE')
   - ✅ FK a `orders.id` (ondelete='CASCADE')
   - ✅ FK auto-referencia a `invoices.id` (ondelete='SET NULL')
   - ✅ Crea índices: tenant_id, order_id, efact_ticket (unique), efact_status
   - ✅ Crea índice compuesto: (order_id, invoice_type)
   - ✅ Crea constraint UNIQUE: (tenant_id, serie, correlativo)

3. **Método downgrade():**
   - ✅ Elimina tabla `invoices`

**Archivos Afectados:**
- `apps/backend/alembic/versions/20260106_1000-add_invoices_table.py` (CREAR)

---

#### **US-007: Crear Migración para Tabla Invoice Series**

**Como** desarrollador del sistema
**Quiero** crear una migración Alembic para la tabla `invoice_series`
**Para** gestionar series y correlativos por tenant

**Criterios de Aceptación:**

1. **Nombre de Migración:**
   - ✅ `20260106_1010-add_invoice_series_table.py`
   - ✅ Revises: `add_invoices_table`

2. **Método upgrade():**
   - ✅ Crea tabla `invoice_series`
   - ✅ FK a `tenants.id` (ondelete='CASCADE')
   - ✅ Crea índice: `tenant_id`
   - ✅ Crea constraint UNIQUE: (tenant_id, serie)

3. **Método downgrade():**
   - ✅ Elimina tabla `invoice_series`

**Archivos Afectados:**
- `apps/backend/alembic/versions/20260106_1010-add_invoice_series_table.py` (CREAR)

---

#### **US-008: Crear Migración para Agregar efact_ruc a Tenants**

**Como** desarrollador del sistema
**Quiero** crear una migración para agregar `efact_ruc` a `tenants`
**Para** que cada tenant pueda tener su RUC de emisor

**Criterios de Aceptación:**

1. **Nombre de Migración:**
   - ✅ `20260106_1020-add_efact_ruc_to_tenants.py`
   - ✅ Revises: `add_invoice_series_table`

2. **Método upgrade():**
   - ✅ Agrega columna `efact_ruc` (String 11, NULLABLE)
   - ✅ Comment: "RUC del tenant para facturación electrónica"

3. **Método downgrade():**
   - ✅ Elimina columna `efact_ruc`

**Archivos Afectados:**
- `apps/backend/alembic/versions/20260106_1020-add_efact_ruc_to_tenants.py` (CREAR)

---

#### **US-009: Ejecutar Migraciones en Base de Datos**

**Como** desarrollador del sistema
**Quiero** aplicar las migraciones con Alembic
**Para** crear las tablas en la base de datos PostgreSQL

**Criterios de Aceptación:**

1. **Comando Ejecutado:**
   - ✅ `cd apps/backend`
   - ✅ `alembic upgrade head`

2. **Verificación:**
   - ✅ Tabla `invoices` existe con todos sus campos
   - ✅ Tabla `invoice_series` existe
   - ✅ Columna `tenants.efact_ruc` existe
   - ✅ Todos los índices y constraints están creados

---

### ÉPICA 2: Configuración de eFact

---

#### **US-010: Configurar Variables de Entorno para eFact**

**Como** administrador del sistema
**Quiero** agregar las credenciales de eFact al archivo .env
**Para** autenticar las peticiones a la API de eFact-OSE

**Descripción:**
Agregar variables de entorno necesarias para la integración con eFact.

**Criterios de Aceptación:**

1. **Variables en .env:**
   - ✅ `EFACT_BASE_URL=https://ose-gw1.efact.pe:443/api-efact-ose`
   - ✅ `EFACT_RUC_VENTIA=20551093035` (RUC de Ventia para username)
   - ✅ `EFACT_PASSWORD_REST=tu_password_rest_aqui` (Password REST de Ventia)
   - ✅ `EFACT_TOKEN_CACHE_HOURS=11` (Duración del cache de token)

2. **Variables en .env.example:**
   - ✅ Plantilla sin valores reales
   - ✅ Comentarios explicativos

3. **Nota de Autenticación:**
   - ✅ Documentar que usa `Authorization: Basic Y2xpZW50OnNlY3JldA==` (fijo)
   - ✅ Documentar que username es RUC de Ventia
   - ✅ Documentar que password es PASSWORD_REST de Ventia

**Archivos Afectados:**
- `apps/backend/.env` (MODIFICAR)
- `apps/backend/.env.example` (MODIFICAR)

---

#### **US-011: Actualizar Settings de Config con Variables eFact**

**Como** desarrollador del sistema
**Quiero** agregar los settings de eFact al archivo de configuración
**Para** que estén disponibles en toda la aplicación

**Criterios de Aceptación:**

1. **Settings Agregados en `Settings` class:**
   - ✅ `EFACT_BASE_URL: str = "https://ose-gw1.efact.pe:443/api-efact-ose"`
   - ✅ `EFACT_RUC_VENTIA: str` (requerido)
   - ✅ `EFACT_PASSWORD_REST: str` (requerido)
   - ✅ `EFACT_TOKEN_CACHE_HOURS: int = 11`

2. **Validación:**
   - ✅ Si faltan variables requeridas, la app no inicia

**Archivos Afectados:**
- `apps/backend/app/core/config.py` (MODIFICAR)

---

### ÉPICA 3: Schemas Pydantic

---

#### **US-012: Crear Schemas de Invoice**

**Como** desarrollador del sistema
**Quiero** crear schemas Pydantic para Invoice
**Para** validar requests y responses de los endpoints de facturación

**Descripción:**
Crear archivo `invoice.py` con todos los schemas necesarios para gestionar comprobantes electrónicos.

**Criterios de Aceptación:**

1. **Schemas de Invoice:**
   - ✅ `InvoiceBase`: Campos comunes (invoice_type, currency)
   - ✅ `InvoiceCreate`: Para crear comprobante (serie, invoice_type, reference_invoice_id?, reference_reason?)
   - ✅ `InvoiceUpdate`: Para actualizar (efact_status, efact_error)
   - ✅ `InvoiceResponse`: Respuesta completa con todos los campos + propiedad `full_number`
   - ✅ `InvoiceListResponse`: Lista paginada (total, items, skip, limit)

2. **Schemas de Estado:**
   - ✅ `TicketStatusResponse`: Para consulta de estado (ticket, status, message, cdr_response)

3. **Schemas de Serie:**
   - ✅ `InvoiceSerieBase`: Campos comunes
   - ✅ `InvoiceSerieCreate`: Para crear serie
   - ✅ `InvoiceSerieUpdate`: Para actualizar serie
   - ✅ `InvoiceSerieResponse`: Respuesta completa
   - ✅ `InvoiceSerieListResponse`: Lista

4. **Validaciones:**
   - ✅ `invoice_type`: pattern `^(01|03|07|08)$`
   - ✅ `serie`: pattern `^[A-Z0-9]{4}$`
   - ✅ `currency`: pattern `^(PEN|USD)$`
   - ✅ `efact_ruc`: pattern `^\d{11}$`

5. **Computed Fields:**
   - ✅ `InvoiceResponse.full_number` → `{serie}-{correlativo:08d}`

**Archivos Afectados:**
- `apps/backend/app/schemas/invoice.py` (CREAR)

---

#### **US-013: Actualizar Schemas de Tenant con efact_ruc**

**Como** desarrollador del sistema
**Quiero** agregar el campo `efact_ruc` a los schemas de Tenant
**Para** permitir configurar el RUC del emisor en cada tenant

**Criterios de Aceptación:**

1. **Schemas Actualizados:**
   - ✅ `TenantBase`: Agregar `efact_ruc: Optional[str]` con pattern `^\d{11}$`
   - ✅ `TenantCreate`: Agregar `efact_ruc`
   - ✅ `TenantUpdate`: Agregar `efact_ruc`
   - ✅ `TenantResponse`: Agregar `efact_ruc`

**Archivos Afectados:**
- `apps/backend/app/schemas/tenant.py` (MODIFICAR)

---

#### **US-014: Actualizar Schema de Order con Lista de Invoices**

**Como** desarrollador del sistema
**Quiero** agregar lista de invoices a `OrderResponse`
**Para** poder ver los comprobantes emitidos desde una orden

**Criterios de Aceptación:**

1. **Campo Agregado:**
   - ✅ En `OrderResponse`: `invoices: Optional[List["InvoiceResponse"]] = None`
   - ✅ Con TYPE_CHECKING para evitar import circular

2. **Comportamiento:**
   - ✅ Campo opcional (se popula solo con eager loading)
   - ✅ Permite ver histórico de comprobantes de la orden

**Archivos Afectados:**
- `apps/backend/app/schemas/order.py` (MODIFICAR)

---

#### **US-015: Actualizar __init__ de Schemas**

**Como** desarrollador del sistema
**Quiero** registrar los nuevos schemas en `__init__.py`
**Para** que estén disponibles para importar

**Criterios de Aceptación:**

1. **Imports Agregados:**
   - ✅ Todos los schemas de invoice (InvoiceCreate, InvoiceResponse, etc.)
   - ✅ Todos los schemas de invoice_serie

**Archivos Afectados:**
- `apps/backend/app/schemas/__init__.py` (MODIFICAR)

---

### ÉPICA 4: Servicio eFact (Cliente HTTP)

---

#### **US-016: Crear Cliente HTTP EFactClient con Autenticación OAuth2**

**Como** desarrollador del sistema
**Quiero** crear un cliente HTTP para eFact con autenticación OAuth2
**Para** comunicarme con la API de eFact-OSE de forma segura

**Descripción:**
Crear archivo `efact.py` con la clase `EFactClient` que maneja autenticación, envío de documentos, consulta de estado y descarga de archivos.

**Criterios de Aceptación:**

1. **Método `_get_token()`:**
   - ✅ POST a `/oauth/token`
   - ✅ Header: `Authorization: Basic Y2xpZW50OnNlY3JldA==` (fijo, Base64 de "client:secret")
   - ✅ Header: `Content-Type: application/x-www-form-urlencoded`
   - ✅ Body: `username={EFACT_RUC_VENTIA}&password={EFACT_PASSWORD_REST}&grant_type=password`
   - ✅ Cachear token en variable global `_token_cache` con `expires_at`
   - ✅ Renovar automáticamente si token expiró
   - ✅ Raise `EFactAuthError` si falla

2. **Método `send_document(json_ubl)`:**
   - ✅ POST a `/v1/document`
   - ✅ Header: `Authorization: Bearer {token}`
   - ✅ Header: `Content-Type: application/json`
   - ✅ Body: JSON-UBL completo
   - ✅ Retorna: `{"ticket": "ABC123", "status": "processing"}`
   - ✅ Raise `EFactError` si falla

3. **Método `get_document_status(ticket)`:**
   - ✅ GET a `/v1/document/{ticket}`
   - ✅ Retorna según status code:
     - 202: `{"status": "processing"}`
     - 200: `{"status": "success", "cdr": {...}}`
     - 412: `{"status": "error", "error": {...}}`
   - ✅ Raise `EFactError` si otro status code

4. **Método `download_pdf(ticket)`:**
   - ✅ GET a `/v1/pdf/{ticket}`
   - ✅ Retorna: `bytes` del PDF
   - ✅ Timeout: 30 segundos

5. **Método `download_xml(ticket)`:**
   - ✅ GET a `/v1/xml/{ticket}`
   - ✅ Retorna: `bytes` del XML
   - ✅ Timeout: 30 segundos

6. **Excepciones Personalizadas:**
   - ✅ `class EFactError(Exception): pass`
   - ✅ `class EFactAuthError(EFactError): pass`

7. **Singleton:**
   - ✅ `efact_client = EFactClient()`

**Archivos Afectados:**
- `apps/backend/app/services/efact.py` (CREAR - Parte 1)

---

#### **US-017: Crear Generador de JSON-UBL 2.1**

**Como** desarrollador del sistema
**Quiero** una función que genere JSON-UBL 2.1 completo según especificación eFact
**Para** enviar comprobantes electrónicos válidos a SUNAT

**Descripción:**
Agregar función `generate_json_ubl()` en `efact.py` que convierte datos del comprobante al formato JSON-UBL 2.1 requerido por eFact.

**Criterios de Aceptación:**

1. **Firma de Función:**
   ```python
   def generate_json_ubl(
       invoice_type: str,
       serie: str,
       correlativo: int,
       fecha_emision: datetime,
       emisor_ruc: str,
       emisor_razon_social: str,
       cliente_tipo_doc: str,
       cliente_numero_doc: str,
       cliente_razon_social: str,
       currency: str,
       items: list,
       subtotal: float,
       igv: float,
       total: float,
       reference_type: Optional[str] = None,
       reference_serie: Optional[str] = None,
       reference_correlativo: Optional[int] = None,
       reference_reason: Optional[str] = None,
   ) -> Dict[str, Any]
   ```

2. **Estructura JSON-UBL Generada:**
   - ✅ Campos: `tipoDocumento`, `serie`, `correlativo`, `numeroDocumento`
   - ✅ Fechas: `fechaEmision` (YYYY-MM-DD), `horaEmision` (HH:MM:SS)
   - ✅ Moneda: `tipoMoneda` (PEN, USD)
   - ✅ Emisor: `emisor.numeroDocumento`, `emisor.razonSocial`, `emisor.tipoDocumento="6"`
   - ✅ Cliente: `cliente.numeroDocumento`, `cliente.razonSocial`, `cliente.tipoDocumento`
   - ✅ Items: Lista con código, descripción, cantidad, unidadMedida, precioUnitario, valorVenta, igv, total
   - ✅ Totales: `totalValorVenta`, `totalIgv`, `importeTotal`
   - ✅ Leyendas: Monto en letras (código "1000")
   - ✅ Referencias: `documentosRelacionados` para NC/ND

3. **Validaciones:**
   - ✅ Items no vacío
   - ✅ Totales cuadran: `total = subtotal + igv`
   - ✅ Para NC/ND: requiere reference_type, reference_serie, reference_correlativo

**Archivos Afectados:**
- `apps/backend/app/services/efact.py` (CREAR - Parte 2)

---

#### **US-018: Crear Función para Convertir Número a Letras**

**Como** desarrollador del sistema
**Quiero** una función que convierta números a letras según reglas SUNAT
**Para** cumplir con el requisito de incluir monto en letras en los comprobantes

**Descripción:**
Agregar función `numero_a_letras()` en `efact.py` que convierte un número decimal a su representación en letras según normativa SUNAT.

**Criterios de Aceptación:**

1. **Firma de Función:**
   ```python
   def numero_a_letras(numero: float, moneda: str = "PEN") -> str
   ```

2. **Formato de Salida:**
   - ✅ `150.50, "PEN"` → `"CIENTO CINCUENTA CON 50/100 SOLES"`
   - ✅ `1000.00, "USD"` → `"UN MIL CON 00/100 DÓLARES AMERICANOS"`
   - ✅ `25.75, "PEN"` → `"VEINTICINCO CON 75/100 SOLES"`

3. **Reglas de Conversión:**
   - ✅ Unidades, decenas, centenas, miles correctamente
   - ✅ Casos especiales: 100="CIEN", 10-19 tienen nombres propios
   - ✅ Formato decimal siempre 2 dígitos: "XX/100"
   - ✅ Plural: "SOLES" vs "SOL", "DÓLARES" vs "DÓLAR"

**Archivos Afectados:**
- `apps/backend/app/services/efact.py` (CREAR - Parte 3)

---

#### **US-019: Crear Funciones de Validación de Documentos**

**Como** desarrollador del sistema
**Quiero** funciones para validar RUC y DNI
**Para** asegurar que los documentos de clientes son válidos antes de emitir comprobantes

**Criterios de Aceptación:**

1. **Función `validar_ruc(ruc: str) -> bool`:**
   - ✅ Valida que sea string de 11 dígitos numéricos
   - ✅ Retorna True si válido, False si inválido

2. **Función `validar_dni(dni: str) -> bool`:**
   - ✅ Valida que sea string de 8 dígitos numéricos
   - ✅ Retorna True si válido, False si inválido

**Archivos Afectados:**
- `apps/backend/app/services/efact.py` (CREAR - Parte 4)

---

### ÉPICA 5: Repositories

---

#### **US-020: Crear InvoiceRepository con Métodos de Consulta**

**Como** desarrollador del sistema
**Quiero** crear el repository de Invoice
**Para** encapsular lógica de acceso a datos de comprobantes

**Descripción:**
Crear `invoice.py` con `InvoiceRepository` que hereda de `CRUDBase`.

**Criterios de Aceptación:**

1. **Métodos Implementados:**
   - ✅ `get_by_order(db, order_id)`: Retorna lista de invoices de una orden
   - ✅ `get_by_tenant(db, tenant_id, skip, limit)`: Lista paginada por tenant
   - ✅ `count_by_tenant(db, tenant_id)`: Total de invoices del tenant
   - ✅ `get_by_ticket(db, ticket)`: Buscar invoice por ticket de eFact
   - ✅ `get_pending_processing(db, tenant_id?, limit)`: Invoices con status "pending" o "processing" (para polling)

2. **Ordenamiento:**
   - ✅ `get_by_tenant` ordena por `created_at DESC`

3. **Singleton:**
   - ✅ `invoice_repository = InvoiceRepository(Invoice)`

**Archivos Afectados:**
- `apps/backend/app/repositories/invoice.py` (CREAR)

---

#### **US-021: Crear InvoiceSerieRepository con Método Thread-Safe**

**Como** desarrollador del sistema
**Quiero** crear el repository de InvoiceSerie con obtención atómica de correlativos
**Para** evitar race conditions en concurrencia

**Descripción:**
Crear `invoice_serie.py` con `InvoiceSerieRepository` que incluye método `get_next_correlative()` con SELECT FOR UPDATE.

**Criterios de Aceptación:**

1. **Métodos Básicos:**
   - ✅ `get_by_serie(db, tenant_id, serie)`: Buscar serie específica
   - ✅ `get_active_by_type(db, tenant_id, invoice_type)`: Series activas por tipo

2. **Método Crítico `get_next_correlative(db, tenant_id, serie)`:**
   - ✅ Usa `with_for_update()` para lock pessimista
   - ✅ Incrementa `last_correlativo` en 1
   - ✅ Hace commit inmediato
   - ✅ Retorna el nuevo correlativo
   - ✅ Raise `ValueError` si serie no existe
   - ✅ Raise `ValueError` si serie está inactiva

3. **Thread-Safety:**
   - ✅ Dos requests concurrentes NO obtienen el mismo correlativo
   - ✅ Lock se libera después del commit

4. **Singleton:**
   - ✅ `invoice_serie_repository = InvoiceSerieRepository(InvoiceSerie)`

**Archivos Afectados:**
- `apps/backend/app/repositories/invoice_serie.py` (CREAR)

---

#### **US-022: Actualizar __init__ de Repositories**

**Como** desarrollador del sistema
**Quiero** registrar los nuevos repositories en `__init__.py`
**Para** que estén disponibles para importar

**Criterios de Aceptación:**

1. **Imports Agregados:**
   - ✅ `from app.repositories.invoice import invoice_repository`
   - ✅ `from app.repositories.invoice_serie import invoice_serie_repository`

**Archivos Afectados:**
- `apps/backend/app/repositories/__init__.py` (MODIFICAR)

---

### ÉPICA 6: Servicios de Negocio

---

#### **US-023: Crear InvoiceService con Lógica de Creación de Comprobantes**

**Como** desarrollador del sistema
**Quiero** crear el servicio de negocio InvoiceService
**Para** encapsular toda la lógica de generación y gestión de comprobantes

**Descripción:**
Crear `invoice.py` con `InvoiceService` que maneja el flujo completo de creación de comprobantes.

**Criterios de Aceptación:**

1. **Método `create_invoice(db, order_id, tenant_id, invoice_data)`:**

   **Validaciones Iniciales:**
   - ✅ Order existe y pertenece al tenant
   - ✅ Order tiene `validado=True`
   - ✅ Order tiene `customer_document_type` y `customer_document_number`
   - ✅ Tenant existe y tiene `efact_ruc` configurado
   - ✅ RUC del tenant es válido (11 dígitos)
   - ✅ Documento del cliente es válido (DNI=8 dígitos, RUC=11)
   - ✅ Coherencia: Factura (01) requiere cliente con RUC
   - ✅ Serie existe y está activa

   **Obtención de Correlativo:**
   - ✅ Llama a `invoice_serie_repository.get_next_correlative()` (thread-safe)
   - ✅ Maneja `ValueError` si serie no existe o está inactiva

   **Cálculo de Totales:**
   - ✅ Itera sobre `order.line_items`
   - ✅ Calcula por cada item:
     - `item_subtotal = quantity * unit_price`
     - `item_igv = item_subtotal * 0.18`
     - `item_total = item_subtotal + item_igv`
   - ✅ Calcula totales generales:
     - `subtotal = sum(item_subtotal)`
     - `igv = subtotal * 0.18`
     - `total = subtotal + igv`
   - ✅ Redondea a 2 decimales

   **Manejo de Referencias (NC/ND):**
   - ✅ Si `invoice_type` es "07" o "08":
     - Requiere `reference_invoice_id`
     - Obtiene invoice referenciado
     - Valida que pertenece al mismo tenant
     - Extrae `reference_type`, `reference_serie`, `reference_correlativo`

   **Creación de Invoice:**
   - ✅ Crea registro `Invoice` en DB con todos los campos
   - ✅ Status inicial: "pending"
   - ✅ Commit y refresh

   **Generación de JSON-UBL:**
   - ✅ Llama a `generate_json_ubl()` con todos los datos
   - ✅ Maneja excepciones, actualiza invoice con error si falla

   **Envío a eFact:**
   - ✅ Llama a `efact_client.send_document(json_ubl)`
   - ✅ Extrae ticket de respuesta
   - ✅ Actualiza invoice con:
     - `efact_ticket = ticket`
     - `efact_status = "processing"`
     - `efact_sent_at = datetime.utcnow()`
   - ✅ Commit
   - ✅ Maneja excepciones, actualiza con error si falla

   **Retorno:**
   - ✅ Retorna `Invoice` creado

2. **Método `check_invoice_status(db, invoice_id, tenant_id)`:**
   - ✅ Obtiene invoice por ID
   - ✅ Valida que pertenece al tenant
   - ✅ Valida que tiene `efact_ticket`
   - ✅ Si ya tiene status="success", retorna sin consultar
   - ✅ Llama a `efact_client.get_document_status(ticket)`
   - ✅ Actualiza invoice según respuesta:
     - "processing" → `efact_status = "processing"`
     - "success" → `efact_status = "success"`, `efact_response = cdr`, `efact_processed_at = now()`
     - "error" → `efact_status = "error"`, `efact_error = message`
   - ✅ Commit
   - ✅ Retorna invoice actualizado

3. **Método `get_invoices_by_order(db, order_id, tenant_id)`:**
   - ✅ Llama a `invoice_repository.get_by_order()`
   - ✅ Valida que todos pertenecen al tenant
   - ✅ Retorna lista

4. **Método `get_invoices_by_tenant(db, tenant_id, skip, limit)`:**
   - ✅ Llama a `invoice_repository.get_by_tenant()` y `count_by_tenant()`
   - ✅ Retorna `InvoiceListResponse`

5. **Singleton:**
   - ✅ `invoice_service = InvoiceService()`

**Archivos Afectados:**
- `apps/backend/app/services/invoice.py` (CREAR)

---

#### **US-024: Crear InvoiceSerieService**

**Como** desarrollador del sistema
**Quiero** crear el servicio de negocio InvoiceSerieService
**Para** gestionar creación y actualización de series

**Criterios de Aceptación:**

1. **Método `create_serie(db, tenant_id, serie_data)`:**
   - ✅ Valida que serie no existe ya para ese tenant
   - ✅ Llama a `invoice_serie_repository.create()`
   - ✅ Retorna serie creada

2. **Método `get_series_by_tenant(db, tenant_id)`:**
   - ✅ Lista todas las series del tenant
   - ✅ Retorna lista

3. **Método `update_serie(db, serie_id, tenant_id, serie_data)`:**
   - ✅ Valida que serie existe y pertenece al tenant
   - ✅ Actualiza serie
   - ✅ Retorna serie actualizada

4. **Singleton:**
   - ✅ `invoice_serie_service = InvoiceSerieService()`

**Archivos Afectados:**
- `apps/backend/app/services/invoice_serie.py` (CREAR)

---

#### **US-025: Actualizar __init__ de Services**

**Como** desarrollador del sistema
**Quiero** registrar los nuevos servicios en `__init__.py`
**Para** que estén disponibles para importar

**Criterios de Aceptación:**

1. **Imports Agregados:**
   - ✅ `from app.services.invoice import invoice_service`
   - ✅ `from app.services.invoice_serie import invoice_serie_service`
   - ✅ `from app.services.efact import efact_client`

**Archivos Afectados:**
- `apps/backend/app/services/__init__.py` (MODIFICAR)

---

### ÉPICA 7: Endpoints API

---

#### **US-026: Crear Endpoint para Generar Comprobante**

**Como** usuario con rol ADMIN o LOGISTICA
**Quiero** un endpoint para generar comprobantes electrónicos desde una orden
**Para** emitir facturas y boletas para mis clientes

**Descripción:**
Crear endpoint `POST /orders/{order_id}/invoice` que genera un comprobante electrónico.

**Criterios de Aceptación:**

1. **Ruta:** `POST /orders/{order_id}/invoice`

2. **Request:**
   - Path param: `order_id` (int)
   - Body: `InvoiceCreate`
     ```json
     {
       "invoice_type": "03",
       "serie": "B001",
       "reference_invoice_id": null,
       "reference_reason": null
     }
     ```

3. **Autenticación:**
   - ✅ Requiere `require_role(Role.ADMIN, Role.LOGISTICA)`
   - ✅ Usa `tenant_id` del usuario autenticado

4. **Proceso:**
   - ✅ Llama a `invoice_service.create_invoice()`
   - ✅ Maneja `ValueError` → 400 Bad Request
   - ✅ Maneja otras excepciones → 500 Internal Server Error

5. **Response:**
   - ✅ Status: 200 OK
   - ✅ Body: `InvoiceResponse` con `efact_status="processing"` y `efact_ticket`

**Archivos Afectados:**
- `apps/backend/app/api/v1/endpoints/invoices.py` (CREAR - Parte 1)

---

#### **US-027: Crear Endpoint para Listar Comprobantes de una Orden**

**Como** usuario autenticado
**Quiero** listar todos los comprobantes de una orden
**Para** ver el histórico de facturación

**Criterios de Aceptación:**

1. **Ruta:** `GET /orders/{order_id}/invoices`

2. **Autenticación:**
   - ✅ Requiere `get_current_user` (todos los roles)
   - ✅ Verifica que order pertenece al tenant del usuario

3. **Response:**
   - ✅ Status: 200 OK
   - ✅ Body: `list[InvoiceResponse]`

**Archivos Afectados:**
- `apps/backend/app/api/v1/endpoints/invoices.py` (CREAR - Parte 2)

---

#### **US-028: Crear Endpoint para Consultar Estado del Comprobante**

**Como** usuario autenticado
**Quiero** consultar el estado de un comprobante en eFact
**Para** saber si ya fue validado por SUNAT

**Criterios de Aceptación:**

1. **Ruta:** `GET /invoices/{invoice_id}/status`

2. **Proceso:**
   - ✅ Llama a `invoice_service.check_invoice_status()`
   - ✅ Consulta eFact y actualiza DB
   - ✅ Retorna invoice actualizado

3. **Response:**
   - ✅ Status: 200 OK
   - ✅ Body: `InvoiceResponse` con `efact_status` actualizado

**Archivos Afectados:**
- `apps/backend/app/api/v1/endpoints/invoices.py` (CREAR - Parte 3)

---

#### **US-029: Crear Endpoint para Descargar PDF del Comprobante**

**Como** usuario autenticado
**Quiero** descargar el PDF de un comprobante
**Para** enviarlo a mi cliente

**Descripción:**
Endpoint que hace proxy a eFact para descargar el PDF sin almacenarlo localmente.

**Criterios de Aceptación:**

1. **Ruta:** `GET /invoices/{invoice_id}/pdf`

2. **Validaciones:**
   - ✅ Invoice existe y pertenece al tenant
   - ✅ Invoice tiene `efact_ticket`
   - ✅ Invoice tiene `efact_status="success"`

3. **Proceso:**
   - ✅ Llama a `efact_client.download_pdf(ticket)`
   - ✅ Retorna bytes del PDF con headers:
     - `Content-Type: application/pdf`
     - `Content-Disposition: attachment; filename={serie}-{correlativo}.pdf`

4. **Response:**
   - ✅ Status: 200 OK
   - ✅ Body: Bytes del PDF

**Archivos Afectados:**
- `apps/backend/app/api/v1/endpoints/invoices.py` (CREAR - Parte 4)

---

#### **US-030: Crear Endpoint para Descargar XML del Comprobante**

**Como** usuario autenticado
**Quiero** descargar el XML firmado de un comprobante
**Para** conservarlo como respaldo legal obligatorio

**Criterios de Aceptación:**

1. **Ruta:** `GET /invoices/{invoice_id}/xml`

2. **Validaciones:** (iguales a PDF)
   - ✅ Invoice existe y pertenece al tenant
   - ✅ Tiene ticket y status="success"

3. **Proceso:**
   - ✅ Llama a `efact_client.download_xml(ticket)`
   - ✅ Retorna bytes del XML

4. **Response:**
   - ✅ Status: 200 OK
   - ✅ Content-Type: `application/xml`
   - ✅ Filename: `{serie}-{correlativo}.xml`

**Archivos Afectados:**
- `apps/backend/app/api/v1/endpoints/invoices.py` (CREAR - Parte 5)

---

#### **US-031: Crear Endpoint para Listar Comprobantes del Tenant**

**Como** usuario autenticado
**Quiero** listar todos los comprobantes de mi tenant con paginación
**Para** tener un reporte de facturación

**Criterios de Aceptación:**

1. **Ruta:** `GET /invoices`

2. **Query Params:**
   - ✅ `skip` (int, default=0)
   - ✅ `limit` (int, default=100)

3. **Response:**
   - ✅ Status: 200 OK
   - ✅ Body: `InvoiceListResponse` con total, items, skip, limit

**Archivos Afectados:**
- `apps/backend/app/api/v1/endpoints/invoices.py` (CREAR - Parte 6)

---

#### **US-032: Crear Endpoint para Crear Serie de Comprobantes**

**Como** usuario con rol ADMIN
**Quiero** crear series de comprobantes para mi tenant
**Para** poder emitir facturas y boletas con diferentes numeraciones

**Criterios de Aceptación:**

1. **Ruta:** `POST /tenants/series`

2. **Request:**
   - Body: `InvoiceSerieCreate`
     ```json
     {
       "invoice_type": "01",
       "serie": "F001",
       "description": "Facturas principales"
     }
     ```

3. **Autenticación:**
   - ✅ Requiere `require_role(Role.ADMIN)`

4. **Validaciones:**
   - ✅ Serie no existe ya para el tenant
   - ✅ Formato de serie: 4 caracteres alfanuméricos

5. **Response:**
   - ✅ Status: 200 OK
   - ✅ Body: `InvoiceSerieResponse`

**Archivos Afectados:**
- `apps/backend/app/api/v1/endpoints/invoices.py` (CREAR - Parte 7)

---

#### **US-033: Crear Endpoint para Listar Series del Tenant**

**Como** usuario autenticado
**Quiero** listar todas las series de mi tenant
**Para** saber qué series tengo disponibles para facturar

**Criterios de Aceptación:**

1. **Ruta:** `GET /tenants/series`

2. **Response:**
   - ✅ Status: 200 OK
   - ✅ Body: `list[InvoiceSerieResponse]`

**Archivos Afectados:**
- `apps/backend/app/api/v1/endpoints/invoices.py` (CREAR - Parte 8)

---

#### **US-034: Registrar Router de Invoices**

**Como** desarrollador del sistema
**Quiero** registrar el router de invoices en el router principal
**Para** que los endpoints estén disponibles

**Criterios de Aceptación:**

1. **Import Agregado:**
   - ✅ `from app.api.v1.endpoints import invoices`

2. **Router Registrado:**
   - ✅ `api_router.include_router(invoices.router, tags=["invoices"])`

**Archivos Afectados:**
- `apps/backend/app/api/v1/endpoints/__init__.py` (MODIFICAR)

---

### ÉPICA 8: Testing y Validación

---

#### **US-035: Crear Script de Testing de Integración eFact**

**Como** desarrollador del sistema
**Quiero** un script para probar la integración con eFact
**Para** validar autenticación, generación JSON-UBL y conversión a letras

**Descripción:**
Crear script Python que prueba componentes críticos del servicio eFact.

**Criterios de Aceptación:**

1. **Tests Implementados:**
   - ✅ `test_auth()`: Prueba autenticación OAuth2, obtiene token
   - ✅ `test_numero_a_letras()`: Valida conversión de números a letras
   - ✅ `test_json_ubl_generation()`: Genera JSON-UBL de ejemplo y valida estructura

2. **Ejecución:**
   - ✅ Script ejecutable: `python scripts/test_efact_integration.py`
   - ✅ Output claro: ✓ para éxito, ✗ para fallo

3. **Reporte Final:**
   - ✅ Muestra resumen: "ALL TESTS PASSED" o "SOME TESTS FAILED"

**Archivos Afectados:**
- `apps/backend/scripts/test_efact_integration.py` (CREAR)

---

#### **US-036: Testing Manual con Postman/Thunder Client**

**Como** QA o desarrollador
**Quiero** probar el flujo completo de facturación manualmente
**Para** validar que todo funciona end-to-end

**Descripción:**
Ejecutar flujo completo de facturación usando cliente HTTP.

**Criterios de Aceptación:**

1. **Paso 1: Configurar Tenant**
   - ✅ `PATCH /api/v1/tenants/{id}`
   - ✅ Body: `{"efact_ruc": "20123456789"}`
   - ✅ Response 200 OK

2. **Paso 2: Crear Serie**
   - ✅ `POST /api/v1/tenants/series`
   - ✅ Body: `{"invoice_type": "03", "serie": "B001"}`
   - ✅ Response 200 OK con serie creada

3. **Paso 3: Generar Comprobante**
   - ✅ `POST /api/v1/orders/{id}/invoice`
   - ✅ Body: `{"invoice_type": "03", "serie": "B001"}`
   - ✅ Response 200 OK con ticket y status="processing"

4. **Paso 4: Consultar Estado** (repetir hasta success)
   - ✅ `GET /api/v1/invoices/{id}/status`
   - ✅ Primera vez: status="processing"
   - ✅ Después de ~5 segundos: status="success"

5. **Paso 5: Descargar PDF**
   - ✅ `GET /api/v1/invoices/{id}/pdf`
   - ✅ Response 200 OK con PDF válido

**Evidencias:**
- ✅ Screenshots de requests/responses exitosos
- ✅ PDF descargado y validado visualmente

---

### ÉPICA 9: Documentación

---

#### **US-037: Crear Documentación de Facturación Electrónica**

**Como** nuevo desarrollador o administrador
**Quiero** documentación clara del módulo de facturación
**Para** entender cómo configurar y usar el sistema

**Descripción:**
Crear archivo Markdown con guía completa de facturación.

**Criterios de Aceptación:**

1. **Secciones del Documento:**
   - ✅ **Configuración Inicial:**
     - Variables .env requeridas
     - Cómo configurar RUC del tenant
     - Cómo crear series de comprobantes
   - ✅ **Flujo de Facturación:**
     - Paso a paso para generar comprobante
     - Consultar estado
     - Descargar PDF/XML
   - ✅ **Tipos de Comprobantes:**
     - Factura (01): Descripción, requisitos, serie sugerida
     - Boleta (03): Descripción, requisitos, serie sugerida
     - Nota de Crédito (07): Descripción, uso
     - Nota de Débito (08): Descripción, uso
   - ✅ **Consideraciones:**
     - Orden debe estar validada
     - Orden debe tener documento
     - Tenant debe tener RUC
     - Serie debe existir
     - Correlativos son automáticos
   - ✅ **Troubleshooting:**
     - Errores comunes y soluciones

2. **Ejemplos de Código:**
   - ✅ Requests cURL o JSON
   - ✅ Responses de ejemplo

**Archivos Afectados:**
- `apps/backend/docs/INVOICING.md` (CREAR)

---

## 📊 Resumen del Proyecto

### Estadísticas

- **Nuevas Tablas:** 2 (invoices, invoice_series)
- **Nuevos Archivos:** 14
- **Archivos Modificados:** 12
- **Migraciones Alembic:** 3
- **Endpoints REST:** 8
- **Servicios:** 3
- **Historias de Usuario:** 37

### Archivos a Crear (14)

1. `apps/backend/app/models/invoice.py`
2. `apps/backend/app/models/invoice_serie.py`
3. `apps/backend/alembic/versions/20260106_1000-add_invoices_table.py`
4. `apps/backend/alembic/versions/20260106_1010-add_invoice_series_table.py`
5. `apps/backend/alembic/versions/20260106_1020-add_efact_ruc_to_tenants.py`
6. `apps/backend/app/schemas/invoice.py`
7. `apps/backend/app/services/efact.py`
8. `apps/backend/app/repositories/invoice.py`
9. `apps/backend/app/repositories/invoice_serie.py`
10. `apps/backend/app/services/invoice.py`
11. `apps/backend/app/services/invoice_serie.py`
12. `apps/backend/app/api/v1/endpoints/invoices.py`
13. `apps/backend/docs/INVOICING.md`
14. `apps/backend/scripts/test_efact_integration.py`

### Archivos a Modificar (12)

1. `apps/backend/app/models/tenant.py`
2. `apps/backend/app/models/order.py`
3. `apps/backend/app/models/__init__.py`
4. `apps/backend/app/schemas/tenant.py`
5. `apps/backend/app/schemas/order.py`
6. `apps/backend/app/schemas/__init__.py`
7. `apps/backend/app/repositories/__init__.py`
8. `apps/backend/app/services/__init__.py`
9. `apps/backend/app/api/v1/endpoints/__init__.py`
10. `apps/backend/app/core/config.py`
11. `apps/backend/.env`
12. `apps/backend/.env.example`

---

## ✅ Checklist General de Implementación

### Épica 1: Base de Datos (9 historias)
- [ ] US-001: Modelo Invoice
- [ ] US-002: Modelo InvoiceSerie
- [ ] US-003: Actualizar Tenant
- [ ] US-004: Actualizar Order
- [ ] US-005: Actualizar __init__ modelos
- [ ] US-006: Migración invoices
- [ ] US-007: Migración invoice_series
- [ ] US-008: Migración efact_ruc
- [ ] US-009: Ejecutar migraciones

### Épica 2: Configuración (2 historias)
- [ ] US-010: Variables .env
- [ ] US-011: Config.py

### Épica 3: Schemas (4 historias)
- [ ] US-012: Schemas Invoice
- [ ] US-013: Schemas Tenant
- [ ] US-014: Schemas Order
- [ ] US-015: __init__ schemas

### Épica 4: Servicio eFact (4 historias)
- [ ] US-016: Cliente HTTP EFactClient
- [ ] US-017: Generador JSON-UBL
- [ ] US-018: Número a letras
- [ ] US-019: Validaciones documentos

### Épica 5: Repositories (3 historias)
- [ ] US-020: InvoiceRepository
- [ ] US-021: InvoiceSerieRepository
- [ ] US-022: __init__ repositories

### Épica 6: Servicios de Negocio (3 historias)
- [ ] US-023: InvoiceService
- [ ] US-024: InvoiceSerieService
- [ ] US-025: __init__ services

### Épica 7: Endpoints (9 historias)
- [ ] US-026: POST /orders/{id}/invoice
- [ ] US-027: GET /orders/{id}/invoices
- [ ] US-028: GET /invoices/{id}/status
- [ ] US-029: GET /invoices/{id}/pdf
- [ ] US-030: GET /invoices/{id}/xml
- [ ] US-031: GET /invoices
- [ ] US-032: POST /tenants/series
- [ ] US-033: GET /tenants/series
- [ ] US-034: Registrar router

### Épica 8: Testing (2 historias)
- [ ] US-035: Script de testing
- [ ] US-036: Testing manual

### Épica 9: Documentación (1 historia)
- [ ] US-037: INVOICING.md

---

## 🎯 Próximos Pasos (Post-Implementación)

1. **Polling Automático (Opcional):**
   - Background task que consulta invoices con status="processing"
   - Actualiza automáticamente cuando estén listos

2. **WebSockets/SSE (Opcional):**
   - Notificar al frontend en tiempo real

3. **Frontend (Fase 2):**
   - UI para generar comprobantes
   - Dashboard de facturación

4. **Reportes (Futuro):**
   - Métricas de facturación
   - Exportación a Excel
