"use client";

interface AudienceSectionProps {
  targetAudience: string;
  specialInstructions: string;
  onTargetAudienceChange: (value: string) => void;
  onSpecialInstructionsChange: (value: string) => void;
}

export default function AudienceSection({
  targetAudience,
  specialInstructions,
  onTargetAudienceChange,
  onSpecialInstructionsChange,
}: AudienceSectionProps) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-border">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-6 h-6 rounded-full border-2 border-aqua flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-aqua"></div>
        </div>
        <h2 className="text-xl font-semibold text-ventia-blue">
          Audiencia e instrucciones
        </h2>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            {"\u00bfA qui\u00e9n le vendes?"}
            <span className="text-danger ml-1">*</span>
          </label>
          <input
            type="text"
            value={targetAudience}
            onChange={(e) => onTargetAudienceChange(e.target.value)}
            placeholder="broad consumer audience"
            className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua bg-muted"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Instrucciones especiales para tu vendedor
            <span className="text-danger ml-1">*</span>
          </label>
          <textarea
            value={specialInstructions}
            onChange={(e) => onSpecialInstructionsChange(e.target.value)}
            placeholder="general product support"
            rows={5}
            className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua bg-muted"
          />
        </div>
      </div>
    </div>
  );
}
