import { ChatwootEmbed } from "@/components/chatwoot";

/**
 * Chatwoot Integration Page - SuperAdmin
 *
 * Esta página integra Chatwoot directamente en el panel de SuperAdmin.
 * Utiliza acceso directo al dashboard sin SSO.
 */
export default function SuperAdminChatwootPage() {
    return <ChatwootEmbed mode="sso" iconColor="purple" />;
}
