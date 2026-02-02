import { AlertCircle } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export function ChatwootUserConfigCard() {
    return (
        <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
                <CardTitle className="text-orange-800 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Cuenta no configurada
                </CardTitle>
                <CardDescription className="text-orange-700">
                    Tu cuenta no está vinculada a Chatwoot.
                </CardDescription>
            </CardHeader>
            <CardContent className="text-orange-800 space-y-4">
                <p>
                    Para acceder a Chatwoot, un administrador debe configurar tu
                    cuenta con los siguientes datos:
                </p>
                <ul className="list-disc list-inside space-y-1">
                    <li>ID de usuario de Chatwoot</li>
                    <li>ID de cuenta de Chatwoot</li>
                </ul>
                <p className="text-sm">
                    Contacta al administrador del sistema para completar la configuración.
                </p>
            </CardContent>
        </Card>
    );
}
