# Plan de Mejoras - Sistema de Facturación

## Resumen

Este documento contiene las historias de usuario para corregir inconsistencias y mejorar el sistema de facturación del proyecto Ventia.

---

## EPIC 1: Datos del Emisor Dinámicos

### HU-001: Agregar campos de ubicación del emisor al modelo Tenant

**Etiqueta:** `backend`

**Descripción:**
Como administrador del sistema, necesito que los datos de ubicación del emisor (ubigeo, departamento, provincia, distrito, dirección, nombre comercial) se almacenen en el tenant para que los comprobantes electrónicos se emitan con la información real de la empresa.

**Criterios de Aceptación:**
- [ ] Se agregan las siguientes columnas al modelo `Tenant`:
  - `emisor_nombre_comercial` (VARCHAR 200, nullable)
  - `emisor_ubigeo` (VARCHAR 6, default "150101")
  - `emisor_departamento` (VARCHAR 100, default "LIMA")
  - `emisor_provincia` (VARCHAR 100, default "LIMA")
  - `emisor_distrito` (VARCHAR 100, default "LIMA")
  - `emisor_direccion` (VARCHAR 500, nullable)
- [ ] Se crea la migración correspondiente con Alembic
- [ ] Los valores existentes mantienen los defaults (Lima)

---

### HU-002: Utilizar datos del emisor desde Tenant en generación de comprobantes

**Etiqueta:** `backend`

**Descripción:**
Como sistema, necesito que al generar un comprobante electrónico se utilicen los datos de ubicación del emisor almacenados en el tenant en lugar de valores hardcodeados.

**Criterios de Aceptación:**
- [ ] La función `generate_json_ubl()` recibe los datos de ubicación del tenant
- [ ] El servicio `create_invoice()` obtiene los datos de ubicación del tenant y los pasa a `generate_json_ubl()`
- [ ] Si algún campo está vacío, se usa el default configurado
- [ ] Los comprobantes generados contienen la información real del emisor

---

## EPIC 2: Reorganización de Navegación y Configuración

### HU-003: Crear sección de Configuración en el sidebar con Series y API Keys

**Etiqueta:** `frontend`

**Descripción:**
Como usuario, necesito tener una sección de "Configuración" en el sidebar del dashboard que agrupe las opciones de configuración como Series de facturación y Credenciales API Key para una navegación más organizada.

**Criterios de Aceptación:**
- [ ] Se agrega sección "Configuración" en el sidebar debajo de "Plataforma"
- [ ] Dentro de Configuración se incluye:
  - Series de facturación (movido desde página de invoices)
  - Credenciales API Key (movido desde dropdown del perfil)
- [ ] El botón "Series" se elimina del header de la página de facturación
- [ ] La opción "Credenciales (API Key)" se elimina del dropdown del perfil
- [ ] La navegación mantiene el estado activo correcto

---

## EPIC 3: Mejoras en Descarga de Comprobantes

### HU-004: Implementar descarga de PDF de comprobantes

**Etiqueta:** `frontend`

**Descripción:**
Como usuario, necesito poder descargar el PDF de un comprobante validado para poder tener una copia del documento electrónico.

**Criterios de Aceptación:**
- [ ] El botón "Descargar PDF" llama al endpoint `/api/invoices/{id}/pdf` correctamente
- [ ] Se muestra un loader mientras se descarga el archivo
- [ ] El archivo se descarga con nombre: `{serie}-{correlativo}.pdf`
- [ ] Se muestra mensaje de error si la descarga falla
- [ ] Solo disponible para comprobantes con estado "success"

---

### HU-005: Implementar descarga de XML de comprobantes

**Etiqueta:** `frontend`

**Descripción:**
Como usuario, necesito poder descargar el XML de un comprobante validado para poder tener el archivo electrónico firmado.

**Criterios de Aceptación:**
- [ ] El botón "Descargar XML" llama al endpoint `/api/invoices/{id}/xml` correctamente
- [ ] Se muestra un loader mientras se descarga el archivo
- [ ] El archivo se descarga con nombre: `{serie}-{correlativo}.xml`
- [ ] Se muestra mensaje de error si la descarga falla
- [ ] Solo disponible para comprobantes con estado "success"

---

## EPIC 4: Mejoras en Creación de Comprobante desde Pedidos

### HU-006: Permitir editar datos del cliente al crear comprobante (Frontend)

**Etiqueta:** `frontend`

**Descripción:**
Como usuario, necesito poder modificar el tipo de documento, número de documento y nombre del cliente al crear un comprobante para poder emitir boletas sin DNI (usando "00000000" y "NINGUNO") o corregir datos incorrectos.

**Criterios de Aceptación:**
- [ ] Los campos de cliente son editables en el formulario de crear comprobante:
  - Tipo de documento (dropdown: DNI, RUC, Sin documento)
  - Número de documento (input text)
  - Nombre/Razón social (input text)
- [ ] Los datos originales del pedido se muestran como valores por defecto
- [ ] Para boletas: Se permite seleccionar "Sin documento" que autocompleta DNI "00000000" y nombre "NINGUNO"
- [ ] Para facturas: Se valida que sea RUC con 11 dígitos
- [ ] Se envían los datos modificados al backend al crear el comprobante

---

### HU-007: Aceptar datos de cliente personalizados al crear comprobante (Backend)

**Etiqueta:** `backend`

**Descripción:**
Como sistema, necesito que el endpoint de crear invoice acepte datos de cliente personalizados en lugar de solo usar los del pedido.

**Criterios de Aceptación:**
- [ ] El endpoint `POST /orders/{orderId}/invoices` acepta campos opcionales:
  - `cliente_tipo_documento`
  - `cliente_numero_documento`
  - `cliente_razon_social`
- [ ] Si se envían estos campos, se usan en lugar de los datos del pedido
- [ ] Si no se envían, se usan los datos del pedido (comportamiento actual)
- [ ] Se valida que el tipo de documento sea consistente con el tipo de comprobante

---

### HU-008: Agregar campo de correo electrónico del cliente (Frontend)

**Etiqueta:** `frontend`

**Descripción:**
Como usuario, necesito poder ver y editar el correo electrónico del cliente al crear un comprobante para que quede registrado en la factura.

**Criterios de Aceptación:**
- [ ] Se agrega campo de correo electrónico en el formulario de crear comprobante
- [ ] El campo se pre-llena con `customer_email` del pedido (order)
- [ ] El email es editable
- [ ] Se valida formato de email válido (opcional si está vacío)
- [ ] Se envía el email al backend al crear el comprobante

---

### HU-009: Almacenar correo electrónico del cliente en Invoice (Backend)

**Etiqueta:** `backend`

**Descripción:**
Como sistema, necesito almacenar el correo electrónico del cliente en la factura para tenerlo disponible para futuros envíos por email.

**Criterios de Aceptación:**
- [ ] Se agrega columna `cliente_email` (VARCHAR 255, nullable) al modelo `Invoice`
- [ ] Se crea la migración correspondiente con Alembic
- [ ] El endpoint de crear invoice acepta el campo `cliente_email`
- [ ] Si no se envía, se usa `customer_email` del pedido por defecto
- [ ] El email se guarda en la factura creada

---

### HU-010: Mostrar detalle de productos al crear comprobante

**Etiqueta:** `frontend`

**Descripción:**
Como usuario, necesito ver el detalle de los productos (descripción, cantidad, precio unitario, subtotal) al crear un comprobante para verificar la información antes de emitir el documento.

**Criterios de Aceptación:**
- [ ] Se obtienen los productos desde `line_items` del pedido (order)
- [ ] Se muestra tabla con los items:
  - Descripción del producto
  - Cantidad
  - Precio unitario
  - Subtotal por línea
- [ ] La tabla se muestra antes de la sección de totales
- [ ] El diseño es responsive y legible
- [ ] Se muestra el total de items
- [ ] Los valores están formateados con 2 decimales y símbolo de moneda

---

## EPIC 5: Validaciones

### HU-011: Validar documento según tipo de comprobante (Frontend)

**Etiqueta:** `frontend`

**Descripción:**
Como usuario, necesito que el sistema valide en tiempo real que el tipo de documento del cliente sea válido para el tipo de comprobante seleccionado.

**Criterios de Aceptación:**
- [ ] **Factura (01):** Solo permite RUC (11 dígitos) - muestra error si no cumple
- [ ] **Boleta (03):** Permite DNI (8 dígitos), Sin documento ("00000000"), u otros
- [ ] Se muestra mensaje de error claro cuando la combinación no es válida
- [ ] El botón de crear se deshabilita si hay errores de validación

---

### HU-012: Validar documento según tipo de comprobante (Backend)

**Etiqueta:** `backend`

**Descripción:**
Como sistema, necesito validar en el backend que el tipo de documento sea consistente con el tipo de comprobante según normas SUNAT.

**Criterios de Aceptación:**
- [ ] **Factura (01):** Rechaza si no es RUC (tipo doc "6") con 11 dígitos
- [ ] **Boleta (03):** Acepta DNI, Sin documento, u otros tipos válidos SUNAT
- [ ] Retorna error 400 con mensaje claro si la validación falla

---

## Resumen de Historias

| ID | Historia | Etiqueta | Prioridad |
|----|----------|----------|-----------|
| HU-001 | Campos emisor en Tenant | `backend` | Alta |
| HU-002 | Usar datos emisor del Tenant | `backend` | Alta |
| HU-003 | Sección Configuración en sidebar | `frontend` | Media |
| HU-004 | Descarga PDF | `frontend` | Media |
| HU-005 | Descarga XML | `frontend` | Media |
| HU-006 | Editar datos cliente (FE) | `frontend` | Alta |
| HU-007 | Aceptar datos cliente (BE) | `backend` | Alta |
| HU-008 | Campo email cliente (FE) | `frontend` | Alta |
| HU-009 | Almacenar email cliente (BE) | `backend` | Alta |
| HU-010 | Mostrar detalle productos | `frontend` | Alta |
| HU-011 | Validar documento/comprobante (FE) | `frontend` | Media |
| HU-012 | Validar documento/comprobante (BE) | `backend` | Media |

---

## Dependencias

```
HU-001 → HU-002 (primero agregar campos, luego usarlos)

HU-007 → HU-006 (backend primero para que frontend pueda enviar datos)
HU-009 → HU-008 (backend primero para que frontend pueda enviar email)

HU-006 + HU-007 → HU-011 + HU-012 (primero edición, luego validación)
```

---

## Notas Técnicas

### Datos relevantes del modelo Order
- `customer_email`: Email del cliente
- `line_items`: JSON con detalle de productos (descripción, cantidad, precio)
- `customer_document_type`: Tipo de documento ("1" = DNI, "6" = RUC)
- `customer_document_number`: Número de documento
- `customer_name`: Nombre/Razón social

### Campos hardcodeados actuales en `efact_client.py`
```python
emisor_nombre_comercial: Optional[str] = None,
emisor_ubigeo: str = "150101",
emisor_departamento: str = "LIMA",
emisor_provincia: str = "LIMA",
emisor_distrito: str = "LIMA",
emisor_direccion: str = "AV. EJEMPLO 123",
```

### Tipos de documento SUNAT
- `0` o `-`: Sin documento
- `1`: DNI
- `6`: RUC
- `4`: Carnet de extranjería
- `7`: Pasaporte

### Tipos de comprobante SUNAT
- `01`: Factura Electrónica
- `03`: Boleta de Venta Electrónica
- `07`: Nota de Crédito Electrónica
- `08`: Nota de Débito Electrónica
