# Plan: Send-by-Phone Endpoint

**Fecha:** 2026-06-03
**Branch:** `feat/send-by-phone-endpoint`
**Spec:** `docs/superpowers/specs/2026-06-03-send-by-phone-endpoint-design.md`
**Status:** Listo para ejecutar

## Resumen

Implementación en 3 pasos secuenciales, dos en `apps/messaging` (Rails) y uno en `apps/backend` (FastAPI proxy).

```
Paso 1 → Conversations::EnsureFromPhoneService (servicio + spec)
Paso 2 → MessagesController#send_by_phone + ruta + request spec
Paso 3 → FastAPI proxy + schemas + tests
```

Paso 2 depende del 1. Paso 3 depende del 2 (necesita ruta Rails operativa para apuntar el proxy). Cada paso compila y sus tests pasan independientemente.

---

## Paso 1 — Servicio `Conversations::EnsureFromPhoneService`

### 1.1 — Crear el servicio

**Archivo nuevo:** `apps/messaging/app/services/conversations/ensure_from_phone_service.rb`

```ruby
class Conversations::EnsureFromPhoneService
  E164_REGEX = /\A\+[1-9]\d{1,14}\z/

  Result = Struct.new(:contact, :contact_inbox, :conversation, :message,
                      :contact_created, :conversation_created, keyword_init: true)

  class InvalidPhoneError        < StandardError; end
  class InvalidInboxChannelError < StandardError; end

  def initialize(account:, inbox:, phone:, template_params:,
                 contact_name: nil, campaign: nil)
    @account         = account
    @inbox           = inbox
    @phone           = phone
    @template_params = template_params
    @contact_name    = contact_name
    @campaign        = campaign
  end

  def perform
    validate_inbox!
    normalized = normalize_phone!
    contact, contact_created    = ensure_contact(normalized)
    contact_inbox               = ensure_contact_inbox(contact, normalized)
    conversation, convo_created = ensure_conversation(contact, contact_inbox)
    message                     = build_and_save_message(conversation)
    send_via_whatsapp(conversation, message)

    Result.new(contact: contact, contact_inbox: contact_inbox,
               conversation: conversation, message: message,
               contact_created: contact_created,
               conversation_created: convo_created)
  end

  private

  def validate_inbox!
    return if @inbox.channel.is_a?(Channel::Whatsapp)

    raise InvalidInboxChannelError,
          'send_by_phone solo aplica a inboxes de WhatsApp'
  end

  def normalize_phone!
    cleaned = @phone.to_s.gsub(/[\s\-]/, '')
    raise InvalidPhoneError, 'phone debe estar en formato E.164 (+...)' unless cleaned.match?(E164_REGEX)

    cleaned
  end

  def ensure_contact(normalized)
    existing = @account.contacts.find_by(phone_number: normalized)
    return [existing, false] if existing

    contact = @account.contacts.create!(
      phone_number: normalized,
      name:         @contact_name.presence,
      contact_type: :lead
    )
    [contact, true]
  end

  def ensure_contact_inbox(contact, normalized)
    existing = ContactInbox
                 .where(contact: contact, inbox: @inbox)
                 .order(Arel.sql('whatsapp_bsuid IS NULL ASC'))
                 .first

    bsuid     = existing&.whatsapp_bsuid
    phone_raw = normalized.delete_prefix('+')
    source_id = if bsuid.present? && bsuid_sending_enabled?
                  bsuid
                else
                  phone_raw
                end

    ContactInbox.find_or_create_by!(
      contact: contact, inbox: @inbox, source_id: source_id
    ) do |ci|
      ci.whatsapp_bsuid = bsuid if bsuid.present?
    end
  end

  def ensure_conversation(contact, contact_inbox)
    open_conversation = @account.conversations
                                .where(contact_id: contact.id,
                                       inbox_id:   @inbox.id,
                                       status:     :open)
                                .order(created_at: :desc)
                                .first

    return [open_conversation, false] if open_conversation

    conversation = Conversation.create!(
      account:       @account,
      inbox:         @inbox,
      contact:       contact,
      contact_inbox: contact_inbox,
      campaign:      @campaign,
      status:        :open
    )
    [conversation, true]
  end

  def build_and_save_message(conversation)
    raise ArgumentError, 'template_params requerido' if @template_params.blank?

    tp = @template_params.with_indifferent_access
    built = Whatsapp::TemplateMessageBuilder.new(
      conversation:     conversation,
      name:             tp[:name],
      language:         tp[:language],
      processed_params: tp[:processed_params]&.to_h
    ).build

    Message.create!(
      built.merge(
        account:      @account,
        inbox:        @inbox,
        conversation: conversation,
        message_type: :outgoing
      )
    )
  end

  def send_via_whatsapp(conversation, message)
    Whatsapp::SendOnWhatsappService.new(
      conversation: conversation,
      message:      message
    ).perform
  rescue StandardError => e
    Rails.logger.error "[EnsureFromPhone] Send failed " \
                       "(account_id=#{@account.id}, conversation_id=#{conversation.id}, " \
                       "message_id=#{message.id}): #{e.message}"
    # No re-raise: el message queda con status pendiente/failed según el caller
  end

  def bsuid_sending_enabled?
    ENV.fetch('WHATSAPP_BSUID_SENDING', 'false') == 'true'
  end
end
```

### 1.2 — Spec del servicio

**Archivo nuevo:** `apps/messaging/spec/services/conversations/ensure_from_phone_service_spec.rb`

Escenarios a cubrir (tabla del spec):

| Contexto | Expectativa |
|---|---|
| Contacto y conversación inexistentes | Crea Contact, ContactInbox, Conversation, Message; `contact_created=true, conversation_created=true` |
| Contacto existe sin conversación open | Reusa contact, crea ContactInbox si falta, crea Conversation; `contact_created=false, conversation_created=true` |
| Hay conversación open en el inbox | Reusa contact + conversation; `conversation_created=false`; message se agrega al hilo |
| Contacto con conversación resolved | Crea nueva conversación (no reabre) |
| ContactInbox con bsuid + flag habilitado | Source_id usa bsuid |
| Sin flag o sin bsuid | Source_id usa phone sin `+` |
| Phone inválido | Raise `InvalidPhoneError`, no crea nada |
| Inbox no Whatsapp (Instagram) | Raise `InvalidInboxChannelError`, no crea nada |
| Template no encontrado | Propaga `Whatsapp::TemplateMessageBuilder::TemplateNotFound` |
| Faltan variables del template | Propaga `MissingBodyVariables` |
| `SendOnWhatsappService` falla | No raisea; Message queda creado |
| Normalización phone | Matriz: `+51999...`, `" +51 999 "`, `"+51-999..."`, `"999"`, `"+0..."`, `"+5199...00000"` |

Estructura base:

```ruby
require 'rails_helper'

RSpec.describe Conversations::EnsureFromPhoneService do
  let(:account)         { create(:account) }
  let(:whatsapp_inbox)  { create(:inbox, :whatsapp, account: account) }
  let(:template_params) do
    { name: 'promo_junio', language: 'es', processed_params: { '1' => 'Juan' } }
  end

  before do
    # Stub el template builder y send service en escenarios donde no son foco del test
    allow_any_instance_of(Whatsapp::TemplateMessageBuilder).to receive(:build)
      .and_return(content: 'Hola Juan', content_type: 'template', content_attributes: {})
    allow_any_instance_of(Whatsapp::SendOnWhatsappService).to receive(:perform)
  end

  subject(:service) do
    described_class.new(
      account: account, inbox: whatsapp_inbox,
      phone: '+51999888777', template_params: template_params,
      contact_name: 'Juan Pérez'
    )
  end

  describe '#perform' do
    context 'cuando el contacto no existe' do
      it 'crea contact, contact_inbox, conversation y message' do
        expect { service.perform }.to change { account.contacts.count }.by(1)
                                  .and change { ContactInbox.count }.by(1)
                                  .and change { Conversation.count }.by(1)
                                  .and change { Message.count }.by(1)
      end

      it 'devuelve contact_created=true y conversation_created=true' do
        result = service.perform
        expect(result.contact_created).to be true
        expect(result.conversation_created).to be true
      end
    end

    # ... resto de escenarios
  end
end
```

**Verificar:** `docker exec ventia-messaging bundle exec rspec spec/services/conversations/ensure_from_phone_service_spec.rb`

---

## Paso 2 — Endpoint Rails

### 2.1 — Acción `send_by_phone` en `MessagesController`

**Archivo:** `apps/messaging/app/controllers/api/v1/messages_controller.rb`

Agregar acción sin `before_action :set_conversation` (porque no recibe `conversation_id`). Skipear el callback explícitamente:

```ruby
class Api::V1::MessagesController < Api::V1::BaseController
  include SearchSnippetSafety

  before_action :set_conversation, except: [:send_by_phone]

  # ... acciones existentes ...

  def send_by_phone
    inbox = current_account.inboxes.find(params[:inbox_id])

    result = Conversations::EnsureFromPhoneService.new(
      account:         current_account,
      inbox:           inbox,
      phone:           params[:phone],
      template_params: params[:template_params]&.to_unsafe_h,
      contact_name:    params[:contact_name]
    ).perform

    render_success(
      {
        conversation_id:      result.conversation.id,
        message_id:           result.message.id,
        contact_id:           result.contact.id,
        contact_created:      result.contact_created,
        conversation_created: result.conversation_created
      },
      message: 'Message sent',
      status:  :created
    )
  rescue Conversations::EnsureFromPhoneService::InvalidPhoneError,
         Conversations::EnsureFromPhoneService::InvalidInboxChannelError,
         Whatsapp::TemplateMessageBuilder::TemplateNotFound,
         Whatsapp::TemplateMessageBuilder::MissingBodyVariables => e
    render_error(e.message, status: :unprocessable_entity)
  rescue ArgumentError => e
    render_error(e.message, status: :unprocessable_entity)
  end
end
```

Nota: `ActiveRecord::RecordNotFound` para `inbox` ya está manejado a nivel `BaseController` (devuelve 404 estándar de Rails).

### 2.2 — Ruta en `routes.rb`

**Archivo:** `apps/messaging/config/routes.rb`

Agregar dentro de `namespace :api / namespace :v1`, fuera del scope `:conversations` (porque no requiere conversation_id):

```ruby
# Send-by-phone (no requiere conversation_id existente)
post 'messages/send_by_phone', to: 'messages#send_by_phone'
```

Ubicarla justo después del bloque de `resources :conversations` global para mantener coherencia visual.

### 2.3 — Request spec

**Archivo nuevo:** `apps/messaging/spec/requests/api/v1/messages/send_by_phone_spec.rb`

Escenarios:

| Caso | HTTP esperado | Validación |
|---|---|---|
| Happy path: phone nuevo, template válido | 201 | Body con `conversation_id`, `message_id`, `contact_id`, `contact_created=true`, `conversation_created=true` |
| Phone existente con conversación open | 201 | `contact_created=false, conversation_created=false`, message en hilo existente |
| Phone inválido (no E.164) | 422 | Error message contiene "E.164" |
| Inbox no es WhatsApp (Instagram) | 422 | Error contiene "WhatsApp" |
| `inbox_id` no pertenece al tenant | 404 | Standard not found |
| `template_params` ausente | 422 | Error contiene "template_params" |
| Sin API key | 401 | Auth fail estándar |

Esqueleto:

```ruby
require 'rails_helper'

RSpec.describe 'POST /api/v1/messages/send_by_phone', type: :request do
  let(:account)        { create(:account) }
  let(:whatsapp_inbox) { create(:inbox, :whatsapp, account: account) }
  let(:headers)        { api_v1_headers(account) }  # helper existente
  let(:valid_payload) do
    {
      phone:    '+51999888777',
      inbox_id: whatsapp_inbox.id,
      template_params: {
        name: 'promo_junio', language: 'es',
        processed_params: { '1' => 'Juan' }
      },
      contact_name: 'Juan Pérez'
    }
  end

  before do
    allow_any_instance_of(Whatsapp::TemplateMessageBuilder).to receive(:build)
      .and_return(content: 'Hola Juan', content_type: 'template', content_attributes: {})
    allow_any_instance_of(Whatsapp::SendOnWhatsappService).to receive(:perform)
  end

  it 'devuelve 201 y crea contact + conversation + message' do
    post '/api/v1/messages/send_by_phone', params: valid_payload, headers: headers, as: :json
    expect(response).to have_http_status(:created)
    body = JSON.parse(response.body)
    expect(body['data']).to include('conversation_id', 'message_id', 'contact_id')
    expect(body['data']['contact_created']).to be true
    expect(body['data']['conversation_created']).to be true
  end

  # ... resto de escenarios
end
```

**Verificar:** `docker exec ventia-messaging bundle exec rspec spec/requests/api/v1/messages/send_by_phone_spec.rb`

---

## Paso 3 — FastAPI proxy

### 3.1 — Pydantic schemas

**Archivo:** `apps/backend/app/schemas/messaging.py`

Agregar dos schemas nuevos (mirror del shape Rails):

```python
class SendByPhoneRequest(BaseModel):
    phone: str = Field(..., description="Teléfono en formato E.164 (+...)")
    inbox_id: int = Field(..., description="ID del inbox WhatsApp del tenant")
    template_params: TemplateParamsRequest = Field(
        ..., description="Template aprobado con parámetros resueltos"
    )
    contact_name: str | None = Field(
        None, description="Nombre opcional para el contact si se crea nuevo"
    )


class SendByPhoneResponse(BaseModel):
    success: bool
    data: dict  # { conversation_id, message_id, contact_id, contact_created, conversation_created }
    message: str | None = None
```

Reusar `TemplateParamsRequest` existente (línea 271 según grep).

### 3.2 — Método en `messaging_service`

**Archivo:** `apps/backend/app/services/messaging_service.py`

Agregar método siguiendo el patrón de `send_message`:

```python
async def send_by_phone(
    self,
    tenant_id: int,
    payload: dict,
) -> dict | None:
    """
    Proxy POST /api/v1/messages/send_by_phone hacia Rails messaging.
    """
    return await self._post(
        tenant_id=tenant_id,
        path="/api/v1/messages/send_by_phone",
        json=payload,
    )
```

(Si el helper `_post` no acepta este path exacto, ajustar siguiendo el patrón existente de otros endpoints messaging — verificar el código actual antes de codear.)

### 3.3 — Endpoint en `messaging.py`

**Archivo:** `apps/backend/app/api/v1/endpoints/messaging.py`

Agregar al final de la sección de messages:

```python
@router.post(
    "/messages/send-by-phone",
    response_model=SendByPhoneResponse,
    summary="Send WhatsApp template to a phone (creates contact/conversation if needed)",
    tags=["messaging"],
    status_code=201,
    responses={
        404: {"model": MessagingError, "description": "Inbox not found"},
        422: {"model": MessagingError, "description": "Phone invalid, inbox not WhatsApp, or template invalid"},
        503: {"model": MessagingError, "description": "Messaging service unavailable"},
    },
)
async def send_by_phone(
    payload: SendByPhoneRequest,
    current_user: User = Depends(require_permission_dual("POST", "/messaging/*")),
):
    """
    Envía un mensaje template de WhatsApp a un número telefónico. Si el contacto no
    existe, lo crea. Si no hay conversación abierta con ese número en el inbox
    especificado, crea una nueva. Devuelve los IDs creados/reusados.

    Solo aplica a inboxes de WhatsApp.
    """
    tenant_id = _resolve_tenant_id(current_user)
    result = await messaging_service.send_by_phone(tenant_id, payload.model_dump())
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")
    return result
```

Importar `SendByPhoneRequest` y `SendByPhoneResponse` en el bloque de imports al inicio del archivo.

### 3.4 — Tests del proxy

**Archivo nuevo:** `apps/backend/tests/unit/services/test_messaging_send_by_phone.py`

```python
"""Unit tests for messaging_service.send_by_phone proxy."""
import pytest
from unittest.mock import AsyncMock, patch

from app.services.messaging_service import messaging_service


class TestMessagingServiceSendByPhone:
    """US-M6: Proxy hacia Rails para send_by_phone."""

    @pytest.mark.asyncio
    async def test_send_by_phone_forwards_payload(self):
        """Verifica que el payload se forwarda intacto al Rails endpoint."""
        with patch.object(messaging_service, "_post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": {
                    "conversation_id": 456, "message_id": 789, "contact_id": 123,
                    "contact_created": True, "conversation_created": True,
                },
            }
            payload = {
                "phone": "+51999888777",
                "inbox_id": 12,
                "template_params": {"name": "promo", "language": "es", "processed_params": {"1": "X"}},
            }
            result = await messaging_service.send_by_phone(tenant_id=1, payload=payload)

            mock_post.assert_awaited_once_with(
                tenant_id=1,
                path="/api/v1/messages/send_by_phone",
                json=payload,
            )
            assert result["data"]["contact_created"] is True
```

**Archivo nuevo:** `apps/backend/tests/integration/test_send_by_phone_endpoint.py`

```python
"""Integration tests for POST /api/v1/messaging/messages/send-by-phone."""
import pytest
from unittest.mock import AsyncMock, patch

from app.core.permissions import Role


class TestSendByPhoneEndpoint:
    """US-M6: Endpoint público send-by-phone con auth + permisos."""

    def test_returns_401_without_token(self, client):
        response = client.post("/api/v1/messaging/messages/send-by-phone", json={})
        assert response.status_code == 401

    def test_returns_403_for_logistica_role(self, client, auth_header_factory):
        headers = auth_header_factory(role=Role.LOGISTICA)
        response = client.post(
            "/api/v1/messaging/messages/send-by-phone",
            json={"phone": "+51999...", "inbox_id": 1, "template_params": {...}},
            headers=headers,
        )
        assert response.status_code == 403

    def test_ventas_role_forwards_to_proxy(self, client, auth_header_factory):
        headers = auth_header_factory(role=Role.VENTAS)
        with patch("app.services.messaging_service.messaging_service.send_by_phone",
                   new_callable=AsyncMock) as mock_send:
            mock_send.return_value = {"success": True, "data": {
                "conversation_id": 1, "message_id": 1, "contact_id": 1,
                "contact_created": True, "conversation_created": True,
            }}
            response = client.post(
                "/api/v1/messaging/messages/send-by-phone",
                json={
                    "phone": "+51999888777", "inbox_id": 12,
                    "template_params": {"name": "promo", "language": "es", "processed_params": {}},
                },
                headers=headers,
            )
            assert response.status_code == 201
            mock_send.assert_awaited_once()
```

**Verificar:**
```bash
cd apps/backend && uv run pytest tests/unit/services/test_messaging_send_by_phone.py tests/integration/test_send_by_phone_endpoint.py
```

---

## Checklist de ejecución

- [ ] Crear branch `feat/send-by-phone-endpoint` desde `development`
- [ ] **1.1** Crear `app/services/conversations/ensure_from_phone_service.rb`
- [ ] **1.2** Crear `spec/services/conversations/ensure_from_phone_service_spec.rb` — tests pasan
- [ ] **2.1** Agregar acción `send_by_phone` en `MessagesController` con rescues
- [ ] **2.2** Agregar ruta `POST /messages/send_by_phone` en `routes.rb`
- [ ] **2.3** Crear `spec/requests/api/v1/messages/send_by_phone_spec.rb` — tests pasan
- [ ] **3.1** Agregar `SendByPhoneRequest` y `SendByPhoneResponse` en `schemas/messaging.py`
- [ ] **3.2** Agregar `messaging_service.send_by_phone`
- [ ] **3.3** Agregar endpoint `POST /messages/send-by-phone` en `endpoints/messaging.py`
- [ ] **3.4** Crear tests unitarios + integración FastAPI — tests pasan
- [ ] Suite completa Rails pasa: `docker exec ventia-messaging bundle exec rspec`
- [ ] Suite completa backend pasa: `cd apps/backend && uv run pytest`
- [ ] Smoke test manual con cURL contra entorno docker: 201 con phone nuevo, 422 con phone inválido
- [ ] PR con referencia al spec
