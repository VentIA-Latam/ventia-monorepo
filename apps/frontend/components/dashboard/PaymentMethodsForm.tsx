"use client";

import { useState } from "react";
import { FaTimes, FaPlus } from "react-icons/fa";

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
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-6 h-6 rounded-full border-2 border-[#5ACAF0] flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-[#5ACAF0]"></div>
        </div>
        <h2 className="text-xl font-semibold text-ventia-blue">
          Métodos de pago
        </h2>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Selecciona si aceptas pago adelantado, contraentrega o ambos
      </p>

      {/* Payment Methods */}
      <div className="space-y-4">
        {paymentMethods.map((method, index) => (
          <div
            key={method.id}
            className="border border-gray-200 rounded-lg p-6 relative"
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
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#5ACAF0] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0.5] after:left-[0.5] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5ACAF0]"></div>
                </label>
                <h3 className="text-lg font-semibold text-gray-900">
                  Método de pago {index + 1}
                </h3>
                {method.methodType && (
                  <span className="text-sm text-ventia-blue bg-blue-50 px-3 py-1 rounded-full">
                    {paymentTypes.find((type) => type.value === method.methodType)?.label}
                  </span>
                )}
              </div>
              <button
                onClick={() => removePaymentMethod(method.id)}
                className="text-red-400 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-50"
              >
                <FaTimes />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Method Name and Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre del método
                  </label>
                  <input
                    type="text"
                    value={method.methodName}
                    onChange={(e) =>
                      updateMethod(method.id, "methodName", e.target.value)
                    }
                    placeholder="BBVA, YAPE, Interbank, etc."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#5ACAF0] focus:ring-1 focus:ring-[#5ACAF0]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de método
                  </label>
                  <select
                    value={method.methodType}
                    onChange={(e) =>
                      updateMethod(method.id, "methodType", e.target.value)
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#5ACAF0] focus:ring-1 focus:ring-[#5ACAF0] bg-white"
                  >
                    <option value="">Seleccionar tipo</option>
                    {paymentTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payment Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instrucciones de pago
                </label>
                <textarea
                  value={method.paymentInstructions}
                  onChange={(e) =>
                    updateMethod(method.id, "paymentInstructions", e.target.value)
                  }
                  placeholder="Transferir al CCI: 011-170-20012345678-10&#10;Titular: Mi Empresa SAC&#10;Enviar comprobante por WhatsApp"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#5ACAF0] focus:ring-1 focus:ring-[#5ACAF0] resize-none"
                />
                <p className="text-xs text-gray-500 mt-2">
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
        className="w-full mt-6 border-2 border-dashed border-gray-300 rounded-lg py-8 text-gray-500 hover:border-[#5ACAF0] hover:text-[#5ACAF0] transition-colors flex items-center justify-center gap-2"
      >
        <FaPlus className="text-lg" />
        <span className="font-medium">Agregar método de pago</span>
      </button>
    </div>
  );
}
