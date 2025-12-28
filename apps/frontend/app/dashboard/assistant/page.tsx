"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import KnowledgeBaseForm from "@/components/dashboard/forms/KnowledgeBaseForm";
import PersonalityForm from "@/components/dashboard/forms/PersonalityForm";
import DeliveryForm from "@/components/dashboard/forms/DeliveryForm";
import PaymentMethodsForm from "@/components/dashboard/forms/PaymentMethodsForm";

export default function AssistantPage() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="personalidad" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="personalidad">Personalidad</TabsTrigger>
          <TabsTrigger value="conocimiento">Base de conocimiento</TabsTrigger>
          <TabsTrigger value="entrega">Entrega</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
        </TabsList>

        <TabsContent value="personalidad">
          <PersonalityForm />
        </TabsContent>

        <TabsContent value="conocimiento">
          <KnowledgeBaseForm />
        </TabsContent>

        <TabsContent value="entrega">
          <DeliveryForm />
        </TabsContent>

        <TabsContent value="pagos">
          <PaymentMethodsForm />
        </TabsContent>
      </Tabs>

      <div className="flex justify-between">
        <button
          type="button"
          className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-inter"
        >
          Cancelar
        </button>
        <button
          type="button"
          className="px-6 py-3 bg-[#5ACAF0] text-white rounded-lg hover:bg-[#4AB8DC] transition-colors font-inter"
        >
          Guardar y continuar
        </button>
      </div>
    </div>
  );
}