"use client"

import { memo, useCallback, useEffect, useMemo, useState, type DragEvent, type ChangeEvent } from "react"
import { FileText, Plus, Upload, Video, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileUploadZoneProps {
  files: File[]
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onValidateFiles: (files: File[]) => void
  onFileInput: (e: ChangeEvent<HTMLInputElement>) => void
  onRemoveFile: (index: number) => void
}

export const FileUploadZone = memo(function FileUploadZone({
  files,
  fileInputRef,
  onValidateFiles,
  onFileInput,
  onRemoveFile,
}: FileUploadZoneProps) {
  // rerender-use-ref-transient-values: dragOver solo afecta estilos visuales,
  // se maneja localmente para no propagar re-renders al hook padre
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    onValidateFiles(Array.from(e.dataTransfer.files))
  }, [onValidateFiles])

  const handleTriggerInput = useCallback(() => {
    fileInputRef.current?.click()
  }, [fileInputRef])

  const handleRemove = useCallback((i: number) => () => onRemoveFile(i), [onRemoveFile])

  const previews = useMemo(
    () => files.map((file) =>
      file.type.startsWith("image/") ? URL.createObjectURL(file) : null
    ),
    [files]
  )

  useEffect(() => {
    return () => {
      previews.forEach((url) => url && URL.revokeObjectURL(url))
    }
  }, [previews])

  const hasFiles = files.length > 0

  if (!hasFiles) {
    return (
      <>
        <div
          className={cn(
            "border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 py-8 px-5 cursor-pointer transition-colors select-none",
            dragOver
              ? "border-aqua bg-cielo/40"
              : "border-border bg-muted/30 hover:border-muted-foreground/40 hover:bg-muted/50"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleTriggerInput}
        >
          <Upload className={cn("w-7 h-7 transition-colors", dragOver ? "text-aqua" : "text-muted-foreground")} />
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">Arrastra archivos aquí</p>
            <p className="text-xs text-muted-foreground/70">o haz clic para seleccionar</p>
          </div>
          <p className="text-xs text-muted-foreground/60">JPG/PNG hasta 10MB · PDF hasta 20MB · MP4 hasta 150MB</p>
        </div>
        <input
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.pdf,.mp4"
          className="hidden"
          ref={fileInputRef}
          onChange={onFileInput}
        />
      </>
    )
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-3 rounded-xl border-2 border-dashed transition-colors",
        dragOver ? "border-aqua bg-cielo/40" : "border-border bg-muted/20"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {files.map((file, index) => (
          <div key={`${file.name}-${file.size}-${file.lastModified}`} className="relative group shrink-0">
            {previews[index] ? (
              <img
                src={previews[index]!}
                alt={file.name}
                title={file.name}
                className="w-11 h-11 rounded-lg object-cover"
              />
            ) : file.type === "video/mp4" ? (
              <div
                className="w-11 h-11 rounded-lg bg-cielo flex items-center justify-center"
                title={file.name}
              >
                <Video className="w-5 h-5 text-aqua" />
              </div>
            ) : (
              <div
                className="w-11 h-11 rounded-lg bg-danger-bg flex items-center justify-center"
                title={file.name}
              >
                <FileText className="w-5 h-5 text-danger" />
              </div>
            )}
            <button
              type="button"
              onClick={handleRemove(index)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
            >
              <X className="w-2.5 h-2.5" />
              <span className="sr-only">Eliminar</span>
            </button>
          </div>
        ))}

        {files.length < 10 && (
          <button
            type="button"
            onClick={handleTriggerInput}
            className="w-11 h-11 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground hover:border-muted-foreground/60 hover:bg-muted/40 transition-colors shrink-0"
            title="Agregar más archivos"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {files.length}/10 archivos · arrastra más aquí
      </p>

      <input
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.pdf,.mp4"
        className="hidden"
        ref={fileInputRef}
        onChange={onFileInput}
      />
    </div>
  )
})
