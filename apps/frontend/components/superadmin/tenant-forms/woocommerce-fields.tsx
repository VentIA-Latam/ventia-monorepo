"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface WooCommerceFieldValues {
  woocommerce_url: string;
  woocommerce_consumer_key: string;
  woocommerce_consumer_secret: string;
}

export interface WooCommerceFieldsProps {
  values: WooCommerceFieldValues;
  onChange: (values: WooCommerceFieldValues) => void;
  /** HTML id prefix for field elements */
  idPrefix?: string;
  /** Whether credentials are optional (edit mode with existing credentials) */
  credentialsOptional?: boolean;
  /** Whether to show the platform-change warning style */
  showPlatformWarning?: boolean;
}

export function WooCommerceFields({
  values,
  onChange,
  idPrefix = "",
  credentialsOptional = false,
  showPlatformWarning = false,
}: WooCommerceFieldsProps) {
  const prefix = idPrefix ? `${idPrefix}-` : "";

  const credentialsRequired = showPlatformWarning;

  return (
    <>
      <div className={credentialsOptional ? "grid gap-2" : "space-y-2"}>
        <Label htmlFor={`${prefix}woocommerce_url`}>
          {credentialsOptional ? (
            <>URL de WooCommerce <span className="text-danger">*</span></>
          ) : (
            "Store URL *"
          )}
        </Label>
        <Input
          id={`${prefix}woocommerce_url`}
          type={credentialsOptional ? "url" : undefined}
          placeholder={credentialsOptional ? "https://mi-tienda.com" : "https://my-store.com"}
          value={values.woocommerce_url}
          onChange={(e) => onChange({ ...values, woocommerce_url: e.target.value })}
          required={credentialsOptional ? true : undefined}
        />
      </div>

      <div className={credentialsOptional ? "grid gap-2" : "space-y-2"}>
        <Label htmlFor={`${prefix}woocommerce_consumer_key`}>
          Consumer Key {credentialsOptional ? (showPlatformWarning ? <span className="text-danger">*</span> : "(opcional)") : "*"}
        </Label>
        <Input
          id={`${prefix}woocommerce_consumer_key`}
          type="password"
          placeholder={
            credentialsOptional
              ? (showPlatformWarning ? "Requerido al cambiar de plataforma" : "Dejar vacío para mantener el actual")
              : "ck_xxxxxxxxxxxx"
          }
          value={values.woocommerce_consumer_key}
          onChange={(e) => onChange({ ...values, woocommerce_consumer_key: e.target.value })}
          required={credentialsOptional ? credentialsRequired : undefined}
        />
      </div>

      <div className={credentialsOptional ? "grid gap-2" : "space-y-2"}>
        <Label htmlFor={`${prefix}woocommerce_consumer_secret`}>
          Consumer Secret {credentialsOptional ? (showPlatformWarning ? <span className="text-danger">*</span> : "(opcional)") : "*"}
        </Label>
        <Input
          id={`${prefix}woocommerce_consumer_secret`}
          type="password"
          placeholder={
            credentialsOptional
              ? (showPlatformWarning ? "Requerido al cambiar de plataforma" : "Dejar vacío para mantener el actual")
              : "cs_xxxxxxxxxxxx"
          }
          value={values.woocommerce_consumer_secret}
          onChange={(e) => onChange({ ...values, woocommerce_consumer_secret: e.target.value })}
          required={credentialsOptional ? credentialsRequired : undefined}
        />
        {credentialsOptional && (
          <p className="text-xs text-muted-foreground">
            {showPlatformWarning
              ? "Debes proporcionar nuevas credenciales al cambiar de plataforma"
              : "Solo completa si deseas cambiar las credenciales actuales"
            }
          </p>
        )}
      </div>
    </>
  );
}
