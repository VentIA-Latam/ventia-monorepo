/**
 * Dark Mode AA Contrast Audit
 *
 * Lanza Chromium con un perfil persistente (./.audit-profile),
 * fuerza dark mode en cada ruta clave, inyecta axe-core y reporta
 * violaciones de contraste color.
 *
 * Primera vez (login):
 *   pnpm audit:dark:login   # abre Chrome visible para que te loguees
 *   # Te logueas, cierras la ventana → sesión guardada
 *
 * Corridas siguientes:
 *   pnpm audit:dark         # headless, reutiliza la sesión guardada
 *
 * Sale con código 1 si hay violaciones críticas o serias.
 */

import puppeteer, { type Browser, type Page } from "puppeteer";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const BASE_URL = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";
const PROFILE_DIR = resolve(process.cwd(), ".audit-profile");
const LOGIN_MODE = process.argv.includes("--login");

const ROUTES = [
  "/dashboard",
  "/dashboard/orders",
  "/dashboard/messages",
  "/superadmin",
  "/superadmin/tenants",
  "/superadmin/invoices",
];

interface AxeViolation {
  id: string;
  impact: "minor" | "moderate" | "serious" | "critical" | null;
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{
    target: string[];
    html: string;
    failureSummary?: string;
  }>;
}

interface AxeResults {
  violations: AxeViolation[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const axeSource = readFileSync(
  resolve(__dirname, "../node_modules/axe-core/axe.min.js"),
  "utf8"
);

type AuditOutcome =
  | { kind: "audited"; violations: AxeViolation[] }
  | { kind: "redirected"; finalUrl: string }
  | { kind: "failed"; error: string };

async function auditRoute(browser: Browser, route: string): Promise<AuditOutcome> {
  const page: Page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.emulateMediaFeatures([
    { name: "prefers-color-scheme", value: "dark" },
  ]);

  const url = `${BASE_URL}${route}`;
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  } catch (err) {
    await page.close();
    return { kind: "failed", error: (err as Error).message };
  }

  const baseHost = new URL(BASE_URL).host;
  const finalUrl = page.url();
  if (new URL(finalUrl).host !== baseHost) {
    await page.close();
    return { kind: "redirected", finalUrl };
  }

  // Force .dark class — bypasses next-themes if user is in light mode
  await page.evaluate(() => {
    document.documentElement.classList.remove("light");
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
  });

  // Wait a bit for re-render
  await new Promise((r) => setTimeout(r, 500));

  // Inject axe-core
  await page.evaluate(axeSource);

  const results = (await page.evaluate(async () => {
    // @ts-expect-error injected
    return await axe.run(document, { runOnly: ["color-contrast"] });
  })) as AxeResults;

  await page.close();
  return { kind: "audited", violations: results.violations };
}

async function loginFlow() {
  console.log(`🔐 Opening browser at ${BASE_URL} for login...`);
  console.log(`   Profile dir: ${PROFILE_DIR}`);
  console.log(`   Log in, then close the window to save the session.\n`);

  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: PROFILE_DIR,
    defaultViewport: null,
  });
  const [page] = await browser.pages();
  await page.goto(`${BASE_URL}/dashboard`);

  // Wait until the user closes the browser
  await new Promise<void>((res) => browser.on("disconnected", () => res()));
  console.log("✅ Session saved. Run `pnpm audit:dark` to audit.");
}

async function main() {
  if (LOGIN_MODE) {
    return loginFlow();
  }

  console.log(`🔍 Auditing dark mode AA contrast on ${BASE_URL}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    userDataDir: PROFILE_DIR,
  });

  let totalSerious = 0;
  let totalCritical = 0;
  let routesAudited = 0;
  let routesRedirected = 0;

  for (const route of ROUTES) {
    console.log(`→ ${route}`);
    const outcome = await auditRoute(browser, route);

    if (outcome.kind === "failed") {
      console.log(`  ⚠ failed: ${outcome.error}\n`);
      continue;
    }
    if (outcome.kind === "redirected") {
      console.log(`  ↪ redirected to ${outcome.finalUrl} (skipped)\n`);
      routesRedirected++;
      continue;
    }

    routesAudited++;
    if (outcome.violations.length === 0) {
      console.log("  ✓ no violations\n");
      continue;
    }

    for (const v of outcome.violations) {
      if (v.impact === "serious") totalSerious += v.nodes.length;
      if (v.impact === "critical") totalCritical += v.nodes.length;
      console.log(`  ✗ [${v.impact}] ${v.help} (${v.nodes.length} nodes)`);
      for (const node of v.nodes.slice(0, 5)) {
        console.log(`      → ${node.target.join(" ")}`);
        if (node.failureSummary) {
          const summary = node.failureSummary
            .split("\n")
            .filter((l) => l.trim())
            .slice(1)
            .map((l) => `        ${l.trim()}`)
            .join("\n");
          if (summary) console.log(summary);
        }
      }
      if (v.nodes.length > 5) {
        console.log(`      ... +${v.nodes.length - 5} more nodes`);
      }
    }
    console.log("");
  }

  await browser.close();

  console.log("─".repeat(60));
  console.log(
    `Audited ${routesAudited}/${ROUTES.length} routes (${routesRedirected} redirected to external auth)`
  );
  console.log(`Total: ${totalCritical} critical, ${totalSerious} serious`);

  if (routesAudited === 0) {
    console.log(
      "\n⚠ All routes redirected to external auth. Log in via the browser first,"
    );
    console.log(
      "  then run this script in the same session (or pass an auth cookie)."
    );
    process.exit(0);
  }

  if (totalCritical + totalSerious > 0) {
    console.log("❌ AA audit failed");
    process.exit(1);
  } else {
    console.log("✅ AA audit passed");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
