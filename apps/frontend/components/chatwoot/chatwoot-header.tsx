import { MessageSquare } from "lucide-react";

interface ChatwootHeaderProps {
    iconColor?: "blue" | "purple";
}

export function ChatwootHeader({ iconColor = "blue" }: ChatwootHeaderProps) {
    const colorClass = iconColor === "purple" ? "text-purple-600" : "text-blue-600";

    return (
        <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare className={`h-6 w-6 ${colorClass}`} />
                Conversaciones
            </h1>
            <p className="text-gray-500">
                Centro de mensajería y atención al cliente
            </p>
        </div>
    );
}
