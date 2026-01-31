# Historias de Usuario: Envío de Facturas por Email

## Epic: Sistema de Envío de Comprobantes Electrónicos por Email

Como empresa que usa VentIA, quiero poder enviar automáticamente las facturas y boletas a mis clientes por correo electrónico, para mejorar la experiencia del cliente y reducir el trabajo manual de envío de comprobantes.

---

## Historia de Usuario 1: Configuración del Servicio de Email

**Como:** Administrador del Sistema
**Quiero:** Configurar el servicio de email (Resend) en el backend
**Para:** Habilitar el envío de emails desde la aplicación

### Descripción
El sistema necesita tener configurado Resend como proveedor de email con las credenciales necesarias para poder enviar correos electrónicos a los clientes.

### Criterios de Aceptación

1. **Instalación de Dependencias**
   - [ ] El paquete `resend>=2.0.0` está instalado en el backend
   - [ ] La dependencia aparece en `apps/backend/pyproject.toml`

2. **Configuración de Variables de Entorno**
   - [ ] Existen las variables `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME` en `config.py`
   - [ ] El archivo `.env.example` documenta las variables necesarias
   - [ ] El sistema valida que `RESEND_API_KEY` esté configurado al iniciar

3. **Cuenta de Resend Configurada**
   - [ ] Se ha creado cuenta en Resend.com
   - [ ] El dominio de envío está verificado (registros DNS: SPF, DKIM, DMARC)
   - [ ] Se ha generado y configurado el API key

4. **Validación**
   - [ ] El backend inicia correctamente con la configuración de Resend
   - [ ] Se muestra error claro si falta `RESEND_API_KEY`

---

## Historia de Usuario 2: Servicio de Email con Plantilla HTML

**Como:** Desarrollador Backend
**Quiero:** Un servicio que genere y envíe emails con plantilla HTML profesional
**Para:** Enviar facturas por email de manera consistente y atractiva

### Descripción
Se necesita crear un servicio centralizado (`EmailService`) que maneje la generación de emails HTML con los datos de la factura y el envío mediante Resend API.

### Criterios de Aceptación

1. **Servicio de Email (`email_service.py`)**
   - [ ] Existe el archivo `apps/backend/app/services/email_service.py`
   - [ ] Contiene la clase `EmailService` con método `send_invoice_email()`
   - [ ] Contiene la excepción `EmailError` para errores de email

2. **Generación de Plantilla HTML**
   - [ ] Método `_build_invoice_html()` genera HTML con CSS inline
   - [ ] El HTML es compatible con clientes de email (Gmail, Outlook, Apple Mail)
   - [ ] La plantilla incluye:
     - Icono de éxito (check verde)
     - Título "¡Tu [Factura/Boleta] ha sido emitida!"
     - Número de comprobante
     - Fecha de validación SUNAT
     - Resumen con: Cliente, Tipo, Subtotal, IGV, Total
     - Footer con información de ayuda
     - Copyright

3. **Generación de Asunto del Email**
   - [ ] Método `_build_invoice_subject()` genera asunto personalizado
   - [ ] Formato: `[VentIA] Tu [Factura/Boleta] [SERIE]-[CORRELATIVO] - [Tenant Name]`

4. **Adjuntos**
   - [ ] El servicio adjunta el PDF de la factura
   - [ ] Opcionalmente adjunta el XML si se solicita
   - [ ] Los archivos se nombran como: `{serie}-{correlativo}.pdf`

5. **Manejo de Errores**
   - [ ] Captura excepciones de Resend API
   - [ ] Lanza `EmailError` con mensaje descriptivo
   - [ ] Los errores incluyen información útil para debugging

6. **Singleton**
   - [ ] Existe instancia singleton `email_service` exportada
   - [ ] Se puede importar desde otros módulos

---

## Historia de Usuario 3: Endpoint API para Envío de Email

**Como:** Usuario del Sistema
**Quiero:** Un endpoint API que envíe facturas por email
**Para:** Poder enviar comprobantes a mis clientes desde el frontend

### Descripción
Se necesita un endpoint REST que permita enviar una factura específica por email, con validaciones de seguridad y permisos.

### Criterios de Aceptación

1. **Endpoint REST**
   - [ ] Existe endpoint: `POST /api/v1/invoices/{invoice_id}/send-email`
   - [ ] Acepta body con `recipient_email` (opcional) e `include_xml` (opcional)
   - [ ] Retorna `InvoiceSendEmailResponse` con: `success`, `email_id`, `sent_to`, `message`

2. **Schemas Pydantic**
   - [ ] Existe `InvoiceSendEmailRequest` en `invoice.py`
   - [ ] Existe `InvoiceSendEmailResponse` en `invoice.py`
   - [ ] Los schemas tienen validación de tipos correcta

3. **Validaciones de Negocio**
   - [ ] Valida que la factura exista
   - [ ] Valida que el usuario tenga acceso a la factura de su tenant
   - [ ] Valida que `efact_status === "success"` (aceptado por SUNAT)
   - [ ] Valida que exista email (en request o en `invoice.cliente_email`)
   - [ ] Valida formato de email con `email-validator`

4. **Validaciones de Seguridad**
   - [ ] Usuarios solo pueden enviar facturas de su propio tenant
   - [ ] SUPERADMIN puede enviar facturas de cualquier tenant
   - [ ] Requiere autenticación (JWT token)
   - [ ] Retorna 403 si el usuario no tiene acceso

5. **Proceso de Envío**
   - [ ] Descarga PDF desde eFact usando `efact_ticket`
   - [ ] Opcionalmente descarga XML si `include_xml=true`
   - [ ] Obtiene información del tenant
   - [ ] Llama a `email_service.send_invoice_email()`
   - [ ] Retorna respuesta con `email_id` de Resend

6. **Manejo de Errores**
   - [ ] Retorna 404 si factura no existe
   - [ ] Retorna 400 si factura no está en estado "success"
   - [ ] Retorna 400 si no hay email disponible
   - [ ] Retorna 400 si email tiene formato inválido
   - [ ] Retorna 500 si falla descarga de PDF
   - [ ] Retorna 500 si falla envío de email
   - [ ] Los errores incluyen mensaje descriptivo en `detail`

---

## Historia de Usuario 4: Botón "Enviar por Email" en Frontend

**Como:** Usuario del Dashboard
**Quiero:** Ver un botón para enviar facturas por email en la lista de comprobantes
**Para:** Poder enviar fácilmente los comprobantes a mis clientes

### Descripción
Agregar un botón en el dropdown menu de acciones de cada factura que permita enviar el comprobante por email al cliente.

### Criterios de Aceptación

1. **Función API Client**
   - [ ] Existe función `sendInvoiceEmail()` en `invoice-service.ts`
   - [ ] Acepta parámetros: `accessToken`, `invoiceId`, `recipientEmail?`, `includeXml?`
   - [ ] Retorna promesa con respuesta del backend
   - [ ] Maneja errores HTTP correctamente

2. **Botón en UI**
   - [ ] Aparece opción "Enviar por Email" en dropdown menu de acciones
   - [ ] El botón solo aparece si:
     - `invoice.efact_status === "success"`
     - `invoice.cliente_email` existe (tiene valor)
   - [ ] El botón muestra ícono de mail (📧)
   - [ ] Durante el envío muestra spinner y texto "Enviando..."
   - [ ] El botón está deshabilitado mientras se envía

3. **Handler de Envío**
   - [ ] Existe función `handleSendEmail()` en el componente
   - [ ] Valida que la factura tenga email antes de enviar
   - [ ] Valida que la factura esté en estado "success"
   - [ ] Muestra toast de error si falta email
   - [ ] Muestra toast de error si factura no es válida

4. **Feedback al Usuario**
   - [ ] Muestra toast de éxito: "Email enviado" con email del destinatario
   - [ ] Muestra toast de error con mensaje descriptivo si falla
   - [ ] El estado de loading se limpia al finalizar (éxito o error)

5. **Estado de Loading**
   - [ ] Existe estado `sendingEmailId` para tracking
   - [ ] Solo se permite enviar un email a la vez
   - [ ] El botón correcto muestra el spinner (no todos)

6. **Imports Necesarios**
   - [ ] Se importa `Mail` y `Loader2` de `lucide-react`
   - [ ] Se importa `sendInvoiceEmail` de `invoice-service`

---

## Historia de Usuario 5: Dialog de Confirmación de Email (Opcional)

**Como:** Usuario del Dashboard
**Quiero:** Poder confirmar o modificar el email antes de enviar la factura
**Para:** Asegurarme de que el comprobante llegue a la dirección correcta

### Descripción
Un dialog modal que permite al usuario ver y editar el email de destino antes de enviar el comprobante.

### Criterios de Aceptación

1. **Componente Dialog**
   - [ ] Existe archivo `apps/frontend/components/invoices/send-email-dialog.tsx`
   - [ ] El dialog muestra el número de comprobante
   - [ ] El dialog tiene campo de email pre-llenado con `cliente_email`

2. **Campos del Formulario**
   - [ ] Campo de email con validación HTML5 (type="email")
   - [ ] Checkbox "Incluir archivo XML firmado"
   - [ ] Botones "Cancelar" y "Enviar Email"

3. **Funcionalidad**
   - [ ] El usuario puede editar el email antes de enviar
   - [ ] El campo de email es requerido
   - [ ] Durante el envío, muestra spinner en botón
   - [ ] Durante el envío, los botones están deshabilitados
   - [ ] Cierra el dialog al enviar exitosamente
   - [ ] Cierra el dialog al hacer click en "Cancelar"

4. **Integración**
   - [ ] El dialog se abre al hacer click en "Enviar por Email"
   - [ ] El componente padre maneja el envío real
   - [ ] El componente padre maneja el manejo de errores

---

## Historia de Usuario 6: Pruebas End-to-End del Sistema

**Como:** QA / Desarrollador
**Quiero:** Validar que todo el flujo de envío de emails funcione correctamente
**Para:** Garantizar que los clientes reciban sus comprobantes sin problemas

### Descripción
Realizar pruebas completas del sistema de envío de emails desde la creación de la factura hasta la recepción del email.

### Criterios de Aceptación

1. **Prueba de Envío Exitoso**
   - [ ] Se puede crear una factura en el sistema
   - [ ] La factura llega a estado "success" (validado por SUNAT)
   - [ ] El botón "Enviar por Email" aparece en la UI
   - [ ] Al hacer click, el email se envía correctamente
   - [ ] El toast de éxito aparece con el email del destinatario
   - [ ] El email llega a la bandeja de entrada

2. **Prueba de Contenido del Email**
   - [ ] El asunto del email es correcto: `[VentIA] Tu [Tipo] [SERIE]-[CORRELATIVO] - [Tenant]`
   - [ ] El HTML se renderiza correctamente en Gmail
   - [ ] El HTML se renderiza correctamente en Outlook
   - [ ] El HTML se renderiza correctamente en Apple Mail
   - [ ] El PDF adjunto se abre correctamente
   - [ ] Los datos en el email son correctos (cliente, total, fecha, etc.)

3. **Prueba de Validaciones**
   - [ ] No se puede enviar factura con status "pending"
   - [ ] No se puede enviar factura sin email de cliente
   - [ ] No se puede enviar factura con email inválido
   - [ ] No se puede enviar factura de otro tenant (403 Forbidden)
   - [ ] Los errores muestran mensajes descriptivos

4. **Prueba de Opciones**
   - [ ] Se puede enviar email con override de destinatario
   - [ ] Se puede enviar email con XML incluido (`include_xml: true`)
   - [ ] El XML adjunto se descarga correctamente

5. **Prueba de Seguridad**
   - [ ] Un usuario no puede enviar facturas de otro tenant
   - [ ] Un SUPERADMIN puede enviar facturas de cualquier tenant
   - [ ] El endpoint requiere autenticación (token)

6. **Prueba de Performance**
   - [ ] El envío de email toma menos de 5 segundos
   - [ ] No hay timeout en la descarga del PDF
   - [ ] El frontend responde correctamente durante el loading

---

## Historia de Usuario 7: Documentación y Configuración

**Como:** Administrador del Sistema
**Quiero:** Tener documentación clara sobre cómo configurar el sistema de emails
**Para:** Poder configurar el sistema en producción sin problemas

### Descripción
Documentar el proceso de configuración de Resend y las variables de entorno necesarias.

### Criterios de Aceptación

1. **Documentación en `.env.example`**
   - [ ] Existe sección "Resend (Email Service)" en `.env.example`
   - [ ] Documenta `RESEND_API_KEY` con ejemplo
   - [ ] Documenta `RESEND_FROM_EMAIL` con ejemplo
   - [ ] Documenta `RESEND_FROM_NAME` con ejemplo

2. **Checklist de Configuración**
   - [ ] Existe documentación sobre cómo crear cuenta en Resend
   - [ ] Existe documentación sobre cómo verificar dominio
   - [ ] Existe documentación sobre cómo generar API key
   - [ ] Existe documentación sobre cómo configurar DNS (SPF, DKIM, DMARC)

3. **Notas de Producción**
   - [ ] Documenta límites del free tier de Resend (100/día, 3000/mes)
   - [ ] Documenta cómo actualizar a plan Pro si es necesario
   - [ ] Documenta consideraciones de seguridad

4. **Troubleshooting**
   - [ ] Documenta qué hacer si falta `RESEND_API_KEY`
   - [ ] Documenta qué hacer si el dominio no está verificado
   - [ ] Documenta qué hacer si fallan los envíos

---

## Notas Técnicas

### Stack Tecnológico
- **Backend**: FastAPI (Python 3.11+), Resend SDK
- **Frontend**: Next.js 16, React 19, TypeScript
- **Email Service**: Resend API
- **Template Engine**: HTML con CSS inline

### Dependencias Nuevas
```toml
# Backend
resend>=2.0.0
```

### Variables de Entorno
```bash
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=facturas@tudominio.com
RESEND_FROM_NAME=VentIA - Facturación
```

### Estimación de Tiempo
- **Backend**: 2-3 horas
- **Frontend**: 1-2 horas
- **Testing**: 1 hora
- **Total**: 4-6 horas

### Archivos Modificados/Creados
**Backend (6 archivos)**:
1. `apps/backend/pyproject.toml` - Agregar dependencia resend
2. `apps/backend/app/core/config.py` - Agregar configuración de email
3. `apps/backend/app/services/email_service.py` - **NUEVO** - Servicio de email
4. `apps/backend/app/schemas/invoice.py` - Agregar schemas de email
5. `apps/backend/app/api/v1/endpoints/invoices.py` - Agregar endpoint
6. `apps/backend/.env.example` - Documentar variables

**Frontend (2-3 archivos)**:
7. `apps/frontend/lib/services/invoice-service.ts` - Agregar función API
8. `apps/frontend/app/dashboard/invoices/invoices-client.tsx` - Agregar botón
9. `apps/frontend/components/invoices/send-email-dialog.tsx` - **NUEVO** (opcional)

---

## Mejoras Futuras (Backlog)

### Sprint 2 (Post-MVP)
- [ ] **US-8**: Tracking de emails enviados (campos `email_sent_at`, `email_sent_to`)
- [ ] **US-9**: Envío automático al validar factura (trigger cuando status → "success")
- [ ] **US-10**: Webhooks de Resend para rastrear delivery/bounces

### Sprint 3 (Mejoras)
- [ ] **US-11**: Plantillas personalizadas por tenant
- [ ] **US-12**: Soporte para CC y BCC
- [ ] **US-13**: Historial de envíos en UI
- [ ] **US-14**: Botón "Reenviar" para facturas ya enviadas

### Sprint 4 (Optimización)
- [ ] **US-15**: Queue de emails con Celery/Redis
- [ ] **US-16**: Rate limiting por usuario/tenant
- [ ] **US-17**: Validación de emails temporales/desechables
- [ ] **US-18**: Dashboard de métricas de email

---

## Definición de "Done"

Una historia de usuario se considera completa cuando:

✅ **Código**
- El código está implementado según los criterios de aceptación
- El código sigue los estándares del proyecto
- No hay errores de linting ni TypeScript

✅ **Tests**
- Los tests manuales pasan exitosamente
- Se han probado casos de éxito y error
- Se ha probado en diferentes navegadores/clientes de email

✅ **Documentación**
- El código tiene comentarios apropiados
- Las variables de entorno están documentadas
- Los cambios están documentados en este archivo

✅ **Review**
- El código ha sido revisado
- Los criterios de aceptación han sido validados
- El product owner ha aprobado la funcionalidad

✅ **Deploy**
- El código está mergeado a la rama principal
- Los cambios están desplegados en staging
- La configuración de producción está documentada

---

**Última actualización**: 24 de Enero de 2026
**Versión**: 1.0
**Estado**: Ready for Development
