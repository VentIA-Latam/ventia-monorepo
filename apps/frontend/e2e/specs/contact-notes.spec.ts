import { test, expect } from "../fixtures/pages.fixture";
import {
  E2E_NOTE_PREFIX,
  type ContactSnapshot,
  deleteNotesByPrefix,
  findContactByPhone,
  getAccessToken,
  makeTestNoteContent,
} from "../fixtures/contacts-api";

const CONTACT_PHONE = "+51904890457";

// Estos specs mutan el mismo contacto que `contact-edit.spec.ts`, así que
// corren secuencialmente para evitar races (correr con `--workers=1`).
test.describe.configure({ mode: "serial" });

test.describe("Notas del contacto @contacts @notes @smoke", () => {
  let token: string;
  let snapshot: ContactSnapshot;

  test.beforeEach(async ({ page, conversationsPage, contactInfoPanelPage }) => {
    token = await getAccessToken(page);
    const found = await findContactByPhone(page.request, token, CONTACT_PHONE);
    if (!found) {
      throw new Error(
        `Contacto ${CONTACT_PHONE} no encontrado. Configurá el seed dev.`
      );
    }
    snapshot = found;

    // Cleanup previo: borrar notas residuales de corridas anteriores
    await deleteNotesByPrefix(page.request, token, snapshot.id, E2E_NOTE_PREFIX);

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
    await contactInfoPanelPage.enterEditMode();
  });

  test.afterEach(async ({ page }) => {
    // Cleanup de notas creadas durante el test (matchean prefix)
    if (token && snapshot) {
      await deleteNotesByPrefix(page.request, token, snapshot.id, E2E_NOTE_PREFIX);
    }
  });

  test("crear una nota la agrega a la lista y resetea el textarea", async ({
    contactInfoPanelPage,
  }) => {
    const content = makeTestNoteContent("create");
    await contactInfoPanelPage.createNote(content);

    await expect(contactInfoPanelPage.noteByContent(content)).toBeVisible();
  });

  test("editar el contenido de una nota lo actualiza", async ({
    contactInfoPanelPage,
  }) => {
    const original = makeTestNoteContent("edit-original");
    const updated = makeTestNoteContent("edit-updated");

    await contactInfoPanelPage.createNote(original);
    await contactInfoPanelPage.editNote(original, updated);

    await expect(contactInfoPanelPage.noteByContent(updated)).toBeVisible();
    await expect(contactInfoPanelPage.noteByContent(original)).toHaveCount(0);
  });

  test("eliminar una nota la quita de la lista tras confirmar el dialog", async ({
    contactInfoPanelPage,
  }) => {
    const content = makeTestNoteContent("delete");
    await contactInfoPanelPage.createNote(content);

    await contactInfoPanelPage.deleteNote(content);

    await expect(contactInfoPanelPage.noteByContent(content)).toHaveCount(0);
  });
});
