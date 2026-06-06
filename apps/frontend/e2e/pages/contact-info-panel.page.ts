import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object para el ContactInfoPanel del panel de conversaciones.
 *
 * Selectores semánticos preferidos (role/label/text), sin testids. El componente
 * tiene aria-labels en los icon buttons (Editar contacto, Editar nota, Eliminar nota)
 * y los inputs del form están asociados con <Label htmlFor>.
 */
export class ContactInfoPanelPage {
  readonly page: Page;

  // Vista lectura
  readonly headerView: Locator;
  readonly editButton: Locator;
  readonly notesSectionHeader: Locator;

  // Vista edición
  readonly headerEdit: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly phoneInput: Locator;
  readonly footerCancelButton: Locator;
  readonly footerSaveButton: Locator;
  readonly newNoteTextarea: Locator;
  readonly addNoteButton: Locator;

  // Dialogos
  readonly discardDialog: Locator;
  readonly deleteDialog: Locator;

  constructor(page: Page) {
    this.page = page;

    // El header en modo view tiene el texto exacto "Información".
    this.headerView = page.getByText("Información", { exact: true });

    // Botón ✎ Editar — aria-label="Editar contacto"
    this.editButton = page.getByRole("button", { name: "Editar contacto" });

    // Sección notas (puede aparecer con "Notas" o "Notas (N)") → tomamos el primero
    // dentro del aside que es el panel.
    this.notesSectionHeader = page
      .getByText(/^Notas(\s*\(\d+\))?$/)
      .first();

    // Header en modo edit
    this.headerEdit = page.getByText("Editar contacto", { exact: true });

    // Inputs del form (asociados via <Label htmlFor>)
    this.nameInput = page.getByLabel("Nombre", { exact: true });
    this.emailInput = page.getByLabel("Email", { exact: true });
    this.phoneInput = page.getByLabel("Teléfono", { exact: true });

    // Footer fijo del panel en modo edit. Los botones tienen texto exacto.
    // No los confundimos con otros "Cancelar"/"Guardar" porque solo existen en
    // este footer cuando estamos en edit mode.
    this.footerCancelButton = page.getByRole("button", {
      name: "Cancelar",
      exact: true,
    });
    this.footerSaveButton = page.getByRole("button", {
      name: "Guardar",
      exact: true,
    });

    // Textarea de nueva nota (placeholder cambia según haya o no notas).
    this.newNoteTextarea = page.getByPlaceholder(
      /Escribir (la primera|nueva) nota/i
    );
    this.addNoteButton = page.getByRole("button", { name: "Agregar" });

    // AlertDialogs por texto del título.
    this.discardDialog = page
      .getByRole("alertdialog")
      .filter({ hasText: "Descartar cambios" });
    this.deleteDialog = page
      .getByRole("alertdialog")
      .filter({ hasText: "Eliminar esta nota" });
  }

  // ─── View mode ─────────────────────────────────────────────

  /** Espera a que el panel esté visible en modo view. */
  async expectViewMode() {
    await expect(this.headerView).toBeVisible();
    await expect(this.editButton).toBeVisible();
  }

  async enterEditMode() {
    await this.editButton.click();
    await expect(this.headerEdit).toBeVisible();
    await expect(this.footerSaveButton).toBeVisible();
  }

  // ─── Edit mode ─────────────────────────────────────────────

  async expectEditMode() {
    await expect(this.headerEdit).toBeVisible();
    await expect(this.nameInput).toBeVisible();
    await expect(this.footerSaveButton).toBeVisible();
  }

  async setName(name: string) {
    await this.nameInput.fill(name);
  }

  async setEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async setPhone(phone: string) {
    await this.phoneInput.fill(phone);
  }

  async save() {
    await this.footerSaveButton.click();
  }

  async cancel() {
    await this.footerCancelButton.click();
  }

  // ─── Notes ─────────────────────────────────────────────────

  /** Locator para una nota cuyo contenido contenga el texto dado. */
  noteByContent(content: string): Locator {
    // Una nota es un div con border-border rounded-lg y un <p> con el contenido.
    // Filtramos por texto visible. Excluye dialogs (filter hasNotText "Eliminar esta nota").
    return this.page
      .locator("div.group")
      .filter({ hasText: content })
      .first();
  }

  async createNote(content: string) {
    await this.newNoteTextarea.fill(content);
    await expect(this.addNoteButton).toBeEnabled();

    // Esperar la respuesta del POST garantiza que el optimistic update fue
    // reemplazado por la nota real (id > 0) antes de seguir.
    const responsePromise = this.page.waitForResponse(
      (res) =>
        res.url().includes("/api/messaging/contacts/") &&
        res.url().includes("/notes") &&
        res.request().method() === "POST" &&
        res.status() === 201
    );
    await this.addNoteButton.click();
    await responsePromise;

    await expect(this.newNoteTextarea).toHaveValue("");
    // Verificación simple: el contenido aparece en pantalla. Suficiente para
    // confirmar que la nota se creó sin depender de la identidad del nodo.
    await expect(this.page.getByText(content, { exact: false })).toBeVisible();
  }

  /**
   * Edita una nota existente identificada por su contenido actual.
   * Una vez en modo edit, el filter `hasText: currentContent` deja de matchear
   * (el <p> se reemplaza por <textarea>), así que el botón "Guardar" lo
   * resolvemos via el div.group que contenga el textarea inline.
   */
  async editNote(currentContent: string, newContent: string) {
    const note = this.noteByContent(currentContent);
    const editBtn = note.getByRole("button", { name: "Editar nota" });
    // Timeout generoso: el optimistic add + swap toma hasta unos cientos de ms.
    await expect(editBtn).toBeAttached({ timeout: 10_000 });
    await note.hover();
    await editBtn.click();

    // El div.group que entró a edit contiene un <textarea> inline. CSS `:has`
    // es soportado por Playwright y nos da una raíz estable para el editor.
    const editingNote = this.page.locator("div.group:has(textarea)").first();
    const inlineEditor = editingNote.locator("textarea");
    await expect(inlineEditor).toBeVisible();
    await inlineEditor.fill(newContent);

    await editingNote
      .getByRole("button", { name: "Guardar", exact: true })
      .click();

    await expect(this.noteByContent(newContent)).toBeVisible();
  }

  /**
   * Elimina una nota. Confirma el AlertDialog.
   */
  async deleteNote(content: string) {
    const note = this.noteByContent(content);
    const trashBtn = note.getByRole("button", { name: "Eliminar nota" });
    await expect(trashBtn).toBeAttached({ timeout: 10_000 });
    await note.hover();
    await trashBtn.click();
    await expect(this.deleteDialog).toBeVisible();
    // Breve espera para que la animación de entrada del Radix dialog termine
    // (sin esto el botón "Eliminar" se reporta como no estable).
    await this.page.waitForTimeout(250);
    await this.deleteDialog
      .getByRole("button", { name: "Eliminar", exact: true })
      .click();
    await expect(this.noteByContent(content)).toHaveCount(0);
  }

  // ─── Dialogs ───────────────────────────────────────────────

  async expectDiscardDialogVisible() {
    await expect(this.discardDialog).toBeVisible();
  }

  async confirmDiscard() {
    await this.discardDialog.getByRole("button", { name: "Descartar" }).click();
  }

  async keepEditing() {
    await this.discardDialog
      .getByRole("button", { name: "Seguir editando" })
      .click();
  }
}
