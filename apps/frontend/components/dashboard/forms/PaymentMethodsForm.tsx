"use client";

import { useState } from "react";
import { FaTimes, FaPlus } from "react-icons/fa";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PaymentMethod {
  id: string;
  isActive: boolean;
  methodName: string;
  methodType: string;
  paymentInstructions: string;
}

export default function PaymentMethodsForm() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const paymentTypes = [
    { value: "transferencia-bancaria", label: "Transferencia bancaria" },
    { value: "yape", label: "Yape" },
    { value: "plin", label: "Plin" },
    { value: "tarjeta-credito", label: "Tarjeta de crédito" },
    { value: "paypal", label: "PayPal" },
    { value: "efectivo", label: "Efectivo" },
    { value: "otro", label: "Otro" },
  ];

  const addPaymentMethod = () => {
    const newMethod: PaymentMethod = {
      id: `method-${Date.now()}`,
      isActive: true,
      methodName: "",
      methodType: "",
      paymentInstructions: "",
    };
    setPaymentMethods([...paymentMethods, newMethod]);
  };

  const removePaymentMethod = (methodId: string) => {
    setPaymentMethods(paymentMethods.filter((method) => method.id !== methodId));
  };

  const updateMethod = (
    methodId: string,
    field: keyof PaymentMethod,
    value: any
  ) => {
    setPaymentMethods(
      paymentMethods.map((method) =>
        method.id === methodId ? { ...method, [field]: value } : method
      )
    );
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-border">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-6 h-6 rounded-full border-2 border-aqua flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-aqua"></div>
        </div>
        <h2 className="text-xl font-semibold text-ventia-blue">
          Métodos de pago
        </h2>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Selecciona si aceptas pago adelantado, contraentrega o ambos
      </p>

      {/* Payment Methods */}
      <div className="space-y-4">
        {paymentMethods.map((method, index) => (
          <div
            key={method.id}
            className="border border-border rounded-lg p-6 relative"
          >
            {/* Method Header with Switch and Remove Button */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {/* Activation Switch */}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={method.isActive}
                    onChange={(e) =>
                      updateMethod(method.id, "isActive", e.target.checked)
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-aqua rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0.5] after:left-[0.5] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aqua"></div>
                </label>
                <h3 className="text-lg font-semibold text-foreground">
                  Método de pago {index + 1}
                </h3>
                {method.methodType && (
                  <span className="text-sm text-volt bg-volt/10 px-3 py-1 rounded-full">
                    {paymentTypes.find((type) => type.value === method.methodType)?.label}
                  </span>
                )}
              </div>
              <button
                onClick={() => removePaymentMethod(method.id)}
                className="text-danger/70 hover:text-danger transition-colors p-2 rounded-full hover:bg-danger-bg"
              >
                <FaTimes />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Method Name and Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Nombre del método
                  </label>
                  <input
                    type="text"
                    value={method.methodName}
                    onChange={(e) =>
                      updateMethod(method.id, "methodName", e.target.value)
                    }
                    placeholder="BBVA, YAPE, Interbank, etc."
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Tipo de método
                  </label>
                  <Select
                    value={method.methodType}
                    onValueChange={(value) =>
                      updateMethod(method.id, "methodType", value)
                    }
                  >
                    <SelectTrigger className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua bg-white">
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Payment Instructions */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Instrucciones de pago
                </label>
                <textarea
                  value={method.paymentInstructions}
                  onChange={(e) =>
                    updateMethod(method.id, "paymentInstructions", e.target.value)
                  }
                  placeholder="Transferir al CCI: 011-170-20012345678-10&#10;Titular: Mi Empresa SAC&#10;Enviar comprobante por WhatsApp"
                  rows={4}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua resize-none"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Proporciona todos los datos necesarios para que el cliente pueda realizar el pago correctamente
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Payment Method Button */}
      <button
        onClick={addPaymentMethod}
        className="w-full mt-6 border-2 border-dashed border-border rounded-lg py-8 text-muted-foreground hover:border-aqua hover:text-aqua transition-colors flex items-center justify-center gap-2"
      >
        <FaPlus className="text-lg" />
        <span className="font-medium">Agregar método de pago</span>
      </button>
    </div>
  );
}
