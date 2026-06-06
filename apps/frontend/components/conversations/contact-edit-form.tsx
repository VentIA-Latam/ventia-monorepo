"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { updateContact } from "@/lib/api-client/messaging";
import type { ContactBrief, ContactUpdatePayload } from "@/lib/types/messaging";

const contactSchema = z.object({
  name: z.string().trim().max(255).optional(),
  email: z
    .union([z.literal(""), z.string().email("Email no válido")])
    .optional(),
  phone_number: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, ""))
    .pipe(
      z.string().regex(/^\+\d{8,15}$/, "Formato: +51 904 890 457")
    )
    .or(z.literal(""))
    .optional(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export interface ContactEditFormHandle {
  submit: () => Promise<void>;
  cancel: () => boolean; // returns true if cancelled (no dirty fields)
  isDirty: () => boolean;
  isSubmitting: () => boolean;
}

interface ContactEditFormProps {
  contact: ContactBrief;
  tenantId?: number;
  onCancel: () => void;
  onSaved: (updated: ContactBrief) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export const ContactEditForm = forwardRef<ContactEditFormHandle, ContactEditFormProps>(
  function ContactEditForm(
    { contact, tenantId, onCancel, onSaved, onDirtyChange },
    ref
  ) {
    const { toast } = useToast();
    const firstInputRef = useRef<HTMLInputElement | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const {
      register,
      handleSubmit,
      formState: { errors, isDirty },
      reset,
    } = useForm<ContactFormValues>({
      resolver: zodResolver(contactSchema),
      defaultValues: {
        name: contact.name ?? "",
        email: contact.email ?? "",
        phone_number: contact.phone_number ?? "",
      },
    });

    useEffect(() => {
      onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    useEffect(() => {
      firstInputRef.current?.focus();
    }, []);

    const onSubmit = handleSubmit(async (values) => {
      setSubmitting(true);
      try {
        // Only include changed fields. RHF tracks dirty fields per field.
        const payload: ContactUpdatePayload = {};
        if (values.name !== (contact.name ?? "")) payload.name = values.name ?? "";
        if (values.email !== (contact.email ?? "")) payload.email = values.email ?? "";
        if (values.phone_number !== (contact.phone_number ?? "")) {
          payload.phone_number = values.phone_number ?? "";
        }

        if (Object.keys(payload).length === 0) {
          // Nothing to update — exit edit mode.
          onSaved(contact);
          return;
        }

        const updated = await updateContact(contact.id, payload, tenantId);
        reset({
          name: updated.name ?? "",
          email: updated.email ?? "",
          phone_number: updated.phone_number ?? "",
        });
        toast({ title: "Contacto actualizado" });
        onSaved(updated);
      } catch (err) {
        console.error("Failed to update contact", err);
        const detail =
          err instanceof Error && "details" in err
            ? String((err as { details?: unknown }).details ?? err.message)
            : "Probá de nuevo.";
        toast({
          title: "No pudimos guardar los cambios",
          description: detail,
          variant: "destructive",
        });
      } finally {
        setSubmitting(false);
      }
    });

    useImperativeHandle(ref, () => ({
      submit: () => onSubmit(),
      cancel: () => {
        if (isDirty) return false;
        onCancel();
        return true;
      },
      isDirty: () => isDirty,
      isSubmitting: () => submitting,
    }));

    const { ref: nameRefRegister, ...nameRegister } = register("name");

    return (
      <form
        onSubmit={onSubmit}
        className="space-y-4"
        aria-label="Editar contacto"
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="contact-name" className="text-xs text-muted-foreground">
            Nombre
          </Label>
          <Input
            id="contact-name"
            {...nameRegister}
            ref={(el) => {
              nameRefRegister(el);
              firstInputRef.current = el;
            }}
            disabled={submitting}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
          />
          {errors.name && (
            <p id="contact-name-error" className="text-xs text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact-email" className="text-xs text-muted-foreground">
            Email
          </Label>
          <Input
            id="contact-email"
            type="email"
            placeholder="agregar email"
            {...register("email")}
            disabled={submitting}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
          />
          {errors.email && (
            <p id="contact-email-error" className="text-xs text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact-phone" className="text-xs text-muted-foreground">
            Teléfono
          </Label>
          <Input
            id="contact-phone"
            type="tel"
            placeholder="+51 904 890 457"
            inputMode="tel"
            className="tabular-nums"
            {...register("phone_number")}
            disabled={submitting}
            aria-invalid={!!errors.phone_number}
            aria-describedby={
              errors.phone_number ? "contact-phone-error" : undefined
            }
          />
          {errors.phone_number && (
            <p id="contact-phone-error" className="text-xs text-destructive">
              {errors.phone_number.message}
            </p>
          )}
        </div>
      </form>
    );
  }
);
