"use client";

import { Bell } from "lucide-react";

export default function CampaignsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-volt/10 rounded-lg">
          <Bell className="w-6 h-6 text-volt" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Campañas</h1>
          <p className="text-muted-foreground">Gestiona tus campañas de marketing y promociones</p>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border p-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-volt/10 rounded-full">
              <Bell className="w-12 h-12 text-volt" />
            </div>
          </div>
          <h2 className="text-xl font-semibold font-heading text-foreground">Próximamente</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Esta sección estará disponible muy pronto. Aquí podrás crear y gestionar campañas
            para comunicarte con tus clientes de manera efectiva.
          </p>
        </div>
      </div>
    </div>
  );
}

