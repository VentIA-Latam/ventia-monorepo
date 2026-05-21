# frozen_string_literal: true
#
# Script de datos de prueba masivos para Nassau (ventia_tenant_id=2)
# Uso: docker exec ventia-messaging rails runner script/seed_volume_data.rb
#
# Genera:
#   - 1 inbox WhatsApp (si no existe)
#   - 80 contactos con teléfonos peruanos
#   - 80 conversaciones (una por contacto)
#   - 80–180 mensajes por conversación (~10 000 mensajes total)
#
# Diseñado para probar búsqueda + navegación:
# los mensajes más antiguos quedan FUERA de la ventana inicial de 20,
# forzando el flujo navigateToMessage.

puts "=== Seed de volumen para Nassau ==="

# ── 1. Encontrar / crear Account ────────────────────────────────────────────

account = Account.find_by(ventia_tenant_id: 2)
if account.nil?
  account = Account.create!(
    name:             "Nassau",
    ventia_tenant_id: 2,
    locale:           "es",
    status:           0
  )
  puts "Account creada: id=#{account.id}"
else
  puts "Account existente: id=#{account.id} (#{account.name})"
end

# ── 2. Encontrar / crear User ────────────────────────────────────────────────

messaging_user = User.find_by(ventia_user_id: 2)
if messaging_user.nil?
  messaging_user = User.create!(
    ventia_user_id: 2,
    name:           "Renzo Lenes",
    email:          "renzolenes0@gmail.com",
    pubsub_token:   SecureRandom.hex(16)
  )
  puts "User creado: id=#{messaging_user.id}"
else
  puts "User existente: id=#{messaging_user.id} (#{messaging_user.name})"
end

# Asegurar account_user
unless AccountUser.exists?(account_id: account.id, user_id: messaging_user.id)
  AccountUser.create!(
    account_id:   account.id,
    user_id:      messaging_user.id,
    role:         1,  # administrator
    availability: 0   # online
  )
  puts "AccountUser creado"
end

# ── 3. Encontrar / crear Inbox WhatsApp ─────────────────────────────────────

inbox = Inbox.where(account_id: account.id).first
if inbox.nil?
  channel = ChannelWhatsapp.create!(
    phone_number:    "+51900000001",
    provider:        "whatsapp_cloud",
    provider_config: { access_token: "SEED_TOKEN", phone_number_id: "SEED_PHONE_ID" },
    account_id:      account.id
  )
  inbox = Inbox.create!(
    name:         "WhatsApp Nassau",
    channel_type: "Channel::Whatsapp",
    channel_id:   channel.id,
    account_id:   account.id
  )
  puts "Inbox creado: id=#{inbox.id}"
else
  puts "Inbox existente: id=#{inbox.id} (#{inbox.name})"
end

# ── 4. Datos de contenido realista ──────────────────────────────────────────

NOMBRES = %w[
  Ana\ Quispe Carla\ Torres Diego\ Mamani Fernanda\ Ríos Gabriela\ Chávez
  Hugo\ Paredes Isabel\ Condori Juan\ Flores Karla\ Medina Luis\ Huanca
  María\ Vargas Nicolás\ Soto Olivia\ Prado Patricia\ Ruiz Roberto\ Lazo
  Sandra\ Cáceres Tomás\ Vega Ursula\ Salas Verónica\ Castro Walter\ Díaz
  Xiomara\ Espinoza Yolanda\ Mora Zara\ Pillco Alberto\ Ramos Beatriz\ Cruz
  César\ Lozano Diana\ Meza Eduardo\ Arce Fiorella\ Benítez Giovanna\ León
  Hernán\ Tapia Ingrid\ Ochoa Jorge\ Salinas Karen\ Mendoza Lorenzo\ Apaza
  Miriam\ Herrera Néstor\ Cano Ofelia\ Zuñiga Pedro\ Quispe Renata\ Delgado
  Sofía\ Bravo Tadeo\ Mejía Ursula\ Porras Valentina\ Figueroa Wilmer\ Rojas
  Ximena\ Núñez Yuri\ Coronel Zeida\ Pacheco Andrés\ Fuentes Blanca\ Reyes
  Camilo\ Ortega Daniela\ Peralta Emilio\ Villanueva Fabiola\ Serrano
  Gonzalo\ Alvarado Helena\ Ibáñez Iván\ Alonzo Jimena\ Becerra Kevin\ Nieto
  Lorena\ Campos Manuel\ Estrada Nancy\ Hidalgo Omar\ Quijano Paula\ Ríos
  Quincy\ Saldaña Rosa\ Terán Sebastián\ Urquizo Teresa\ Valdivia Ulises\ Wong
  Violeta\ Yépez Wendy\ Zelada Alicia\ Aguilar Bernardo\ Báez Cristina\ Celi
  Daniel\ Domínguez Elisa\ Espejo Fabricio\ Fuentes Gisela\ García
].map { |n| n.gsub("\\", " ") }

PRODUCTOS = [
  "vestido floral talla M", "blusa de lino blanca", "jeans skinny azul",
  "zapatos de tacón negro talla 37", "bolso de cuero marrón", "polo básico blanco",
  "falda midi beige", "chaqueta de jean talla S", "sandalias doradas talla 38",
  "vestido de noche rojo talla L", "conjunto deportivo gris", "cartera mini negra",
  "blusa estampada talla XS", "pantalón palazzo verde", "zapatillas blancas talla 39",
  "polo oversize rosado", "shorts de tela talla M", "vestido casual azul talla S",
  "cinturón de cuero negro", "bufanda de seda beige"
]

DISTRITOS = %w[Miraflores\ Lima San\ Isidro\ Lima Barranco\ Lima
               Surco\ Lima La\ Molina\ Lima Jesus\ Maria\ Lima
               Pueblo\ Libre\ Lima Magdalena\ Lima Lince\ Lima San\ Borja\ Lima]
             .map { |d| d.gsub("\\", " ") }

CONVERSACION_TEMAS = [
  -> (p, d) { ["Hola! Quería preguntar por el #{p}, ¿lo tienen disponible?",
               "Sí, tenemos stock. ¿En qué talla lo necesitas?",
               "Perfecto, lo quiero en talla M. ¿Cuánto cuesta el envío a #{d}?",
               "El envío a #{d} tiene un costo de S/ 8. Llega en 1-2 días hábiles.",
               "Genial! Quiero hacer el pedido. ¿Cómo pago?",
               "Puede pagar por Yape, Plin o transferencia bancaria.",
               "Voy a pagar por Yape ahora mismo.",
               "Perfecto, en cuanto confirme el pago procesamos el pedido.",
               "Ya pagué! Te mando el voucher.",
               "Recibido. Su pedido ##{rand(1000..9999)} está confirmado. Gracias por su compra en Nassau!"] },

  -> (p, d) { ["Buenos días, hice un pedido ayer del #{p} y aún no me llega",
               "Buenos días! Déjame verificar su pedido. ¿Podría darme su número de orden?",
               "Claro, es el pedido ##{rand(1000..9999)}",
               "Revisando su pedido... ya fue despachado ayer a las 3pm desde nuestro almacén.",
               "Ah entiendo, ¿y cuándo llega exactamente a #{d}?",
               "Para #{d} el estimado es hoy entre 2pm y 6pm. El repartidor lo contactará.",
               "Ok gracias. Ojalá llegue pronto porque lo necesito para mañana.",
               "Entendemos la urgencia. Si tiene algún inconveniente con la entrega escríbanos.",
               "Llegó! Muchas gracias, el #{p} es precioso.",
               "Nos alegra mucho! Gracias por comprar en Nassau. 😊"] },

  -> (p, d) { ["Hola, quiero cambiar el #{p} que compré, me llegó la talla equivocada",
               "Lamentamos el inconveniente. ¿Qué talla le llegó y cuál necesita?",
               "Me llegó talla S pero yo pedí M",
               "Entendido. Podemos hacer el cambio sin costo. ¿Está disponible en #{d}?",
               "Sí, estoy en #{d} todo el día de mañana.",
               "Perfecto, mañana entre 10am y 12pm pasará nuestro courier a recoger la prenda.",
               "¿Y cuándo me llega la talla M?",
               "Una vez recibamos la devolución, enviamos la talla correcta en 24 horas.",
               "Ok, perfecto. Esperaré al courier mañana entonces.",
               "Coordinado! Tenga a mano el producto empacado como lo recibió. Gracias."] },

  -> (p, d) { ["Buenas tardes! ¿Tienen el #{p} en color negro?",
               "Buenas! Déjame verificar el stock. Un momento por favor.",
               "Claro, tómate tu tiempo.",
               "Sí tenemos en negro, es el último disponible actualmente.",
               "Perfecto! Lo quiero, ¿me lo pueden apartar?",
               "Podemos apartarlo por 2 horas mientras realiza el pago.",
               "Listo, acabo de hacer el Yape. Ya te mando foto.",
               "Recibido el pago de S/ #{rand(80..350)}. Apartado y procesando tu pedido para #{d}.",
               "Excelente! ¿En cuánto tiempo llega?",
               "Para #{d} normalmente llega al día siguiente hábil. Te avisamos cuando salga."] },

  -> (p, d) { ["Necesito una factura por la compra del #{p}",
               "Con gusto! ¿Me puede dar su RUC y razón social?",
               "RUC: 20#{rand(100_000_000..999_999_999)}, razón social: #{['Inversiones Lima SAC', 'Comercial Sur EIRL', 'Textiles Norte SAC'].sample}",
               "Perfecto, emitiremos la factura electrónica a ese RUC.",
               "¿Cuándo la recibiría?",
               "La factura se envía al correo registrado dentro de las próximas 2 horas.",
               "Mi correo es facturacion@empresa.com",
               "Anotado. Ya tenemos el registro de su compra del #{p}.",
               "Gracias, quedo pendiente del correo.",
               "Listo! La factura ya fue enviada. Cualquier consulta con gusto."] },

  -> (p, d) { ["Oye me regalaron el #{p} pero no me queda, ¿puedo cambiarlo?",
               "Claro! ¿Tienes el comprobante de compra o el número de orden?",
               "No tengo nada, me lo regalaron en una bolsa de Nassau sin ticket",
               "No hay problema, verificamos por el número de teléfono del comprador.",
               "Ah ok, sería el cel de mi amiga: #{format('%09d', rand(900_000_000..999_999_999))}",
               "Encontramos el pedido. ¿A qué talla o color deseas cambiarlo?",
               "¿Tienen ese mismo modelo en azul talla L?",
               "Sí tenemos. ¿Dónde quedamos para el cambio? Tenemos tienda en #{d}.",
               "Puedo ir mañana al mediodía",
               "Perfecto! Preséntate con la prenda y mencionas que vas por cambio. Te esperamos 😊"] },
]

MENSAJES_ADICIONALES = [
  "¿Tienen más colores disponibles?",
  "¿Aceptan tarjeta de crédito?",
  "¿Cuál es el horario de atención?",
  "Gracias por la atención, excelente servicio!",
  "¿Tienen descuento para compras al por mayor?",
  "¿Puedo ver más fotos del producto?",
  "¿Hacen envíos a provincias?",
  "¿Cuánto demora el envío a Arequipa?",
  "Me encantó el producto, ya te seguí en Instagram",
  "¿Tienen el mismo modelo en talla XL?",
  "¿Puedo pagar contraentrega?",
  "¿Cuál es su dirección de tienda?",
  "Perfecto, muchas gracias!",
  "Una consulta más, ¿tienen garantía?",
  "¿Puedo ver el catálogo completo?",
  "Sí, estoy interesada en hacer un pedido",
  "¿Tienen el vestido en talla 38?",
  "¿Hacen envíos el mismo día?",
  "Recibí mi pedido y estoy muy contenta, gracias!",
  "¿Tienen programa de puntos o fidelidad?",
  "¿Cuánto tarda el cambio de mercadería?",
  "Ok, me quedó claro. Procedo con el pago.",
  "Ya hice el depósito, adjunto comprobante.",
  "¿Me pueden dar factura?",
  "¿Tienen stock del vestido floral?",
  "Hola! ¿Siguen atendiendo?",
  "Buenas noches, necesito ayuda con mi pedido",
  "¿Cuándo sale mi pedido?",
  "El repartidor no llegó en el horario acordado",
  "Ya recibí el paquete, todo perfecto!",
]

# ── 5. Crear contactos, conversaciones y mensajes ───────────────────────────

CONTACTOS_A_CREAR = 80
MSGS_MIN           = 80
MSGS_MAX           = 180

puts "\nCreando #{CONTACTOS_A_CREAR} contactos y conversaciones..."

created_contacts = 0
created_convs    = 0
created_msgs     = 0
skipped          = 0

CONTACTOS_A_CREAR.times do |i|
  nombre = NOMBRES[i % NOMBRES.size]
  phone  = "+519#{format('%08d', rand(10_000_000..99_999_999))}"

  # Evitar duplicados por teléfono
  contact = Contact.find_by(phone_number: phone, account_id: account.id)
  if contact.nil?
    contact = Contact.create!(
      name:         nombre,
      phone_number: phone,
      account_id:   account.id
    )
    created_contacts += 1
  else
    skipped += 1
  end

  # contact_inbox
  ci = ContactInbox.find_or_create_by!(
    contact_id: contact.id,
    inbox_id:   inbox.id
  ) do |c|
    c.source_id = phone
  end

  # Conversación (1 activa por contacto por inbox)
  conv = Conversation.find_by(contact_inbox_id: ci.id, account_id: account.id)
  if conv.nil?
    conv = Conversation.create!(
      account_id:       account.id,
      inbox_id:         inbox.id,
      contact_id:       contact.id,
      contact_inbox_id: ci.id,
      assignee_id:      messaging_user.id,
      status:           [0, 0, 0, 1, 2].sample,  # mayoría open
      ai_agent_enabled: [true, false].sample,
      last_activity_at: rand(1..30).days.ago,
      created_at:       rand(30..180).days.ago
    )
    created_convs += 1
  end

  # ── Mensajes ──────────────────────────────────────────────────────────────
  num_msgs = rand(MSGS_MIN..MSGS_MAX)
  producto = PRODUCTOS.sample
  distrito = DISTRITOS.sample

  # Hilo base: 10 mensajes del tema elegido
  hilo = CONVERSACION_TEMAS.sample.call(producto, distrito)

  # Mensajes adicionales para llegar al volumen deseado
  extras = Array.new(num_msgs - hilo.size) { MENSAJES_ADICIONALES.sample }
  todos  = hilo + extras

  # Fechas: distribuidas en los últimos 6 meses
  conv_age_days = rand(30..180)
  msg_rows = todos.each_with_index.map do |contenido, idx|
    # Conversación alternada: pares=incoming (cliente), impares=outgoing (agente)
    msg_type = idx.even? ? 0 : 1  # 0=incoming, 1=outgoing
    sender_type = msg_type == 0 ? "Contact" : "User"
    sender_id   = msg_type == 0 ? contact.id : messaging_user.id

    # Timestamp: más antiguo primero, con pequeñas variaciones
    offset_hours = (conv_age_days * 24) - (idx * rand(1..6))
    ts = Time.current - [offset_hours, 0].max.hours

    {
      content:                   contenido,
      processed_message_content: contenido,
      message_type:              msg_type,
      content_type:              0,  # text
      status:                    2,  # read
      private:                   false,
      sender_type:               sender_type,
      sender_id:                 sender_id,
      account_id:                account.id,
      inbox_id:                  inbox.id,
      conversation_id:           conv.id,
      created_at:                ts,
      updated_at:                ts
    }
  end

  # Insertar en lotes de 500
  msg_rows.each_slice(500) do |batch|
    Message.insert_all!(batch)
  end

  created_msgs += msg_rows.size

  print "." if (i + 1) % 10 == 0
end

puts "\n\n=== Resultado ==="
puts "Contactos creados:      #{created_contacts}"
puts "Skipped (duplicados):   #{skipped}"
puts "Conversaciones creadas: #{created_convs}"
puts "Mensajes insertados:    #{created_msgs}"
puts ""
puts "Account id:  #{account.id}  (ventia_tenant_id=2)"
puts "Inbox id:    #{inbox.id}"
puts "User id:     #{messaging_user.id}  (ventia_user_id=2)"
puts ""
puts "Palabras clave para buscar (prueba de navegación):"
puts "  vestido, bolso, zapatos, envío, pedido, factura, cambio, Yape, Nassau"
puts ""
puts "NOTA: los mensajes más antiguos quedan fuera de la ventana inicial (20 msgs),"
puts "      lo que ejercita el flujo de navegación a mensajes no cargados."
puts ""
puts "Ejecuta los seeds principales si aún no existen datos base:"
puts "  docker exec ventia-messaging rails db:seed"
