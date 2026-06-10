import { test, expect } from "../fixtures/pages.fixture";
import {
  type ContactSnapshot,
  findContactByPhone,
  getAccessToken,
  restoreContact,
} from "../fixtures/contacts-api";

// Contacto de prueba estable del seed dev. Restauramos su state en afterEach.
const CONTACT_PHONE = "+51904890457";

// Estos specs mutan el mismo contacto que `contact-notes.spec.ts`, así que
// corren secuencialmente para evitar races (correr con `--workers=1`).
test.describe.configure({ mode: "serial" });

test.describe("Editar contacto desde el panel @contacts @smoke", () => {
  let token: string;
  let snapshot: ContactSnapshot;

  test.beforeEach(async ({ page, conversationsPage, contactInfoPanelPage }) => {
    // 1. Token y snapshot del estado original via API
    token = await getAccessToken(page);
    const found = await findContactByPhone(page.request, token, CONTACT_PHONE);
    if (!found) {
      throw new Error(
        `Contacto ${CONTACT_PHONE} no encontrado en el seed. Configurá el seed dev primero.`
      );
    }
    snapshot = found;

    // 2. Abrir la conversación del contacto y el panel de información
    await conversationsPage.goto();
    await conversationsPage.selectConversation(snapshot.name ?? CONTACT_PHONE);

    // Abrir info panel via menú 3-dot del MessageView (patrón WhatsApp)
    await page
      .getByRole("button", { name: "Más opciones del chat" })
      .click();
    await page
      .getByRole("menuitem", { name: /informaci[oó]n del contacto/i })
      .click();

    await contactInfoPanelPage.expectViewMode();
  });

  test.afterEach(async ({ page }) => {
    // Restaurar el contacto a su estado original
    if (token && snapshot) {
      await restoreContact(page.request, token, snapshot);
    }
  });

  test("editar nombre y guardar persiste el cambio", async ({
    contactInfoPanelPage,
    page,
  }) => {
    const newName = `${snapshot.name ?? "Test"} (edited)`;

    await contactInfoPanelPage.enterEditMode();
    await contactInfoPanelPage.setName(newName);
    await contactInfoPanelPage.save();

    // Panel vuelve a modo lectura con el nuevo nombre
    await contactInfoPanelPage.expectViewMode();
    await expect(page.getByText(newName).first()).toBeVisible();
  });

  test("email inválido bloquea el submit y muestra error inline", async ({
    contactInfoPanelPage,
    page,
  }) => {
    await contactInfoPanelPage.enterEditMode();
    await contactInfoPanelPage.setEmail("no-es-email");
    await contactInfoPanelPage.save();

    // El form NO debe pasar a modo lectura — sigue en edit y muestra el error
    await expect(page.getByText(/email no v[aá]lido/i)).toBeVisible();
    await contactInfoPanelPage.expectEditMode();
  });

  test("cancelar con cambios muestra dialog de descartar", async ({
    contactInfoPanelPage,
  }) => {
    await contactInfoPanelPage.enterEditMode();
    await contactInfoPanelPage.setName(`${snapshot.name ?? "Test"} (dirty)`);
    await contactInfoPanelPage.cancel();

    await contactInfoPanelPage.expectDiscardDialogVisible();
    await contactInfoPanelPage.confirmDiscard();

    // Vuelve a vista lectura sin haber guardado nada
    await contactInfoPanelPage.expectViewMode();
  });

  test("editar birthdate via Calendar y verificar persistencia", async ({
    contactInfoPanelPage,
    page,
  }) => {
    await contactInfoPanelPage.enterEditMode();
    await contactInfoPanelPage.openBirthdatePicker();
    await contactInfoPanelPage.selectDate("1995-03-12");
    await contactInfoPanelPage.save();

    // Modo lectura muestra la fecha formateada en español ("12 mar 1995").
    await expect(page.getByText(/12 mar\.? 1995/i)).toBeVisible();
  });
});
