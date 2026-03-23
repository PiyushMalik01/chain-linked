/**
 * Media Upload Component
 * @description Drag-and-drop media upload zone supporting images, videos, and documents
 * with file previews, upload progress indicators, and validation.
 * @module components/features/media-upload
 */

"use client"

import * as React from "react"
import Image from "next/image"
import {
  IconFile,
  IconMovie,
  IconPhoto,
  IconUpload,
  IconX,
  IconAlertCircle,
  IconLoader2,
  IconCheck,
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

/**
 * Represents an uploaded media file with its metadata and upload status
 */
export interface MediaFile {
  /** Unique identifier for the file */
  id: string
  /** The actual File object */
  file: File
  /** Type of media content */
  type: "image" | "video" | "document"
  /** Preview URL for displaying the file (blob URL or data URL) */
  previewUrl: string
  /** Upload progress percentage (0-100) */
  uploadProgress: number
  /** Current upload status */
  status: "pending" | "uploading" | "complete" | "error"
  /** Error message if status is "error" */
  error?: string
}

/**
 * Props for the MediaUpload component
 */
export interface MediaUploadProps {
  /** Array of currently uploaded/selected files */
  files: MediaFile[]
  /** Callback fired when files are added or removed */
  onFilesChange: (files: MediaFile[]) => void
  /** Maximum number of files allowed (defaults to 9) */
  maxFiles?: number
  /** Maximum file size in megabytes (defaults to 10 for images, 200 for videos) */
  maxSizeMB?: number
  /** Accepted file types (defaults to common image and video formats) */
  acceptedTypes?: string[]
  /** Async callback for uploading a file, returns the uploaded file URL */
  onUpload?: (file: File) => Promise<string>
  /** Whether the upload component is disabled */
  disabled?: boolean
}

/** Default accepted file types */
const DEFAULT_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "video/mp4",
  "video/quicktime",
]

/** File extensions for the accept attribute */
const ACCEPT_EXTENSIONS = ".jpg,.jpeg,.png,.gif,.mp4,.mov"

/** Maximum file size for images in bytes (10MB) */
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

/** Maximum file size for videos in bytes (200MB) */
const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024

/** Maximum number of images allowed */
const MAX_IMAGES = 9

/** Maximum number of videos allowed */
const MAX_VIDEOS = 1

/**
 * Generates a unique ID for uploaded files
 * @returns A unique string ID
 */
function generateFileId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Determines the media type based on file MIME type
 * @param file - The File object to check
 * @returns The media type category
 */
function getMediaType(file: File): "image" | "video" | "document" {
  if (file.type.startsWith("image/")) {
    return "image"
  }
  if (file.type.startsWith("video/")) {
    return "video"
  }
  return "document"
}

/**
 * Validates a file against size and type constraints
 * @param file - The file to validate
 * @param existingFiles - Currently selected files for context
 * @param acceptedTypes - List of accepted MIME types
 * @returns An error message if invalid, or null if valid
 */
function validateFile(
  file: File,
  existingFiles: MediaFile[],
  acceptedTypes: string[]
): string | null {
  // Check file type
  if (!acceptedTypes.includes(file.type)) {
    return `Invalid file type: ${file.type}. Accepted formats: JPG, PNG, GIF, MP4, MOV`
  }

  const mediaType = getMediaType(file)

  // Check file size
  if (mediaType === "image" && file.size > MAX_IMAGE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    return `Image too large (${sizeMB}MB). Maximum size is 10MB`
  }

  if (mediaType === "video" && file.size > MAX_VIDEO_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    return `Video too large (${sizeMB}MB). Maximum size is 200MB`
  }

  // Check limits based on existing files
  const existingImages = existingFiles.filter((f) => f.type === "image")
  const existingVideos = existingFiles.filter((f) => f.type === "video")

  // Cannot mix images and videos (LinkedIn limitation)
  if (mediaType === "image" && existingVideos.length > 0) {
    return "Cannot add images when a video is already selected"
  }

  if (mediaType === "video" && existingImages.length > 0) {
    return "Cannot add video when images are already selected"
  }

  // Check max counts
  if (mediaType === "image" && existingImages.length >= MAX_IMAGES) {
    return `Maximum ${MAX_IMAGES} images allowed`
  }

  if (mediaType === "video" && existingVideos.length >= MAX_VIDEOS) {
    return `Maximum ${MAX_VIDEOS} video allowed`
  }

  return null
}

/**
 * Creates a preview URL for a file
 * @param file - The file to create a preview for
 * @returns A blob URL for the file
 */
function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file)
}

/**
 * Formats file size for display
 * @param bytes - File size in bytes
 * @returns Human-readable file size string
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * A media upload component with drag-and-drop support, progress tracking, and preview grid.
 *
 * Features:
 * - Drag-and-drop zone with visual feedback
 * - Click to open file picker
 * - Preview grid showing uploaded images
 * - Progress bar per file (simulated or real via onUpload callback)
 * - Remove button on each file
 * - Error display per file
 * - Validation: Max 9 images or 1 video, 10MB per image, 200MB per video
 * - File type icons for non-image files
 *
 * @example
 * ```tsx
 * // Basic usage with state management
 * const [files, setFiles] = React.useState<MediaFile[]>([])
 *
 * <MediaUpload
 *   files={files}
 *   onFilesChange={setFiles}
 * />
 *
 * // With custom upload handler
 * <MediaUpload
 *   files={files}
 *   onFilesChange={setFiles}
 *   onUpload={async (file) => {
 *     const url = await uploadToStorage(file)
 *     return url
 *   }}
 *   maxFiles={5}
 * />
 * ```
 */
export function MediaUpload({
  files,
  onFilesChange,
  maxFiles = MAX_IMAGES,
  maxSizeMB: _maxSizeMB,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  onUpload,
  disabled = false,
}: MediaUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  // Track current files for simulated upload updates
  const filesRef = React.useRef<MediaFile[]>(files)
  // Track interval ID for cleanup
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  // Keep ref in sync with props
  React.useEffect(() => {
    filesRef.current = files
  }, [files])

  // Cleanup interval on unmount
  React.useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [])

  // Determine if we've reached the file limit
  const hasVideo = files.some((f) => f.type === "video")
  const imageCount = files.filter((f) => f.type === "image").length
  const isAtLimit = hasVideo || imageCount >= maxFiles

  /**
   * Simulates upload progress or calls the real upload handler
   */
  const simulateOrUpload = React.useCallback(
    async (mediaFile: MediaFile, currentFiles: MediaFile[]) => {
      // Update status to uploading
      const startUpload = currentFiles.map((f) =>
        f.id === mediaFile.id ? { ...f, status: "uploading" as const } : f
      )
      onFilesChange(startUpload)

      if (onUpload) {
        // Real upload with callback
        try {
          await onUpload(mediaFile.file)
          const completeUpload = startUpload.map((f) =>
            f.id === mediaFile.id
              ? { ...f, status: "complete" as const, uploadProgress: 100 }
              : f
          )
          onFilesChange(completeUpload)
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Upload failed"
          const failedUpload = startUpload.map((f) =>
            f.id === mediaFile.id
              ? { ...f, status: "error" as const, error: errorMessage }
              : f
          )
          onFilesChange(failedUpload)
        }
      } else {
        // Simulate upload progress
        let progress = 0
        const interval = setInterval(() => {
          progress += Math.random() * 30 + 10
          if (progress >= 100) {
            progress = 100
            clearInterval(interval)
            intervalRef.current = null

            const updatedFiles = filesRef.current.map((f) =>
              f.id === mediaFile.id
                ? { ...f, status: "complete" as const, uploadProgress: 100 }
                : f
            )
            filesRef.current = updatedFiles
            onFilesChange(updatedFiles)
          } else {
            const updatedFiles = filesRef.current.map((f) =>
              f.id === mediaFile.id ? { ...f, uploadProgress: progress } : f
            )
            filesRef.current = updatedFiles
            onFilesChange(updatedFiles)
          }
        }, 200)
        intervalRef.current = interval
      }
    },
    [onFilesChange, onUpload]
  )

  /**
   * Handles file selection from input or drop
   */
  const handleFiles = React.useCallback(
    async (selectedFiles: FileList | File[]) => {
      const newFiles: MediaFile[] = []
      const filesToProcess = Array.from(selectedFiles)

      for (const file of filesToProcess) {
        // Validate each file
        const error = validateFile(file, [...files, ...newFiles], acceptedTypes)

        const mediaFile: MediaFile = {
          id: generateFileId(),
          file,
          type: getMediaType(file),
          previewUrl: createPreviewUrl(file),
          uploadProgress: 0,
          status: error ? "error" : "pending",
          error: error ?? undefined,
        }

        newFiles.push(mediaFile)

        // Stop if we hit an error or limit
        if (error) break

        // Check total count
        const totalImages =
          files.filter((f) => f.type === "image").length +
          newFiles.filter((f) => f.type === "image").length
        if (totalImages >= maxFiles) break
      }

      const updatedFiles = [...files, ...newFiles]
      onFilesChange(updatedFiles)

      // Simulate or perform upload for valid files
      for (const mediaFile of newFiles) {
        if (mediaFile.status === "pending") {
          await simulateOrUpload(mediaFile, updatedFiles)
        }
      }
    },
    [files, onFilesChange, acceptedTypes, maxFiles, simulateOrUpload]
  )

  /**
   * Handles drag over event
   */
  const handleDragOver = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      if (!disabled && !isAtLimit) {
        setIsDragging(true)
      }
    },
    [disabled, isAtLimit]
  )

  /**
   * Handles drag leave event
   */
  const handleDragLeave = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
    },
    []
  )

  /**
   * Handles drop event
   */
  const handleDrop = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)

      if (disabled || isAtLimit) return

      const droppedFiles = e.dataTransfer.files
      if (droppedFiles.length > 0) {
        handleFiles(droppedFiles)
      }
    },
    [disabled, isAtLimit, handleFiles]
  )

  /**
   * Opens the file picker
   */
  const handleClick = () => {
    if (!disabled && !isAtLimit && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  /**
   * Handles file input change
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (selectedFiles && selectedFiles.length > 0) {
      handleFiles(selectedFiles)
    }
    // Reset input value to allow selecting the same file again
    e.target.value = ""
  }

  /**
   * Removes a file from the list
   */
  const handleRemoveFile = (fileId: string) => {
    const fileToRemove = files.find((f) => f.id === fileId)
    if (fileToRemove) {
      // Revoke the preview URL to free memory
      URL.revokeObjectURL(fileToRemove.previewUrl)
    }
    onFilesChange(files.filter((f) => f.id !== fileId))
  }

  /**
   * Returns the appropriate icon for a file type
   */
  const getFileTypeIcon = (type: MediaFile["type"]) => {
    switch (type) {
      case "image":
        return <IconPhoto className="size-6" />
      case "video":
        return <IconMovie className="size-6" />
      default:
        return <IconFile className="size-6" />
    }
  }

  /**
   * Returns the progress variant based on status
   */
  const getProgressVariant = (status: MediaFile["status"]) => {
    switch (status) {
      case "complete":
        return "success"
      case "error":
        return "error"
      default:
        return "default"
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_EXTENSIONS}
        multiple={!hasVideo}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
        aria-label="Upload media files"
      />

      {/* Drop zone */}
      <Card
        className={cn(
          "cursor-pointer transition-all duration-200",
          isDragging && "border-primary ring-primary/20 ring-2",
          disabled && "cursor-not-allowed opacity-50",
          isAtLimit && !disabled && "cursor-default opacity-75"
        )}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            handleClick()
          }
        }}
        aria-disabled={disabled || isAtLimit}
        aria-label={
          isAtLimit
            ? "File limit reached"
            : "Click or drag files to upload"
        }
      >
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <div
            className={cn(
              "mb-4 rounded-full p-4",
              isDragging ? "bg-primary/10" : "bg-muted"
            )}
          >
            <IconUpload
              className={cn(
                "size-8",
                isDragging ? "text-primary" : "text-muted-foreground"
              )}
            />
          </div>

          <h3 className="text-foreground mb-1 font-medium">
            {isDragging
              ? "Drop files here"
              : isAtLimit
                ? "File limit reached"
                : "Upload media"}
          </h3>

          <p className="text-muted-foreground text-sm">
            {isAtLimit ? (
              hasVideo ? (
                "Remove the video to add images"
              ) : (
                `Maximum ${maxFiles} images reached`
              )
            ) : (
              <>
                Drag and drop or{" "}
                <span className="text-primary font-medium">browse</span>
              </>
            )}
          </p>

          <p className="text-muted-foreground mt-2 text-xs">
            JPG, PNG, GIF up to 10MB | MP4, MOV up to 200MB
          </p>
          <p className="text-muted-foreground text-xs">
            Max {MAX_IMAGES} images or {MAX_VIDEOS} video
          </p>
        </CardContent>
      </Card>

      {/* File preview grid */}
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {files.map((mediaFile) => (
            <Card
              key={mediaFile.id}
              className={cn(
                "group relative overflow-hidden",
                mediaFile.status === "error" && "border-destructive"
              )}
            >
              <CardContent className="p-0">
                {/* Preview content */}
                <div className="relative aspect-square">
                  {mediaFile.type === "image" ? (
                    // Image preview (blob URLs require unoptimized)
                    <Image
                      src={mediaFile.previewUrl}
                      alt={mediaFile.file.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    // Non-image file preview
                    <div className="bg-muted text-muted-foreground flex size-full flex-col items-center justify-center gap-2">
                      {getFileTypeIcon(mediaFile.type)}
                      <span className="max-w-full truncate px-2 text-xs">
                        {mediaFile.file.name}
                      </span>
                    </div>
                  )}

                  {/* Status overlay */}
                  {mediaFile.status !== "complete" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      {mediaFile.status === "uploading" && (
                        <IconLoader2 className="size-6 animate-spin text-white" />
                      )}
                      {mediaFile.status === "error" && (
                        <IconAlertCircle className="text-destructive size-6" />
                      )}
                      {mediaFile.status === "pending" && (
                        <IconLoader2 className="size-6 animate-spin text-white" />
                      )}
                    </div>
                  )}

                  {/* Complete indicator */}
                  {mediaFile.status === "complete" && (
                    <div className="absolute top-1 left-1">
                      <div className="rounded-full bg-green-500 p-0.5">
                        <IconCheck className="size-3 text-white" />
                      </div>
                    </div>
                  )}

                  {/* Remove button */}
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    className="absolute top-1 right-1 size-6 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveFile(mediaFile.id)
                    }}
                    aria-label={`Remove ${mediaFile.file.name}`}
                  >
                    <IconX className="size-3" />
                  </Button>
                </div>

                {/* Progress bar */}
                {(mediaFile.status === "uploading" ||
                  mediaFile.status === "pending") && (
                  <div className="absolute inset-x-0 bottom-0 p-1">
                    <Progress
                      value={mediaFile.uploadProgress}
                      variant={getProgressVariant(mediaFile.status)}
                      className="h-1"
                    />
                  </div>
                )}

                {/* Error message */}
                {mediaFile.status === "error" && mediaFile.error && (
                  <div className="bg-destructive/10 text-destructive absolute inset-x-0 bottom-0 p-1.5 text-center text-xs">
                    {mediaFile.error}
                  </div>
                )}

                {/* File size indicator */}
                <div className="bg-background/80 absolute bottom-1 left-1 rounded px-1 py-0.5 text-xs opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                  {formatFileSize(mediaFile.file.size)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary footer */}
      {files.length > 0 && (
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>
            {files.length} file{files.length !== 1 ? "s" : ""} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Revoke all preview URLs
              files.forEach((f) => URL.revokeObjectURL(f.previewUrl))
              onFilesChange([])
            }}
            disabled={disabled}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  )
}
