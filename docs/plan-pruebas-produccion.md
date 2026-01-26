# Plan de Pruebas para Primer Despliegue a Produccion - VentIA

## Resumen Ejecutivo

**Estado actual de cobertura:** ~5% (solo tests de encryption y permisos)
**Riesgo:** CRITICO - Los flujos de negocio principales no tienen tests
**Total de tests propuestos:** ~92
**Esfuerzo estimado:** ~15 dias

---

## Historias de Usuario

### Epic 1: Pruebas Unitarias de Servicios

#### US-001: Tests de Validaciones SUNAT para Facturacion
**Como** desarrollador del equipo de backend
**Quiero** tener pruebas unitarias que validen las reglas SUNAT para tipos de documento
**Para** evitar que facturas invalidas sean enviadas a eFact y rechazadas por SUNAT

**Criterios de Aceptacion:**
- [ ] Test: Factura (tipo 01) requiere cliente con RUC (tipo_documento=6) de exactamente 11 digitos
- [ ] Test: Factura con DNI en lugar de RUC debe fallar con ValueError
- [ ] Test: Boleta (tipo 03) acepta DNI de 8 digitos
- [ ] Test: Boleta acepta RUC, Carnet de Extranjeria, Pasaporte
- [ ] Test: Boleta rechaza documentos con longitud incorrecta
- [ ] Test: Nota de Credito (tipo 07) requiere reference_invoice_id valido
- [ ] Test: Nota de Debito (tipo 08) requiere reference_invoice_id valido
- [ ] Test: NC/ND sin referencia debe fallar con ValueError
- [ ] Test: Calculo de IGV correcto (subtotal = total / 1.18)
- [ ] Test: IGV + subtotal = total (precision de 2 decimales)

**Archivos a modificar:**
- `apps/backend/tests/unit/services/test_invoice_service.py` (crear)

**Estimacion:** 3 puntos | **Prioridad:** CRITICA | **Bloqueante:** SI

---

#### US-002: Tests de Deteccion de Ordenes Duplicadas
**Como** desarrollador del equipo de backend
**Quiero** tener pruebas que validen la deteccion de ordenes duplicadas
**Para** prevenir doble cobro o doble envio a clientes

**Criterios de Aceptacion:**
- [ ] Test: Crear orden con shopify_draft_order_id existente para mismo tenant falla
- [ ] Test: Crear orden con woocommerce_order_id existente para mismo tenant falla
- [ ] Test: Mismo shopify_draft_order_id para diferentes tenants es permitido (multitenancy)
- [ ] Test: Mismo woocommerce_order_id para diferentes tenants es permitido
- [ ] Test: Constraint de BD previene duplicados en race condition
- [ ] Test: Calculo automatico de total desde line_items es correcto
- [ ] Test: Orden con total_price = 0 es rechazada
- [ ] Test: Line items sin unitPrice son rechazados

**Archivos a modificar:**
- `apps/backend/tests/unit/services/test_order_service.py` (crear)

**Estimacion:** 2 puntos | **Prioridad:** CRITICA | **Bloqueante:** SI

---

#### US-003: Tests de Coherencia de Plataforma E-commerce
**Como** desarrollador del equipo de backend
**Quiero** tener pruebas que validen la coherencia entre plataforma configurada y orden
**Para** evitar errores 500 cuando se intenta validar una orden en la plataforma incorrecta

**Criterios de Aceptacion:**
- [ ] Test: Tenant con platform=shopify y orden sin shopify_draft_order_id falla
- [ ] Test: Tenant con platform=woocommerce y orden sin woocommerce_order_id falla
- [ ] Test: Orden ya validada (validado=True) no puede validarse de nuevo
- [ ] Test: Validacion sin e-commerce configurado (sync_on_validation=False) funciona
- [ ] Test: Validacion actualiza correctamente: validado=True, status="Pagado", validated_at
- [ ] Test: Tenant sin credenciales de e-commerce lanza error descriptivo

**Archivos a modificar:**
- `apps/backend/tests/unit/services/test_ecommerce_service.py` (crear)

**Estimacion:** 2 puntos | **Prioridad:** ALTA | **Bloqueante:** NO

---

#### US-004: Tests de Generacion JSON-UBL
**Como** desarrollador del equipo de backend
**Quiero** tener pruebas que validen la estructura del documento electronico JSON-UBL
**Para** evitar rechazos de eFact por documentos malformados

**Criterios de Aceptacion:**
- [ ] Test: JSON-UBL tiene estructura valida con claves requeridas (_D, _S, _B, _E, Invoice)
- [ ] Test: Invoice contiene campos obligatorios (ID, IssueDate, AccountingSupplierParty, etc.)
- [ ] Test: Funcion numero_a_letras convierte correctamente montos en PEN
- [ ] Test: Funcion numero_a_letras convierte correctamente montos en USD
- [ ] Test: Items vacios genera error descriptivo
- [ ] Test: Precios se dividen correctamente por 1.18 para obtener valor sin IGV
- [ ] Test: Referencias para NC/ND se incluyen correctamente en el JSON

**Archivos a modificar:**
- `apps/backend/tests/unit/integrations/test_json_ubl.py` (crear)

**Estimacion:** 2 puntos | **Prioridad:** ALTA | **Bloqueante:** NO

---

#### US-005: Tests de Cifrado de Credenciales de Tenant
**Como** desarrollador del equipo de backend
**Quiero** tener pruebas que validen el cifrado/descifrado de credenciales
**Para** garantizar que las credenciales de e-commerce estan protegidas en la BD

**Criterios de Aceptacion:**
- [ ] Test: Credenciales se cifran al guardar tenant (no texto plano en BD)
- [ ] Test: Credenciales se descifran correctamente al leer tenant
- [ ] Test: Token corrupto o invalido retorna None (no excepcion)
- [ ] Test: Slug duplicado genera ValueError descriptivo
- [ ] Test: company_id duplicado genera ValueError descriptivo
- [ ] Test: Slug se genera automaticamente si no se proporciona

**Archivos a modificar:**
- `apps/backend/tests/unit/services/test_tenant_service.py` (crear)

**Estimacion:** 1 punto | **Prioridad:** ALTA | **Bloqueante:** NO

---

### Epic 2: Pruebas de Integracion con Mocks

#### US-006: Tests de Cliente eFact con Mocks
**Como** desarrollador del equipo de backend
**Quiero** tener pruebas de integracion del cliente eFact usando mocks
**Para** validar el manejo de respuestas y errores sin depender del servicio real

**Criterios de Aceptacion:**
- [ ] Test: Autenticacion OAuth2 exitosa retorna access_token
- [ ] Test: Autenticacion fallida (401) lanza EFactAuthError
- [ ] Test: Envio de documento exitoso retorna ticket
- [ ] Test: Status check HTTP 202 retorna status="processing"
- [ ] Test: Status check HTTP 200 retorna status="success" con CDR
- [ ] Test: Status check HTTP 412 retorna status="error"
- [ ] Test: Timeout de red lanza EFactError con mensaje descriptivo
- [ ] Test: Respuesta HTML en lugar de JSON lanza EFactError
- [ ] Test: Token cacheado se reutiliza dentro del tiempo de expiracion
- [ ] Test: Token expirado se renueva automaticamente

**Dependencias:** Libreria `responses` o `respx` para mockear httpx

**Archivos a modificar:**
- `apps/backend/tests/unit/integrations/test_efact_client.py` (crear)

**Estimacion:** 3 puntos | **Prioridad:** CRITICA | **Bloqueante:** SI

---

#### US-007: Tests de Cliente Shopify con Mocks
**Como** desarrollador del equipo de backend
**Quiero** tener pruebas de integracion del cliente Shopify usando mocks
**Para** validar el manejo de respuestas GraphQL y errores

**Criterios de Aceptacion:**
- [ ] Test: complete_draft_order exitoso retorna order_id
- [ ] Test: userErrors no vacio en respuesta lanza ValueError
- [ ] Test: GraphQL errors en respuesta lanza ValueError
- [ ] Test: Draft order no encontrado lanza ValueError
- [ ] Test: Timeout de 30s lanza HTTPError
- [ ] Test: Headers incluyen X-Shopify-Access-Token correctamente

**Dependencias:** Libreria `respx` para mockear httpx async

**Archivos a modificar:**
- `apps/backend/tests/unit/integrations/test_shopify_client.py` (crear)

**Estimacion:** 2 puntos | **Prioridad:** ALTA | **Bloqueante:** NO

---

#### US-008: Tests de Cliente WooCommerce con Mocks
**Como** desarrollador del equipo de backend
**Quiero** tener pruebas de integracion del cliente WooCommerce usando mocks
**Para** validar el manejo de respuestas REST y errores especificos

**Criterios de Aceptacion:**
- [ ] Test: mark_order_as_paid exitoso retorna orden con status="processing"
- [ ] Test: HTTP 401 lanza WooCommerceAuthError
- [ ] Test: HTTP 404 lanza WooCommerceNotFoundError
- [ ] Test: HTTP 500 lanza WooCommerceError
- [ ] Test: HTTP 429 (rate limit) lanza WooCommerceError con status_code
- [ ] Test: Timeout lanza RequestError

**Dependencias:** Libreria `respx` para mockear httpx async

**Archivos a modificar:**
- `apps/backend/tests/unit/integrations/test_woocommerce_client.py` (crear)

**Estimacion:** 2 puntos | **Prioridad:** ALTA | **Bloqueante:** NO

---

### Epic 3: Pruebas de Idempotencia

#### US-009: Tests de Idempotencia para Ordenes
**Como** desarrollador del equipo de backend
**Quiero** tener pruebas que validen la idempotencia en creacion de ordenes
**Para** garantizar que el sistema maneja correctamente eventos duplicados de n8n

**Criterios de Aceptacion:**
- [ ] Test: Mismo shopify_draft_order_id para mismo tenant genera ValueError (no IntegrityError)
- [ ] Test: Mismo woocommerce_order_id para mismo tenant genera ValueError
- [ ] Test: Constraint UNIQUE de BD previene duplicados en race condition
- [ ] Test: Insercion directa al repositorio (bypass service) falla con IntegrityError
- [ ] Test: Diferentes tenants pueden tener mismo shopify_draft_order_id

**Archivos a modificar:**
- `apps/backend/tests/integration/test_idempotency.py` (crear)

**Estimacion:** 2 puntos | **Prioridad:** CRITICA | **Bloqueante:** SI

---

#### US-010: Tests de Thread Safety para Correlativos
**Como** desarrollador del equipo de backend
**Quiero** tener pruebas que validen la generacion thread-safe de correlativos
**Para** garantizar que no se generen facturas con correlativo duplicado

**Criterios de Aceptacion:**
- [ ] Test: Correlativos son secuenciales (1, 2, 3, ...)
- [ ] Test: 10 requests concurrentes generan 10 correlativos unicos
- [ ] Test: SELECT FOR UPDATE previene race conditions
- [ ] Test: Correlativo se incrementa correctamente despues de cada uso

**Archivos a modificar:**
- `apps/backend/tests/integration/test_idempotency.py`

**Estimacion:** 1 punto | **Prioridad:** ALTA | **Bloqueante:** NO

---

### Epic 4: Pruebas de Manejo de Errores

#### US-011: Tests de Timeouts de Integraciones Externas
**Como** desarrollador del equipo de backend
**Quiero** tener pruebas que validen el comportamiento ante timeouts
**Para** garantizar que los errores de red se manejan correctamente

**Criterios de Aceptacion:**
- [ ] Test: eFact timeout de 30s lanza EFactError con mensaje descriptivo
- [ ] Test: Shopify timeout de 30s lanza HTTPError
- [ ] Test: WooCommerce timeout de 30s lanza RequestError
- [ ] Test: Connection refused se maneja como error de red
- [ ] Test: DNS resolution failure se maneja correctamente

**Archivos a modificar:**
- `apps/backend/tests/integration/test_error_handling.py` (crear)

**Estimacion:** 2 puntos | **Prioridad:** ALTA | **Bloqueante:** NO

---

#### US-012: Tests de Respuestas HTTP Invalidas
**Como** desarrollador del equipo de backend
**Quiero** tener pruebas que validen el manejo de respuestas inesperadas
**Para** evitar crashes por respuestas malformadas de servicios externos

**Criterios de Aceptacion:**
- [ ] Test: eFact retorna HTML en lugar de JSON -> EFactError (no JSONDecodeError)
- [ ] Test: Shopify retorna respuesta sin campo "data" -> ValueError descriptivo
- [ ] Test: WooCommerce retorna JSON vacio -> error manejado
- [ ] Test: Headers de respuesta inesperados no causan crash
- [ ] Test: Content-Type incorrecto se maneja gracefully

**Archivos a modificar:**
- `apps/backend/tests/integration/test_error_handling.py`

**Estimacion:** 1 punto | **Prioridad:** MEDIA | **Bloqueante:** NO

---

### Epic 5: Pruebas End-to-End

#### US-013: Test E2E de Flujo Completo Exitoso
**Como** QA del equipo
**Quiero** tener un test E2E del flujo completo desde orden hasta factura
**Para** validar que el happy path funciona correctamente

**Criterios de Aceptacion:**
- [ ] Test: Crear tenant con credenciales Shopify mockeadas
- [ ] Test: Crear orden via API con shopify_draft_order_id
- [ ] Test: Validar orden via API (mock Shopify exitoso)
- [ ] Test: Verificar orden.validado=True, orden.status="Pagado"
- [ ] Test: Crear factura (boleta) via API (mock eFact exitoso)
- [ ] Test: Verificar invoice.efact_status="processing", invoice.efact_ticket existe
- [ ] Test: Verificar cliente_numero_documento se copia correctamente de la orden

**Setup requerido:**
- Base de datos de test limpia
- Mocks de Shopify y eFact configurados
- Token JWT de prueba para autenticacion

**Archivos a modificar:**
- `apps/backend/tests/e2e/test_order_to_invoice_flow.py` (crear)

**Estimacion:** 3 puntos | **Prioridad:** CRITICA | **Bloqueante:** SI

---

#### US-014: Test E2E de Fallo en Shopify
**Como** QA del equipo
**Quiero** tener un test E2E que valide el comportamiento cuando Shopify falla
**Para** garantizar que el sistema responde correctamente a errores externos

**Criterios de Aceptacion:**
- [ ] Test: Crear orden pendiente de validacion
- [ ] Test: Intentar validar con mock Shopify que retorna error
- [ ] Test: Verificar respuesta HTTP 502 Bad Gateway
- [ ] Test: Verificar mensaje de error menciona "Shopify"
- [ ] Test: Verificar orden.validado permanece False
- [ ] Test: Verificar orden.status permanece "Pendiente"

**Archivos a modificar:**
- `apps/backend/tests/e2e/test_order_to_invoice_flow.py`

**Estimacion:** 1 punto | **Prioridad:** ALTA | **Bloqueante:** NO

---

#### US-015: Test E2E de Fallo en eFact
**Como** QA del equipo
**Quiero** tener un test E2E que valide el comportamiento cuando eFact falla
**Para** garantizar que el sistema responde correctamente a errores de facturacion

**Criterios de Aceptacion:**
- [ ] Test: Crear orden ya validada
- [ ] Test: Intentar crear factura con mock eFact que retorna error
- [ ] Test: Verificar respuesta HTTP 400 Bad Request
- [ ] Test: Verificar mensaje de error menciona "eFact"
- [ ] Test: Verificar que no se crea registro Invoice en BD (o se crea con status="error")

**Archivos a modificar:**
- `apps/backend/tests/e2e/test_order_to_invoice_flow.py`

**Estimacion:** 1 punto | **Prioridad:** ALTA | **Bloqueante:** NO

---

### Epic 6: Mejoras de Resiliencia (Post-Tests)

#### US-016: Implementar Circuit Breaker para Integraciones
**Como** desarrollador del equipo de backend
**Quiero** implementar circuit breaker en los clientes de integracion
**Para** evitar que el sistema se bloquee cuando un servicio externo esta caido

**Criterios de Aceptacion:**
- [ ] Instalar libreria `tenacity` como dependencia
- [ ] Implementar decorator de retry con backoff exponencial en EFactClient
- [ ] Implementar decorator de retry en ShopifyClient
- [ ] Implementar decorator de retry en WooCommerceClient
- [ ] Configurar: max 3 reintentos, wait 2-10 segundos
- [ ] Agregar tests para validar comportamiento de reintentos
- [ ] Documentar configuracion de reintentos

**Archivos a modificar:**
- `apps/backend/pyproject.toml` (agregar tenacity)
- `apps/backend/app/integrations/efact_client.py`
- `apps/backend/app/integrations/shopify_client.py`
- `apps/backend/app/integrations/woocommerce_client.py`

**Estimacion:** 3 puntos | **Prioridad:** ALTA | **Bloqueante:** NO

---

#### US-017: Agregar Correlation IDs a Logs
**Como** desarrollador/SRE del equipo
**Quiero** tener correlation IDs en todos los logs
**Para** poder rastrear el flujo completo de una orden a traves del sistema

**Criterios de Aceptacion:**
- [ ] Crear middleware que genera/extrae X-Correlation-ID del header
- [ ] Propagar correlation_id a todos los logs del request
- [ ] Retornar X-Correlation-ID en headers de respuesta
- [ ] Incluir correlation_id en logs de servicios
- [ ] Incluir correlation_id en logs de integraciones externas
- [ ] Agregar tests para validar propagacion

**Archivos a modificar:**
- `apps/backend/app/core/middleware.py` (crear)
- `apps/backend/app/main.py` (registrar middleware)
- Actualizar loggers en servicios e integraciones

**Estimacion:** 2 puntos | **Prioridad:** MEDIA | **Bloqueante:** NO

---

#### US-018: Fix Race Condition en Token Cache de eFact
**Como** desarrollador del equipo de backend
**Quiero** corregir la race condition en el cache de tokens de eFact
**Para** evitar multiples requests de autenticacion simultaneos

**Criterios de Aceptacion:**
- [ ] Agregar threading.Lock al cache global de tokens
- [ ] Verificar que solo un thread puede renovar el token a la vez
- [ ] Agregar test de concurrencia que valida el fix
- [ ] Documentar el cambio

**Archivos a modificar:**
- `apps/backend/app/integrations/efact_client.py`

**Estimacion:** 1 punto | **Prioridad:** MEDIA | **Bloqueante:** NO

---

## Resumen de Historias de Usuario

| ID | Titulo | Puntos | Prioridad | Bloqueante |
|----|--------|--------|-----------|------------|
| US-001 | Tests Validaciones SUNAT | 3 | CRITICA | SI |
| US-002 | Tests Ordenes Duplicadas | 2 | CRITICA | SI |
| US-003 | Tests Coherencia Plataforma | 2 | ALTA | NO |
| US-004 | Tests JSON-UBL | 2 | ALTA | NO |
| US-005 | Tests Cifrado Credenciales | 1 | ALTA | NO |
| US-006 | Tests eFact Mocks | 3 | CRITICA | SI |
| US-007 | Tests Shopify Mocks | 2 | ALTA | NO |
| US-008 | Tests WooCommerce Mocks | 2 | ALTA | NO |
| US-009 | Tests Idempotencia Ordenes | 2 | CRITICA | SI |
| US-010 | Tests Thread Safety Correlativos | 1 | ALTA | NO |
| US-011 | Tests Timeouts | 2 | ALTA | NO |
| US-012 | Tests Respuestas Invalidas | 1 | MEDIA | NO |
| US-013 | E2E Flujo Exitoso | 3 | CRITICA | SI |
| US-014 | E2E Fallo Shopify | 1 | ALTA | NO |
| US-015 | E2E Fallo eFact | 1 | ALTA | NO |
| US-016 | Circuit Breaker | 3 | ALTA | NO |
| US-017 | Correlation IDs | 2 | MEDIA | NO |
| US-018 | Fix Token Cache | 1 | MEDIA | NO |
| **TOTAL** | | **34 pts** | | |

---

## Orden de Implementacion Sugerido

### Sprint 1: Bloqueantes (~13 puntos)
| Historia | Puntos |
|----------|--------|
| US-001: Tests Validaciones SUNAT | 3 |
| US-002: Tests Ordenes Duplicadas | 2 |
| US-006: Tests eFact Mocks | 3 |
| US-009: Tests Idempotencia Ordenes | 2 |
| US-013: E2E Flujo Exitoso | 3 |

### Sprint 2: Alta Prioridad (~12 puntos)
| Historia | Puntos |
|----------|--------|
| US-003: Tests Coherencia Plataforma | 2 |
| US-004: Tests JSON-UBL | 2 |
| US-007: Tests Shopify Mocks | 2 |
| US-008: Tests WooCommerce Mocks | 2 |
| US-010: Tests Thread Safety | 1 |
| US-011: Tests Timeouts | 2 |
| US-014: E2E Fallo Shopify | 1 |

### Sprint 3: Mejoras (~9 puntos)
| Historia | Puntos |
|----------|--------|
| US-005: Tests Cifrado | 1 |
| US-012: Tests Respuestas Invalidas | 1 |
| US-015: E2E Fallo eFact | 1 |
| US-016: Circuit Breaker | 3 |
| US-017: Correlation IDs | 2 |
| US-018: Fix Token Cache | 1 |

---

## Estructura de Tests Propuesta

```
apps/backend/tests/
├── unit/
│   ├── services/
│   │   ├── test_invoice_service.py      # Validaciones SUNAT
│   │   ├── test_order_service.py        # Duplicados, calculos
│   │   ├── test_ecommerce_service.py    # Coherencia plataforma
│   │   └── test_tenant_service.py       # Cifrado credenciales
│   └── integrations/
│       ├── test_efact_client.py         # Mocks eFact
│       ├── test_shopify_client.py       # Mocks Shopify
│       └── test_woocommerce_client.py   # Mocks WooCommerce
├── integration/
│   ├── test_idempotency.py              # Duplicados, correlativos
│   └── test_error_handling.py           # Timeouts, errores HTTP
└── e2e/
    └── test_order_to_invoice_flow.py    # Flujos completos
```

---

## Comandos de Verificacion

```bash
# Ejecutar suite completa
cd apps/backend
uv run pytest tests/ -v --cov=app --cov-report=html

# Ejecutar solo tests E2E
uv run pytest tests/e2e/ -v -m e2e

# Ejecutar tests de integracion
uv run pytest tests/integration/ -v

# Ver reporte de cobertura
open htmlcov/index.html
```
