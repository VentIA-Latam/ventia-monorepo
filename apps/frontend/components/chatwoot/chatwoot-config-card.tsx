import { MessageSquare } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export function ChatwootConfigCard() {
    return (
        <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
                <CardTitle className="text-yellow-800 flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Configuración Requerida
                </CardTitle>
                <CardDescription className="text-yellow-700">
                    Chatwoot no está configurado en este momento.
                </CardDescription>
            </CardHeader>
            <CardContent className="text-yellow-800 space-y-4">
                <p>
                    Para habilitar la integración con Chatwoot, necesitas configurar
                    la siguiente variable de entorno:
                </p>
                <div className="bg-yellow-100 p-4 rounded-lg font-mono text-sm">
                    <p>NEXT_PUBLIC_CHATWOOT_BASE_URL=http://localhost:3001</p>
                </div>
                <p className="text-sm">
                    Nota: El Account ID y User ID se configuran por usuario en la base de datos.
                </p>
            </CardContent>
        </Card>
    );
}
