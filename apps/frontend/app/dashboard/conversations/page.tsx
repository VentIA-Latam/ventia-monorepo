import { ChatwootEmbed } from "@/components/chatwoot";

/**
 * Chatwoot Integration Page - Dashboard
 *
 * Esta página integra Chatwoot directamente en el dashboard de Ventia.
 * Utiliza SSO para autenticar automáticamente al usuario.
 */
export default function ChatwootPage() {
    return <ChatwootEmbed mode="sso" iconColor="blue" showFooterInfo={false} />;
}

