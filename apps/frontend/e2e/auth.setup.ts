import { test as setup, expect } from "@playwright/test";

const authFile = "e2e/.auth/session.json";

setup("autenticar usuario de test", async ({ page }) => {
  await page.goto("/login");

  const url = page.url();

  if (url.includes("/dashboard")) {
    await page.context().storageState({ path: authFile });
    return;
  }

  if (!url.includes("auth0")) {
    await page.getByText(/iniciar sesión/i).click();
    await page.waitForURL(/auth0/, { timeout: 10_000 });
  }

  await page.getByLabel(/correo electrónico/i).fill(process.env.TEST_USER_EMAIL!);
  await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD!);
  await page.getByRole("button", { name: /continuar/i }).click();

  await page.waitForURL("**/dashboard/**", { timeout: 15_000 });
  await expect(page).toHaveURL(/\/dashboard/);

  await page.context().storageState({ path: authFile });
});
