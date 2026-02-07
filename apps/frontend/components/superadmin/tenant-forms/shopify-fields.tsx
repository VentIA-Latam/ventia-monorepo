"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ShopifyFieldValues {
  shopify_store_url: string;
  shopify_client_id: string;
  shopify_client_secret: string;
  shopify_api_version: string;
}

export interface ShopifyFieldsProps {
  values: ShopifyFieldValues;
  onChange: (values: ShopifyFieldValues) => void;
  /** HTML id prefix for field elements */
  idPrefix?: string;
  /** Whether credentials are optional (edit mode with existing credentials) */
  credentialsOptional?: boolean;
  /** Whether to show the platform-change warning style */
  showPlatformWarning?: boolean;
}

export function ShopifyFields({
  values,
  onChange,
  idPrefix = "",
  credentialsOptional = false,
  showPlatformWarning = false,
}: ShopifyFieldsProps) {
  const prefix = idPrefix ? `${idPrefix}-` : "";

  // In create mode: always required. In edit mode: required only if platform changed
  const credentialsRequired = showPlatformWarning;
  const credentialsLabel = credentialsOptional && !showPlatformWarning;

  return (
    <>
      <div className={credentialsOptional ? "grid gap-2" : "space-y-2"}>
        <Label htmlFor={`${prefix}shopify_store_url`}>
          {credentialsOptional ? (
            <>URL de tienda Shopify <span className="text-danger">*</span></>
          ) : (
            "Store URL *"
          )}
        </Label>
        <Input
          id={`${prefix}shopify_store_url`}
          type={credentialsOptional ? "url" : undefined}
          placeholder={credentialsOptional ? "https://mi-tienda.myshopify.com" : "https://my-store.myshopify.com"}
          value={values.shopify_store_url}
          onChange={(e) => onChange({ ...values, shopify_store_url: e.target.value })}
          required={credentialsOptional ? true : undefined}
        />
      </div>

      <div className={credentialsOptional ? "grid gap-2" : "space-y-2"}>
        <Label htmlFor={`${prefix}shopify_client_id`} className={credentialsOptional ? "flex items-center gap-2" : undefined}>
          {credentialsOptional ? (
            <>
              Client ID de Shopify {showPlatformWarning ? <span className="text-danger">*</span> : "(opcional)"}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Obtén el Client ID desde el panel de tu app de Shopify en Partners Dashboard</p>
                </TooltipContent>
              </Tooltip>
            </>
          ) : (
            "Client ID *"
          )}
        </Label>
        <Input
          id={`${prefix}shopify_client_id`}
          type="text"
          placeholder={
            credentialsOptional
              ? (showPlatformWarning ? "Requerido al cambiar de plataforma" : "Dejar vacío para mantener el actual")
              : "Shopify Client ID"
          }
          value={values.shopify_client_id}
          onChange={(e) => onChange({ ...values, shopify_client_id: e.target.value })}
          required={credentialsOptional ? credentialsRequired : undefined}
        />
        {credentialsOptional && (
          <p className="text-xs text-muted-foreground">
            {showPlatformWarning
              ? "Debes proporcionar un nuevo Client ID al cambiar de plataforma"
              : "Solo completa si deseas cambiar las credenciales OAuth2"
            }
          </p>
        )}
      </div>

      <div className={credentialsOptional ? "grid gap-2" : "space-y-2"}>
        <Label htmlFor={`${prefix}shopify_client_secret`} className={credentialsOptional ? "flex items-center gap-2" : undefined}>
          {credentialsOptional ? (
            <>
              Client Secret de Shopify {showPlatformWarning ? <span className="text-danger">*</span> : "(opcional)"}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Obtén el Client Secret desde el panel de tu app de Shopify en Partners Dashboard</p>
                </TooltipContent>
              </Tooltip>
            </>
          ) : (
            "Client Secret *"
          )}
        </Label>
        <Input
          id={`${prefix}shopify_client_secret`}
          type="password"
          placeholder={
            credentialsOptional
              ? (showPlatformWarning ? "Requerido al cambiar de plataforma" : "Dejar vacío para mantener el actual")
              : "Shopify Client Secret"
          }
          value={values.shopify_client_secret}
          onChange={(e) => onChange({ ...values, shopify_client_secret: e.target.value })}
          required={credentialsOptional ? credentialsRequired : undefined}
        />
        {credentialsOptional && (
          <p className="text-xs text-muted-foreground">
            {showPlatformWarning
              ? "Debes proporcionar un nuevo Client Secret al cambiar de plataforma"
              : "Solo completa si deseas cambiar las credenciales OAuth2"
            }
          </p>
        )}
      </div>

      {credentialsOptional && (
        <div className="p-3 bg-volt/10 border border-volt/30 rounded-md">
          <p className="text-xs text-volt">
            ℹ️ El access token se genera automáticamente usando OAuth2
          </p>
        </div>
      )}

      <div className={credentialsOptional ? "grid gap-2" : "space-y-2"}>
        <Label htmlFor={`${prefix}shopify_api_version`}>
          {credentialsOptional ? "Versión API Shopify" : "API Version"}
        </Label>
        <Input
          id={`${prefix}shopify_api_version`}
          placeholder={credentialsOptional ? "2024-01" : "2025-10"}
          value={values.shopify_api_version}
          onChange={(e) => onChange({ ...values, shopify_api_version: e.target.value })}
        />
      </div>
    </>
  );
}
