"use client";

import { useState } from "react";
import { FaTimes, FaPlus } from "react-icons/fa";

interface DeliveryZone {
  id: string;
  zoneName: string;
  coverageAreas: string[];
  paymentTypes: {
    payInAdvance: boolean;
    cashOnDelivery: boolean;
  };
  enablePartialPayments: boolean;
  minimumPercentage?: string;
  shippingOptions: ShippingOption[];
}

interface ShippingOption {
  id: string;
  optionName: string;
  price: string;
  description: string;
}

export default function DeliveryForm() {
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [coverageInput, setCoverageInput] = useState<{ [key: string]: string }>({});

  const addDeliveryZone = () => {
    const newZone: DeliveryZone = {
      id: `zone-${Date.now()}`,
      zoneName: "",
      coverageAreas: [],
      paymentTypes: {
        payInAdvance: false,
        cashOnDelivery: false,
      },
      enablePartialPayments: false,
      shippingOptions: [],
    };
    setDeliveryZones([...deliveryZones, newZone]);
  };

  const removeDeliveryZone = (zoneId: string) => {
    setDeliveryZones(deliveryZones.filter((zone) => zone.id !== zoneId));
  };

  const updateZone = (zoneId: string, field: keyof DeliveryZone, value: any) => {
    setDeliveryZones(
      deliveryZones.map((zone) =>
        zone.id === zoneId ? { ...zone, [field]: value } : zone
      )
    );
  };

  const handleCoverageInputChange = (zoneId: string, value: string) => {
    setCoverageInput({ ...coverageInput, [zoneId]: value });
  };

  const handleCoverageKeyDown = (zoneId: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const value = coverageInput[zoneId]?.trim().replace(/,$/, "");
      if (value) {
        const zone = deliveryZones.find((z) => z.id === zoneId);
        if (zone && !zone.coverageAreas.includes(value)) {
          updateZone(zoneId, "coverageAreas", [...zone.coverageAreas, value]);
          setCoverageInput({ ...coverageInput, [zoneId]: "" });
        }
      }
    }
  };

  const removeCoverageArea = (zoneId: string, area: string) => {
    const zone = deliveryZones.find((z) => z.id === zoneId);
    if (zone) {
      updateZone(
        zoneId,
        "coverageAreas",
        zone.coverageAreas.filter((a) => a !== area)
      );
    }
  };

  const addShippingOption = (zoneId: string) => {
    const zone = deliveryZones.find((z) => z.id === zoneId);
    if (zone) {
      const newOption: ShippingOption = {
        id: `option-${Date.now()}`,
        optionName: "",
        price: "",
        description: "",
      };
      updateZone(zoneId, "shippingOptions", [...zone.shippingOptions, newOption]);
    }
  };

  const updateShippingOption = (
    zoneId: string,
    optionId: string,
    field: keyof ShippingOption,
    value: string
  ) => {
    const zone = deliveryZones.find((z) => z.id === zoneId);
    if (zone) {
      const updatedOptions = zone.shippingOptions.map((option) =>
        option.id === optionId ? { ...option, [field]: value } : option
      );
      updateZone(zoneId, "shippingOptions", updatedOptions);
    }
  };

  const removeShippingOption = (zoneId: string, optionId: string) => {
    const zone = deliveryZones.find((z) => z.id === zoneId);
    if (zone) {
      updateZone(
        zoneId,
        "shippingOptions",
        zone.shippingOptions.filter((option) => option.id !== optionId)
      );
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-border">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-6 h-6 rounded-full border-2 border-aqua flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-aqua"></div>
        </div>
        <h2 className="text-xl font-semibold text-ventia-blue">
          Configuración de entrega
        </h2>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Define las zonas de entrega, opciones de envío y métodos de pago disponibles
      </p>

      {/* Delivery Zones */}
      <div className="space-y-6">
        {deliveryZones.map((zone, index) => (
          <div
            key={zone.id}
            className="border border-border rounded-lg p-6 relative"
          >
            {/* Zone Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Zona {index + 1}
              </h3>
              <button
                onClick={() => removeDeliveryZone(zone.id)}
                className="text-danger/70 hover:text-danger transition-colors p-2 rounded-full hover:bg-danger-bg"
              >
                <FaTimes />
              </button>
            </div>

            {/* Zone Name and Payment Types */}
            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Nombre de la zona
                </label>
                <input
                  type="text"
                  value={zone.zoneName}
                  onChange={(e) => updateZone(zone.id, "zoneName", e.target.value)}
                  placeholder="Lima Centro"
                  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua"
                />
              </div>

              {/* Payment Type Switches */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Tipos de pago
                </label>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
                  <span className="text-sm text-muted-foreground">Pago por adelantado</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={zone.paymentTypes.payInAdvance}
                      onChange={(e) =>
                        updateZone(zone.id, "paymentTypes", {
                          ...zone.paymentTypes,
                          payInAdvance: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-aqua rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0.5] after:left-[0.5] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aqua"></div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2 opacity-0">
                  Tipo
                </label>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
                  <span className="text-sm text-muted-foreground">Contraentrega</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={zone.paymentTypes.cashOnDelivery}
                      onChange={(e) =>
                        updateZone(zone.id, "paymentTypes", {
                          ...zone.paymentTypes,
                          cashOnDelivery: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-aqua rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0.5] after:left-[0.5] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aqua"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Coverage Areas */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Zonas de cobertura
              </label>
              <div className="space-y-2">
                {/* Tags display */}
                {zone.coverageAreas.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {zone.coverageAreas.map((area) => (
                      <span
                        key={area}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-volt/10 text-volt rounded-full text-sm"
                      >
                        {area}
                        <button
                          onClick={() => removeCoverageArea(zone.id, area)}
                          className="hover:text-danger transition-colors"
                        >
                          <FaTimes className="text-xs" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  value={coverageInput[zone.id] || ""}
                  onChange={(e) => handleCoverageInputChange(zone.id, e.target.value)}
                  onKeyDown={(e) => handleCoverageKeyDown(zone.id, e)}
                  placeholder="Miraflores, San Isidro, Barranco..."
                  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua"
                />
                <p className="text-xs text-muted-foreground">
                  Presiona Enter o usa comas para agregar
                  <span className="float-right">
                    {zone.coverageAreas.length}/20
                  </span>
                </p>
              </div>
            </div>

            {/* Enable Partial Payments */}
            <div className="mb-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 px-4 py-3 bg-muted rounded-lg border border-border">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={zone.enablePartialPayments}
                      onChange={(e) =>
                        updateZone(zone.id, "enablePartialPayments", e.target.checked)
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-aqua rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0.5] after:left-[0.5] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aqua"></div>
                  </label>
                  <span className="text-sm font-medium text-muted-foreground">Habilitar pagos parciales</span>
                </div>

                {/* Minimum Percentage Input - only shown when partial payments enabled */}
                {zone.enablePartialPayments && (
                  <>
                    <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                      Porcentaje mínimo
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={zone.minimumPercentage || ""}
                      onChange={(e) => updateZone(zone.id, "minimumPercentage", e.target.value)}
                      placeholder="0"
                      className="w-20 px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua text-sm"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Shipping Options */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-muted-foreground">
                  Opciones de envío
                </label>
                <button
                  onClick={() => addShippingOption(zone.id)}
                  className="text-volt text-sm hover:text-volt/80 transition-colors flex items-center gap-1"
                >
                  <FaPlus className="text-xs" />
                  Agregar opción
                </button>
              </div>

              {zone.shippingOptions.length === 0 ? (
                <div className="text-center py-8 bg-muted rounded-lg border border-dashed border-border">
                  <p className="text-sm text-muted-foreground mb-1">
                    No hay opciones de envío configuradas
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Agrega una opción de envío para esta zona
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {zone.shippingOptions.map((option) => (
                    <div
                      key={option.id}
                      className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-muted rounded-lg border border-border relative"
                    >
                      <button
                        onClick={() => removeShippingOption(zone.id, option.id)}
                        className="absolute top-2 right-2 text-danger/70 hover:text-danger transition-colors"
                      >
                        <FaTimes className="text-xs" />
                      </button>

                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Nombre
                        </label>
                        <input
                          type="text"
                          value={option.optionName}
                          onChange={(e) =>
                            updateShippingOption(
                              zone.id,
                              option.id,
                              "optionName",
                              e.target.value
                            )
                          }
                          placeholder="Envío express"
                          className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Precio
                        </label>
                        <input
                          type="text"
                          value={option.price}
                          onChange={(e) =>
                            updateShippingOption(
                              zone.id,
                              option.id,
                              "price",
                              e.target.value
                            )
                          }
                          placeholder="0"
                          className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Descripcion
                        </label>
                        <input
                          type="text"
                          value={option.description}
                          onChange={(e) =>
                            updateShippingOption(
                              zone.id,
                              option.id,
                              "description",
                              e.target.value
                            )
                          }
                          placeholder="Descripcion de envío"
                          className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Delivery Zone Button */}
      <button
        onClick={addDeliveryZone}
        className="w-full mt-6 border-2 border-dashed border-border rounded-lg py-8 text-muted-foreground hover:border-aqua hover:text-aqua transition-colors flex items-center justify-center gap-2"
      >
        <FaPlus className="text-lg" />
        <span className="font-medium">Agregar zona de entrega</span>
      </button>
    </div>
  );
}
