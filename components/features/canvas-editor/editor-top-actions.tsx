'use client';

/**
 * Editor Top Actions Component
 * Top-right floating action buttons for reset, save, and export
 * @module components/features/canvas-editor/editor-top-actions
 */

import {
  IconTrash,
  IconDeviceFloppy,
  IconDownload,
  IconBrandLinkedin,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';

/**
 * Props for the EditorTopActions component
 */
interface EditorTopActionsProps {
  onReset: () => void;
  onSaveTemplate: () => void;
  onExport: () => void;
  /** Callback to open the Post to LinkedIn dialog */
  onPostToLinkedIn: () => void;
}

/**
 * Top-right floating action bar with Reset, Save Template, Export, and Post buttons
 * @param props - Component props
 * @returns Floating action buttons JSX
 */
export function EditorTopActions({
  onReset,
  onSaveTemplate,
  onExport,
  onPostToLinkedIn,
}: EditorTopActionsProps) {
  return (
    <div className="shrink-0 border-b border-l bg-background px-3 py-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          className="h-9 w-full bg-[#0A66C2] text-white hover:bg-[#004182] gap-1.5"
          onClick={onPostToLinkedIn}
        >
          <IconBrandLinkedin className="h-4 w-4" />
          Create Post
        </Button>
        <Button variant="outline" size="sm" className="h-9 w-full gap-1.5" onClick={onExport}>
          <IconDownload className="h-4 w-4" />
          Export
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" className="h-9 w-full gap-1.5" onClick={onSaveTemplate}>
          <IconDeviceFloppy className="h-4 w-4" />
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="h-9 w-full text-muted-foreground hover:text-destructive gap-1.5"
        >
          <IconTrash className="h-4 w-4" />
          Reset
        </Button>
      </div>
    </div>
  );
}
