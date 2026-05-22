# Plan: Resolver Vulnerabilidades Dependabot

## Contexto

GitHub reporta 41 vulnerabilidades (17 high, 20 moderate, 4 low) en la rama `main`. Son todas en dependencias, no en nuestro código.

**Importante**: Los cambios deben llegar a `main` para que Dependabot las cierre.

## Validación de compatibilidad

Se validó cada update contra el código del proyecto. Resultado:

| Update | Riesgo | Decisión |
|--------|--------|----------|
| python-jose → PyJWT | **CRÍTICO** | **NO HACER** — auth.py usa `CryptographyRSAKey/ECKey` de jose para JWK→PEM. PyJWT no tiene esas clases. Rompería Auth0. |
| Next.js patch | Bajo | Ya estamos en 16.1.6 (última). Esperar patch de Next.js. |
| Deps npm transitivas | Medio | Safe con regeneración de lockfile |
| Deps Python (cryptography, etc.) | Bajo | Safe — updates menores |
| Remover package-lock.json | Bajo | Safe — son duplicados de pnpm |

---

## Paso 1: Crear branch desde main

```bash
git checkout main
git pull origin main
git checkout -b fix/dependabot-vulnerabilities
```

---

## Paso 2: Limpiar lockfiles duplicados (resuelve ~8 alertas duplicadas)

```bash
# Eliminar package-lock.json duplicados — pnpm es el package manager
rm -f apps/frontend/package-lock.json
rm -f package-lock.json
```

Esto elimina las alertas que se reportan doblemente (una vez en pnpm-lock.yaml, otra en package-lock.json).

---

## Paso 3: Frontend — Actualizar dependencias npm transitivas

### 3.1 Agregar overrides en el package.json raíz

Las dependencias vulnerables son transitivas (no directas). `pnpm.overrides` fuerza versiones seguras:

```json
{
  "pnpm": {
    "overrides": {
      "flatted": ">=3.3.3",
      "minimatch": ">=5.1.6",
      "picomatch": ">=4.0.2",
      "brace-expansion": ">=2.0.2"
    }
  }
}
```

> **Nota**: `ajv@6` es requerida por ESLint. No forzar a v8 — rompe eslint-config-next. Riesgo aceptable (ReDoS solo con input malicioso en schemas).

### 3.2 Regenerar lockfile

```bash
pnpm install
```

### 3.3 Verificar build

```bash
cd apps/frontend
pnpm build
pnpm lint
```

Si algún override causa incompatibilidad, removerlo del bloque y probar de nuevo.

---

## Paso 4: Backend — Actualizar dependencias Python

### 4.1 Actualizar constraint de cryptography

En `apps/backend/pyproject.toml`:
```toml
# Antes:
"cryptography>=41.0.0",

# Después:
"cryptography>=44.0.0",
```

> Ya resuelve a 46.0.3 en el lock. Solo actualiza el constraint mínimo.

### 4.2 Actualizar dependencias transitivas

```bash
cd apps/backend
uv lock --upgrade-package cryptography
uv lock --upgrade-package pyasn1
uv lock --upgrade-package requests
uv lock --upgrade-package Pygments
```

### 4.3 Verificar

```bash
uv run pytest
uv run ruff check .
```

---

## Paso 5: Commit y PR a main

```bash
git add -A
git commit -m "fix: resolve Dependabot security vulnerabilities

- Remove duplicate package-lock.json files
- Add pnpm overrides for vulnerable transitive deps (flatted, minimatch, picomatch, brace-expansion)
- Update cryptography constraint to >=44.0.0
- Upgrade pyasn1, requests, Pygments to patched versions"

git push origin fix/dependabot-vulnerabilities
gh pr create --base main --title "fix: resolve Dependabot security vulnerabilities"
```

---

## Resumen de impacto

| Acción | Alertas resueltas | Riesgo |
|--------|-------------------|--------|
| Eliminar package-lock.json duplicados | ~8 | Ninguno |
| pnpm overrides (flatted, minimatch, picomatch, brace-expansion) | ~15 | Bajo |
| Update cryptography >=44.0.0 | 2 | Bajo |
| Update pyasn1, requests, Pygments | 3 | Bajo |
| **Total resueltas** | **~28** | |

## Alertas que NO se resuelven (riesgo aceptado)

| Alerta | Razón |
|--------|-------|
| Next.js CVEs (~10) | No hay patch en 16.x aún. Esperar release de Next.js. |
| ecdsa (2 — timing attack P-256) | Dependencia transitiva de python-jose. No se puede remover sin reescribir auth.py. Riesgo bajo: requiere acceso local para explotar. |
| ajv ReDoS (1) | Requerido por eslint-config-next. v8 rompe ESLint. Riesgo bajo: solo con schemas maliciosos. |
