# Plan VentIA Mobile App MVP — iOS + Android

> Plan de tiempos, costos y proceso de publicación del MVP móvil de VentIA basado en fork de `chatwoot-mobile-app`. Documento generado el 2026-05-12.

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Decisiones tomadas](#2-decisiones-tomadas)
3. [Punto de partida técnico](#3-punto-de-partida-técnico)
4. [Prerrequisitos críticos (gating items)](#4-prerrequisitos-críticos-gating-items)
5. [Trabajo técnico](#5-trabajo-técnico)
6. [Anticipación de motivos de rechazo](#6-anticipación-de-motivos-de-rechazo)
7. [Timeline consolidado](#7-timeline-consolidado)
8. [Costos](#8-costos)
9. [Riesgos y mitigaciones](#9-riesgos-y-mitigaciones)
10. [Checklist pre-submission](#10-checklist-pre-submission)

---

## 1. Resumen ejecutivo

**Objetivo:** Publicar app móvil VentIA (iOS + Android) en ~6 semanas, basada en fork de `chatwoot-mobile-app`, cubriendo las 4 pantallas del mockup: Login, Conversaciones, Conversación, Info Contacto.

**Punto de partida:** El repo `chatwoot-mobile-app` ya tiene Expo SDK 52 + React Native + Redux + Firebase Messaging + Sentry. Las 4 pantallas del mockup ya existen funcionalmente. El trabajo es **forkear, rebrandear, recortar y publicar**, no construir desde cero.

**Cash-out total hasta lanzamiento:** ~$124 USD (Apple $99/año + Google Play $25 único). Sin costos recurrentes mensuales gracias a builds locales en Mac y tiers gratuitos.

**Critical path:** Desarrollo (5–6 semanas) corriendo en paralelo con D-U-N-S Number (5–30 días) y alta Apple Developer (1–7 días post D-U-N-S).

**Target de publicación:** ~30 de junio 2026 si se arranca el 18 de mayo.

---

## 2. Decisiones tomadas

| Decisión | Elección | Impacto |
|---|---|---|
| Login | Auth0 (consistente con dashboard web) | +1 semana dev vs token API Chatwoot |
| Scope MVP | 4 pantallas + push + adjuntos completos | Paridad funcional con Chatwoot original |
| Estrategia de lanzamiento | Ambas stores en paralelo | Mismo deadline; riesgo si Apple rechaza |
| Tipo de cuenta Apple | Organización VentIA | Requiere D-U-N-S; publisher dice "VentIA" |
| Builds | Locales en Mac | $0 en EAS Build; usa Xcode + Android Studio |
| Sentry | Free tier | 5k errores/mes alcanza para MVP |

---

## 3. Punto de partida técnico

**Repositorio base:** `/Users/renzolenes/Desktop/Proyectos/chatwoot-mobile-app/`

**Stack actual:**
- Expo SDK 52 (necesita upgrade a 55 para Xcode 26 / iOS 26 SDK obligatorio desde abril 2026)
- React Native con New Architecture **deshabilitada** (hay que habilitarla en SDK 55)
- React Navigation v6, Redux Toolkit, axios
- Firebase Messaging (FCM) para push
- Sentry para crash reporting
- Native modules: `ffmpeg-kit-react-native`, `@notifee/react-native`, `@react-native-firebase/*`

**Features que ya existen y vamos a mantener:**
- Login con email + password (hay que reemplazar por Auth0)
- Lista de conversaciones con tabs (Mías, Sin asignar, Todas)
- Vista de conversación con mensajes, adjuntos, audio
- Info de contacto con etiquetas
- Push notifications
- Deep linking (`chatwootapp://` → cambiar a `ventia://`)
- i18n (mantener español como idioma principal)

**Features que vamos a recortar/ocultar para MVP:**
- Notas privadas
- Multi-cuenta / switch de cuenta Chatwoot
- Conversation status workflows complejos
- Comandos de canned responses
- Configuración avanzada de perfil

**Licencia:** Chatwoot mobile es MIT (sin restricciones para fork comercial). Chatwoot core (Rails) es MPL 2.0 — no afecta a la app móvil.

---

## 4. Prerrequisitos críticos (gating items)

Estos bloquean el lanzamiento y se deben iniciar el **día 0** en paralelo al desarrollo:

| Item | Tiempo | Costo | Bloquea |
|---|---|---|---|
| **D-U-N-S Number** (dnb.com) | 5–30 días hábiles | $0 | Apple Developer Organization |
| **Apple Developer Program** (org) | 1–7 días tras D-U-N-S | $99/año | Submission iOS |
| **Google Play Console** (org) | 1–3 días + verificación ID | $25 único | Submission Android |
| **Política de Privacidad publicada** | 1–2 días redacción | $0 | Submission en ambas |
| **Assets de marca** (logo, ícono 1024×1024, splash, adaptive icon) | 3–5 días con diseñador | $300–800 opcional | Build final |
| **Cuenta demo apple-review@ventia.pe** | 1 día (tenant + datos sembrados) | $0 | Apple review |
| **Firebase Project propio para VentIA** | 1 día | $0 | Push notifications |
| **Auth0 Native Application** (configurar callbacks `ventia://`) | 1 día | $0 | Login |

**El D-U-N-S es el bottleneck no controlable.** Solicitarlo el día 1 sin excepción.

---

## 5. Trabajo técnico

### 5.1 Fork + setup inicial (semana 1)

| Tarea | Esfuerzo | Notas |
|---|---|---|
| Fork `chatwoot-mobile-app` → `ventia-mobile-app` repo propio | 0.5 día | Decidir si vive en monorepo o repo aparte |
| Cambio bundle IDs: `com.chatwoot.app` → `com.ventia.app` | 0.5 día | iOS + Android |
| Cambio scheme: `chatwootapp://` → `ventia://` | 0.5 día | Actualizar deep links e intents |
| Cambio nombre app: "Chatwoot" → "VentIA" en `app.config.ts` | 0.5 día | También strings i18n |
| Limpiar referencias a `app.chatwoot.com` y `chatwoot.com` | 1 día | Asociated domains, intent filters, URLs hardcoded |
| Configurar `expo-build-properties` y dependencias para SDK 55 | 0.5 día | Preparación |

### 5.2 Upgrade Expo SDK 52 → 55 + rebrand visual (semana 2)

| Tarea | Esfuerzo | Notas |
|---|---|---|
| Upgrade Expo SDK 52 → 55 | 2–3 días | Riesgo: ffmpeg-kit, notifee, firebase pueden romper |
| Habilitar New Architecture (`newArchEnabled: true`) | 0.5 día | Obligatorio en SDK 55 |
| Validar compilación iOS + Android local | 1 día | `pnpm run:ios` y `pnpm run:android` |
| Reemplazar assets visuales con marca VentIA (íconos, splash, adaptive) | 1 día | Generar todos los tamaños |
| Aplicar tokens de color VentIA (volt, aqua, cielo, marino, noche) | 1–2 días | Reemplazar theme |
| Tipografía y espaciados consistentes con dashboard web | 1 día | |

### 5.3 Integración con backend VentIA (semana 3)

| Tarea | Esfuerzo | Notas |
|---|---|---|
| Apuntar `API_BASE_URL` al backend Rails messaging de VentIA | 0.5 día | Variables de entorno |
| Integrar `@auth0/auth0-react-native` con PKCE | 2 días | Login flow con deep link callback |
| Configurar Universal Links (iOS) + App Links (Android) firmados | 1 día | Para callback Auth0 sin browser bounce |
| Bridge entre JWT Auth0 y session de Chatwoot Rails | 2 días | Backend Rails debe aceptar JWT Auth0 |
| Validar flujo completo de login en dispositivo físico | 1 día | iOS + Android |

### 5.4 Push, adjuntos y privacy (semana 4)

| Tarea | Esfuerzo | Notas |
|---|---|---|
| Crear Firebase project VentIA + configurar `google-services.json` y `GoogleService-Info.plist` | 0.5 día | |
| Configurar APNs cert en Apple Developer + subir a Firebase | 1 día | |
| Validar FCM tokens y registro en backend Rails | 1 día | |
| Validar notificaciones push end-to-end en dispositivo | 1 día | |
| Auditar `PrivacyInfo.xcprivacy` en TODAS las deps (`expo-doctor`) | 1–2 días | **Crítico: rechazo automático ITMS-91053 si falta** |
| Redactar Privacy Nutrition Labels en App Store Connect | 0.5 día | |
| Validar adjuntos: cámara, galería, audio, archivos | 1 día | Mantener `ffmpeg-kit` o evaluar removerlo |

### 5.5 Pulido + beta testing (semana 5)

| Tarea | Esfuerzo | Notas |
|---|---|---|
| Recortar features fuera de MVP (ocultar UI, no borrar código) | 2 días | Notas, multi-cuenta, etc. |
| Pulido UX de las 4 pantallas: estados vacíos, errores, loading | 2 días | |
| Copies en español, revisión final | 0.5 día | |
| Configurar Sentry org/project propio para VentIA | 0.5 día | Free tier |
| TestFlight interno (equipo VentIA) | 1 día | |
| Internal track Play Console (mismo equipo) | 0.5 día | |
| TestFlight externo (5–10 clientes piloto) | 1 día | Requiere review breve de Apple |
| Closed beta Play Console (mismos clientes) | 0.5 día | |
| Bug fixing intensivo sobre feedback | 2–3 días | |

### 5.6 Submission a producción (semana 6)

| Tarea | Esfuerzo | Notas |
|---|---|---|
| Build iOS local: `pnpm build:ios:local` | 0.5 día | Genera `.ipa` |
| Subir `.ipa` con Transporter.app (gratis Mac App Store) | 0.5 día | |
| Llenar metadata App Store Connect: descripción, keywords, screenshots, privacy labels, age rating | 1 día | |
| Submit for Review | 0.5 día | |
| Build Android local: `pnpm build:android:local` | 0.5 día | Genera `.aab` |
| Subir `.aab` en Play Console → Production track | 0.5 día | |
| Llenar Data Safety, Content Rating, store listing | 1 día | |
| Submit a producción | 0.5 día | |
| Monitoreo post-launch: Sentry, crash reports, reviews | continuo | |

---

## 6. Anticipación de motivos de rechazo

### Apple App Store

| # | Motivo | Prevención |
|---|---|---|
| 1 | `PrivacyInfo.xcprivacy` faltante en alguna dependencia (rechazo automático ITMS-91053) | Correr `npx expo-doctor` y auditar cada librería nativa antes de subir |
| 2 | Build con SDK pre-iOS 26 (rechazo automático desde abril 2026) | Subir a Expo SDK 55 + Xcode 26 |
| 3 | App incompleta (placeholders, "Coming soon", botones rotos) | Cualquier botón visible funciona o se oculta |
| 4 | Privacy Policy URL muerta o no enlazada dentro de la app | URL pública en App Store Connect Y dentro de Settings de la app |
| 5 | Privacy Nutrition Labels incompletas | Listar todo: email login, mensajes, attachments, push token, Sentry, Firebase |
| 6 | Falta de declaración de IA de terceros (si VentIA usa OpenAI/Anthropic) | Opt-in explícito antes de enviar datos, nombrando proveedor (regla 5.1.2(i)) |
| 7 | Credenciales demo no funcionan | Crear `apple-review@ventia.pe` con tenant sembrado y validar acceso 24h antes |
| 8 | Metadatos engañosos (screenshots de features inexistentes) | Screenshots solo del MVP real |
| 9 | Permisos sin justificación clara | Pedir cámara/mic/galería solo cuando el usuario va a usar la feature |
| 10 | Age rating sin actualizar al cuestionario 2025 | Llenar el cuestionario nuevo en App Store Connect |
| 11 | Universal Links mal configurados (login Auth0 rompe) | Validar `apple-app-site-association` accesible en `auth.ventia.pe/.well-known/` |
| 12 | HTTP no seguro (ATS) | Todas las llamadas a backend en HTTPS |

### Google Play Store

| # | Motivo | Prevención |
|---|---|---|
| 1 | Metadata engañosa o inconsistente | Descripción refleja exactamente lo que hace la app |
| 2 | Permisos sin justificación en Data Safety | Documentar uso de cada permiso |
| 3 | Política de privacidad no enlazada | URL activa en Play Console + dentro de la app |
| 4 | Content rating incorrecto | Llenar cuestionario IARC honestamente |
| 5 | App Links sin verificación (`autoVerify: true` ya configurado en `app.config.ts`) | Subir `assetlinks.json` a dominio VentIA |
| 6 | Keystore inseguro / re-firma con keystore distinto | Guardar keystore en 3 lugares (1Password + offline backup) |

---

## 7. Timeline consolidado

Asumiendo arranque **lunes 18 de mayo de 2026**:

```
Día 0 (HOY - May 18):
  ⚡ Solicitar D-U-N-S Number en dnb.com
  ⚡ Iniciar alta Google Play Console org ($25)
  ⚡ Brief de diseño: logo, ícono, splash, paleta VentIA
  ⚡ Empezar redacción Privacy Policy
  ⚡ Fork chatwoot-mobile-app → ventia-mobile-app

Semana 1 (May 18–24): Setup
  · Cambio bundle IDs, scheme, deep links
  · Cambio nombre y referencias
  · Preparación para upgrade SDK

Semana 2 (May 25–31): Upgrade + rebrand
  · D-U-N-S debería llegar esta semana
  · Upgrade Expo SDK 52 → 55
  · New Architecture habilitada
  · Rebrand visual completo
  · Iniciar alta Apple Developer org ($99)

Semana 3 (Jun 1–7): Auth0 + API
  · Integración Auth0 React Native
  · Universal Links / App Links
  · Bridge JWT ↔ Chatwoot Rails
  · API base apuntando a VentIA

Semana 4 (Jun 8–14): Push + privacy + adjuntos
  · Firebase project VentIA
  · APNs cert + push end-to-end
  · Auditoría PrivacyInfo.xcprivacy
  · Privacy Nutrition Labels
  · Validación adjuntos completos

Semana 5 (Jun 15–21): Beta testing
  · Recortar features fuera de MVP
  · Pulido UX 4 pantallas
  · TestFlight interno + externo
  · Internal + Closed track Android
  · Bug fixing con feedback de clientes piloto

Semana 6 (Jun 22–28): Submission paralela
  · Build iOS local + Transporter
  · Build Android local + Play Console
  · Submit a producción ambas
  · Google: live en 1–2 días
  · Apple: live en 3–7 días (best case) / hasta 30 días (peor caso)

🎯 Target publicación: ~30 de junio 2026
```

**Escenarios:**

| Escenario | Tiempo total | Probabilidad |
|---|---|---|
| Best case (D-U-N-S rápido, sin rechazo) | 5 semanas | ~30% |
| Caso realista (D-U-N-S 2 sem, 1 rechazo menor) | 6–7 semanas | ~50% |
| Peor caso (rechazo Apple grave + re-submit) | 8–10 semanas | ~20% |

---

## 8. Costos

### One-time

| Concepto | USD |
|---|---|
| Google Play Console (org) | $25 |
| D-U-N-S Number | $0 |
| Diseño de assets (opcional, si no hay diseñador interno) | $300–800 |
| **Total one-time** | **$25–825** |

### Recurrente

| Concepto | USD/mes | USD/año |
|---|---|---|
| Apple Developer Program | $8.25 | $99 |
| EAS Build | $0 (free tier, builds locales en Mac) | $0 |
| EAS Update (OTA) | $0 (free hasta 1k MAU) | $0 |
| Sentry (Free tier: 5k errores/mes) | $0 | $0 |
| Firebase FCM | $0 (gratis) | $0 |
| Auth0 (ya pagado para web) | $0 incremental | $0 |
| **Total recurrente** | **~$8/mes** | **$99/año** |

### Cash-out total hasta publicación

| Item | USD |
|---|---|
| Google Play | $25 |
| Apple Developer (primer pago) | $99 |
| Assets de diseño (si tercerizado) | $300–800 |
| **Total** | **$124–924** |

### Costos NO necesarios

- ❌ Mac hardware: ya se tiene laptop Mac
- ❌ EAS Build pagado: builds locales con Xcode + Android Studio
- ❌ EAS Submit pagado: Transporter.app (iOS) + Play Console web (Android) son gratis
- ❌ Apple Enterprise $299/año: solo para distribución interna, no App Store
- ❌ Mac en la nube (MacStadium, MacinCloud)
- ❌ IAP / comisiones 15–30%: VentIA es SaaS B2B con suscripción web → exención "reader/cloud app". Los clientes pagan en la web y la app es solo acceso.

---

## 9. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| D-U-N-S demora 30+ días | Bloquea Apple submission | Solicitar día 0 sin excepción. Plan B: iniciar cuenta Apple Individual y migrar a Org después. |
| Upgrade SDK 52 → 55 rompe `ffmpeg-kit` o `notifee` | Bloquea build | Probar upgrade en branch aislado primera semana. Plan B: pinear a SDK 54 si SDK 55 no estabiliza. |
| Auth0 deep link callback no funciona | Login roto | Dedicar 1 día completo de QA cross-device antes de seguir |
| Apple rechaza por SDK pre-26 mal compilado | +1–2 semanas re-submit | Validar en TestFlight externo primero (review breve pero existe) |
| Google live pero Apple no | Mensaje inconsistente al cliente | Preparar mensajería de marketing que enfatice Android primero |
| Universal Links / App Links no verificados | Auth0 callback rebota al browser | Configurar `apple-app-site-association` y `assetlinks.json` en `auth.ventia.pe` |
| Keystore Android perdido | NUNCA poder actualizar la app | Guardar en 1Password + backup offline (USB cifrado) |
| `PrivacyInfo.xcprivacy` faltante en una lib | Rechazo automático ITMS-91053 | Auditar con `expo-doctor` antes de cada submission |
| Rate limit en backend Rails con tráfico push | Notificaciones perdidas | Monitorear con Sentry tras lanzamiento |
| Bundle iOS muy pesado por `ffmpeg-kit` (~50MB) | Mala experiencia descarga | Evaluar si conversión de audio es realmente necesaria en MVP |

---

## 10. Checklist pre-submission

### Antes de hacer Submit en Apple

- [ ] Build compilado con Xcode 26 / iOS 26 SDK
- [ ] `newArchEnabled: true` en `app.config.ts`
- [ ] `PrivacyInfo.xcprivacy` presente en todas las deps nativas
- [ ] Privacy Policy URL accesible y enlazada dentro de la app
- [ ] Privacy Nutrition Labels completas en App Store Connect
- [ ] Cuenta demo `apple-review@ventia.pe` funcional con datos sembrados
- [ ] Screenshots para todos los tamaños de iPhone requeridos
- [ ] Age rating actualizado al cuestionario 2025
- [ ] Export compliance respondido (`ITSAppUsesNonExemptEncryption: false` ya está)
- [ ] Universal Links verificados (`apple-app-site-association` en `auth.ventia.pe`)
- [ ] Probado en TestFlight con al menos 3 dispositivos físicos
- [ ] Si usa IA: opt-in explícito declarando proveedor (Anthropic/OpenAI)
- [ ] Sentry capturando crashes correctamente
- [ ] Push notifications funcionando en producción APNs

### Antes de hacer Submit en Google

- [ ] AAB firmado con keystore guardado en 3 lugares
- [ ] `targetSdkVersion: 35` (ya configurado)
- [ ] App Links verificados (`assetlinks.json` en `auth.ventia.pe`)
- [ ] Data Safety completo en Play Console
- [ ] Content Rating Questionnaire IARC completo
- [ ] Privacy Policy URL accesible
- [ ] Screenshots, feature graphic, ícono 512×512
- [ ] Probado en Internal Track con equipo
- [ ] Probado en Closed Beta con clientes piloto
- [ ] FCM funcionando en producción

---

## Anexo A: Comandos clave (builds locales)

```bash
# Desarrollo
cd ventia-mobile-app
pnpm install
pnpm start                    # Metro bundler
pnpm run:ios                  # Run en dispositivo iOS conectado
pnpm run:android              # Run en dispositivo Android conectado

# Build producción local (en Mac)
pnpm build:ios:local          # Genera .ipa en raíz del proyecto
pnpm build:android:local      # Genera .aab en raíz del proyecto

# Validación
npx expo-doctor               # Detecta privacy manifests faltantes y otros issues
pnpm lint
pnpm test

# Submission manual
# iOS: abrir Transporter.app, drag & drop el .ipa
# Android: subir el .aab manualmente en Play Console
```

## Anexo B: Fuentes y referencias

Las políticas, costos y procesos descritos están basados en documentación oficial de Apple y Google a mayo 2026. Las políticas se actualizan frecuentemente — siempre verificar antes de submission:

- Apple Developer Program: https://developer.apple.com/programs/
- App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Google Play Console: https://support.google.com/googleplay/android-developer/
- Expo SDK 55 docs: https://docs.expo.dev/
- Auth0 React Native: https://auth0.com/docs/quickstart/native/react-native
