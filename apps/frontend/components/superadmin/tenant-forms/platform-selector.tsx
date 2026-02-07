"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

type Platform = "shopify" | "woocommerce" | null;

export interface PlatformSelectorProps {
  selectedPlatform: Platform;
  onPlatformChange: (platform: Platform) => void;
  /** If provided, shows "Actual" badge and "Ninguna" option (edit mode) */
  initialPlatform?: Platform;
  /** Number of columns for the grid. Defaults to 2 (create) or 3 (edit with initialPlatform) */
  columns?: 2 | 3;
}

export function PlatformSelector({
  selectedPlatform,
  onPlatformChange,
  initialPlatform,
  columns,
}: PlatformSelectorProps) {
  const showNone = initialPlatform !== undefined;
  const gridCols = columns ?? (showNone ? 3 : 2);

  return (
    <div className={cn(
      "grid gap-3",
      gridCols === 3 ? "grid-cols-3" : "grid-cols-2",
      gridCols === 2 && "gap-4"
    )}>
      {/* Sin Plataforma - only in edit mode */}
      {showNone && (
        <button
          type="button"
          onClick={() => onPlatformChange(null)}
          className={cn(
            "relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all hover:shadow-md",
            selectedPlatform === null
              ? "border-muted-foreground bg-muted/50 shadow-md"
              : "border-border bg-card hover:border-muted-foreground"
          )}
        >
          <div className="w-12 h-12 mb-2 flex items-center justify-center text-muted-foreground">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <span className={cn(
            "font-medium text-xs",
            selectedPlatform === null ? "text-foreground" : "text-muted-foreground"
          )}>
            Ninguna
          </span>
          {selectedPlatform === null && (
            <div className="absolute top-2 right-2">
              <div className="bg-muted/500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          )}
        </button>
      )}

      {/* Shopify Card */}
      <button
        type="button"
        onClick={() => onPlatformChange("shopify")}
        className={cn(
          "relative flex flex-col items-center p-4 rounded-lg border-2 transition-all hover:shadow-md",
          showNone ? "justify-center" : "gap-3",
          selectedPlatform === "shopify"
            ? "border-success bg-success-bg shadow-md" + (showNone ? " ring-2 ring-success/30" : "")
            : "border-border bg-card hover:border-muted-foreground",
          initialPlatform === "shopify" && selectedPlatform === "shopify" && "animate-pulse"
        )}
      >
        <div className="relative w-12 h-12 mb-2">
          <Image
            src="/external-icons/shopify-icon.png"
            alt="Shopify"
            fill
            className="object-contain"
          />
        </div>
        <span className={cn(
          "font-medium",
          showNone ? "text-xs" : "text-sm",
          selectedPlatform === "shopify" ? "text-success" : showNone ? "text-muted-foreground" : "text-foreground"
        )}>
          Shopify
        </span>
        {selectedPlatform === "shopify" && (
          <div className="absolute top-2 right-2">
            <div className="bg-success text-white rounded-full w-5 h-5 flex items-center justify-center">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )}
        {initialPlatform === "shopify" && (
          <div className="absolute -top-1 -left-1">
            <div className="bg-primary text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
              Actual
            </div>
          </div>
        )}
      </button>

      {/* WooCommerce Card */}
      <button
        type="button"
        onClick={() => onPlatformChange("woocommerce")}
        className={cn(
          "relative flex flex-col items-center p-4 rounded-lg border-2 transition-all hover:shadow-md",
          showNone ? "justify-center" : "gap-3",
          selectedPlatform === "woocommerce"
            ? "border-marino bg-cielo shadow-md" + (showNone ? " ring-2 ring-luma/30" : "")
            : "border-border bg-card hover:border-muted-foreground",
          initialPlatform === "woocommerce" && selectedPlatform === "woocommerce" && "animate-pulse"
        )}
      >
        <div className="relative w-12 h-12 mb-2">
          <Image
            src="/external-icons/woo-icon.png"
            alt="WooCommerce"
            fill
            className="object-contain"
          />
        </div>
        <span className={cn(
          "font-medium",
          showNone ? "text-xs" : "text-sm",
          selectedPlatform === "woocommerce" ? "text-marino" : showNone ? "text-muted-foreground" : "text-foreground"
        )}>
          WooCommerce
        </span>
        {selectedPlatform === "woocommerce" && (
          <div className="absolute top-2 right-2">
            <div className="bg-marino text-white rounded-full w-5 h-5 flex items-center justify-center">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )}
        {initialPlatform === "woocommerce" && (
          <div className="absolute -top-1 -left-1">
            <div className="bg-primary text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
              Actual
            </div>
          </div>
        )}
      </button>
    </div>
  );
}
