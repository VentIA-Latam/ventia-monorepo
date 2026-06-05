import { test, expect } from "../fixtures/pages.fixture";

// MessagingProvider tiene un detector de "hibernación larga" que recarga la
// página cuando pasaron más de STALE_THRESHOLD_MS (3h) sin actividad. Combina
// dos señales: un setInterval cada 60s que mide el delta de Date.now() entre
// ticks (detecta PC suspendida) y un listener de `visibilitychange` que dispara
// el mismo chequeo inmediatamente al volver a la tab.
//
// Limitación de testing E2E: el clock virtual de Playwright (`page.clock`)
// no reproduce el throttling del navegador real. Cuando la PC suspende, los
// ticks del setInterval se PAUSAN y al despertar hay un único callback con
// delta enorme → reload. Con `fastForward` Playwright ejecuta los ticks
// intermedios uno por uno (cada uno con delta=60s), nunca acumula gap, y
// con `setSystemTime` re-programa el siguiente tick desde el nuevo time,
// con efectos secundarios sobre otros effects del provider que disparan
// reloads reales (rompiendo el reemplazo de window.location.reload del test).
//
// Por eso este spec sólo cubre lo verificable con confianza:
// 1) el provider monta (smoke test).
//
// El comportamiento de reload se valida MANUALMENTE: bajar STALE_THRESHOLD_MS
// a 60_000 en el provider, levantar dev, ocultar la tab por 2 min, volver.
// Debe recargar. Después restaurar el threshold a 3h.

test.describe("MessagingProvider — detector de hibernación @hibernation", () => {
  test("la página de conversaciones monta con el provider activo", async ({
    page,
  }) => {
    await page.goto("/dashboard/conversations");

    // Si el layout y el provider montaron, el sidebar y el título de la página
    // están visibles. La hidratación del provider corre el useEffect que
    // registra setInterval + visibilitychange, así que el detector está activo.
    await expect(page.getByRole("link", { name: /conversaciones/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  // Tests del reload real omitidos intencionalmente. Ver bloque de comentario
  // arriba para el por qué y la verificación manual recomendada.
  test.fixme(
    "el setInterval detecta inactividad >3h y dispara reload (PC suspendida)",
    async () => {}
  );

  test.fixme(
    "volver a la tab tras 3h+ hidden dispara reload por visibilitychange",
    async () => {}
  );
});
