"use client";

import { useState } from "react";
import {
  BasicInfoSection,
  AudienceSection,
  PersonalitySection,
  MessagesSection,
} from "./personality";

interface PersonalityFormData {
  // Personality section
  communicationStyle: string;
  salesStyle: string;
  responseLength: number;
  useEmojis: boolean;
  useOpeningSymbols: boolean;
  wordsToAvoid: string;
  allowedEmojis: string[];
  // Basic Info section
  sellerName: string;
  sellerGender: "masculino" | "femenino" | "no-especificado" | "otro" | "";
  companyName: string;
  operationCountry: string;
  companyDescription: string;
  // Audience section
  targetAudience: string;
  specialInstructions: string;
  // Messages section
  welcomeMessage: string;
  purchaseConfirmationMessage: string;
  humanHandoffMessage: string;
}

interface PersonalityFormProps {
  onDataChange?: (data: PersonalityFormData) => void;
}

export default function PersonalityForm({
  onDataChange,
}: PersonalityFormProps) {
  const [formData, setFormData] = useState<PersonalityFormData>({
    communicationStyle: "",
    salesStyle: "",
    responseLength: 4, // "Muy detallado" is at position 4
    useEmojis: true,
    useOpeningSymbols: false,
    wordsToAvoid: "",
    allowedEmojis: ["😊", "👍", "🎉"],
    sellerName: "",
    sellerGender: "",
    companyName: "",
    operationCountry: "",
    companyDescription: "",
    targetAudience: "",
    specialInstructions: "",
    welcomeMessage: "",
    purchaseConfirmationMessage: "",
    humanHandoffMessage: "",
  });

  const handleChange = <K extends keyof PersonalityFormData>(
    field: K,
    value: PersonalityFormData[K]
  ) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    onDataChange?.(newData);
  };

  return (
    <div className="space-y-8 font-sans">

      {/* Basic Information Section */}
      <BasicInfoSection
        sellerName={formData.sellerName}
        sellerGender={formData.sellerGender}
        companyName={formData.companyName}
        operationCountry={formData.operationCountry}
        companyDescription={formData.companyDescription}
        onSellerNameChange={(v) => handleChange("sellerName", v)}
        onSellerGenderChange={(v) => handleChange("sellerGender", v)}
        onCompanyNameChange={(v) => handleChange("companyName", v)}
        onOperationCountryChange={(v) => handleChange("operationCountry", v)}
        onCompanyDescriptionChange={(v) => handleChange("companyDescription", v)}
      />

      {/* Audience and Instructions Section */}
      <AudienceSection
        targetAudience={formData.targetAudience}
        specialInstructions={formData.specialInstructions}
        onTargetAudienceChange={(v) => handleChange("targetAudience", v)}
        onSpecialInstructionsChange={(v) => handleChange("specialInstructions", v)}
      />

      {/* Personality Section */}
      <PersonalitySection
        communicationStyle={formData.communicationStyle}
        salesStyle={formData.salesStyle}
        responseLength={formData.responseLength}
        useEmojis={formData.useEmojis}
        useOpeningSymbols={formData.useOpeningSymbols}
        wordsToAvoid={formData.wordsToAvoid}
        allowedEmojis={formData.allowedEmojis}
        onCommunicationStyleChange={(v) => handleChange("communicationStyle", v)}
        onSalesStyleChange={(v) => handleChange("salesStyle", v)}
        onResponseLengthChange={(v) => handleChange("responseLength", v)}
        onUseEmojisChange={(v) => handleChange("useEmojis", v)}
        onUseOpeningSymbolsChange={(v) => handleChange("useOpeningSymbols", v)}
        onWordsToAvoidChange={(v) => handleChange("wordsToAvoid", v)}
        onAllowedEmojisChange={(v) => handleChange("allowedEmojis", v)}
      />

      {/* Messages Section */}
      <MessagesSection
        welcomeMessage={formData.welcomeMessage}
        purchaseConfirmationMessage={formData.purchaseConfirmationMessage}
        humanHandoffMessage={formData.humanHandoffMessage}
        onWelcomeMessageChange={(v) => handleChange("welcomeMessage", v)}
        onPurchaseConfirmationMessageChange={(v) => handleChange("purchaseConfirmationMessage", v)}
        onHumanHandoffMessageChange={(v) => handleChange("humanHandoffMessage", v)}
      />

    </div>
  );
}
