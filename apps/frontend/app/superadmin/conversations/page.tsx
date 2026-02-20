import { MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function SuperAdminConversationsPage() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <EmptyState
        icon={<MessageSquare className="h-8 w-8" />}
        title="Conversaciones por tenant"
        description="Las conversaciones se gestionan desde el dashboard de cada tenant. Accede al panel de un tenant para ver sus conversaciones."
      />
    </div>
  );
}
