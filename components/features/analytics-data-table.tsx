"use client"

/**
 * Analytics Data Table Component (FE-006)
 * @description TanStack React Table displaying analytics data with sortable columns,
 * pagination, multi-column "all metrics" mode, granularity toggle, and CSV export.
 * @module components/features/analytics-data-table
 */

import { useEffect, useMemo, useState } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { motion } from "framer-motion"
import {
  IconDownload,
  IconArrowUp,
  IconArrowDown,
  IconSelector,
  IconTable,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { fadeSlideUpVariants } from "@/lib/animations"
import { toast } from "sonner"
import type { AnalyticsDataPoint, MultiMetricData } from "@/hooks/use-analytics-v2"
import { ALL_MODE_METRICS } from "@/hooks/use-analytics-v2"
import { LottieEmptyState } from "@/components/shared/lottie-empty-state"

/** Metric display labels */
const METRIC_LABELS: Record<string, string> = {
  impressions: "Impressions",
  unique_reach: "Unique Reach",
  reactions: "Reactions",
  comments: "Comments",
  reposts: "Reposts",
  saves: "Saves",
  sends: "Sends",
  engagements: "Engagements",
  engagements_rate: "Engagement Rate",
  followers: "Followers",
  profile_views: "Profile Views",
  search_appearances: "Search Appearances",
  connections: "Connections",
}

/**
 * Props for the AnalyticsDataTable component
 */
interface AnalyticsDataTableProps {
  /** Analytics data points */
  data: AnalyticsDataPoint[]
  /** Currently selected metric */
  metric: string
  /** Current granularity setting */
  granularity: string
  /** Callback when granularity changes */
  onGranularityChange: (granularity: string) => void
  /** Whether data is loading */
  isLoading: boolean
  /** Multi-metric data map (when metric is "all") */
  multiData?: MultiMetricData | null
}

/**
 * Row data shape for single-metric mode
 */
interface SingleRowData {
  date: string
  rawDate: string
  value: number
}

/**
 * Row data shape for multi-metric "all" mode
 */
interface MultiRowData {
  date: string
  rawDate: string
  impressions: number
  reactions: number
  comments: number
  reposts: number
  engagements: number
  engagement_rate: string
}

/**
 * Format date for display in the table
 * @param dateStr - ISO date string
 * @returns Formatted date
 */
function formatTableDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/**
 * Format a numeric value for display
 * @param value - The number to format
 * @param isRate - Whether this is a rate/percentage metric
 * @returns Formatted string
 */
function formatValue(value: number, isRate: boolean): string {
  if (isRate) return `${value.toFixed(2)}%`
  return value.toLocaleString()
}

/**
 * Build sortable column header
 * @param label - Column label
 * @returns Header render function
 */
function sortableHeader(label: string) {
  return ({ column }: { column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (desc: boolean) => void } }) => {
    const sorted = column.getIsSorted()
    return (
      <button
        type="button"
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => column.toggleSorting(sorted === "asc")}
      >
        {label}
        {sorted === "asc" ? (
          <IconArrowUp className="size-3.5" />
        ) : sorted === "desc" ? (
          <IconArrowDown className="size-3.5" />
        ) : (
          <IconSelector className="size-3.5 text-muted-foreground" />
        )}
      </button>
    )
  }
}

/**
 * Escape a value for safe CSV output
 * @param value - The value to escape
 * @returns CSV-safe string, quoted if it contains commas, quotes, or newlines
 */
function csvEscape(value: unknown): string {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Export multi-column data to CSV
 * @param data - Multi-row data array
 */
function exportMultiCSV(data: MultiRowData[]) {
  const headers = "Date,Impressions,Reactions,Comments,Reposts,Engagements,Engagement Rate"
  const rows = data.map((r) =>
    [r.rawDate, r.impressions, r.reactions, r.comments, r.reposts, r.engagements, r.engagement_rate].map(csvEscape).join(",")
  )
  downloadCSV([headers, ...rows].join("\n"), "analytics_all_metrics")
}

/**
 * Export single-column data to CSV
 * @param data - Single-row data array
 * @param metric - Metric name
 */
function exportSingleCSV(data: SingleRowData[], metric: string) {
  const label = METRIC_LABELS[metric] || metric
  const isRate = metric === "engagements_rate"
  const rows = [
    `Date,${csvEscape(label)}`,
    ...data.map((row) => `${csvEscape(row.rawDate)},${csvEscape(isRate ? row.value.toFixed(2) : row.value)}`),
  ]
  downloadCSV(rows.join("\n"), `analytics_${metric}`)
}

/**
 * Download a CSV string as a file
 * @param csvContent - CSV string content
 * @param prefix - Filename prefix
 */
function downloadCSV(csvContent: string, prefix: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${prefix}_${new Date().toISOString().split("T")[0]}.csv`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  toast.success("CSV exported successfully")
}

/**
 * Inner table rendering component to handle generic row types
 * @param props.table - TanStack Table instance
 * @returns Table with pagination controls
 */
function DataTableInner<T>({
  table,
}: {
  table: ReturnType<typeof useReactTable<T>>
}) {
  return (
    <div className="space-y-3">
      <div className="overflow-auto rounded-md border border-border/50">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rows per page</span>
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-[65px]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <IconChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <IconChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Analytics Data Table with sortable columns, pagination, multi-column "all" mode,
 * granularity toggle, and CSV export
 * @param props - Component props
 * @returns Data table card with controls
 */
export function AnalyticsDataTable({
  data,
  metric,
  granularity,
  onGranularityChange,
  isLoading,
  multiData,
}: AnalyticsDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])

  // Reset sorting when metric changes to avoid stale sort state across table types
  useEffect(() => {
    setSorting([])
  }, [metric])

  const metricLabel = METRIC_LABELS[metric] || metric
  const isRate = metric === "engagements_rate"
  const isAllMode = metric === "all" && multiData

  // Build multi-column data for "all" mode
  const multiTableData: MultiRowData[] = useMemo(() => {
    if (!isAllMode) return []

    const dateMap = new Map<string, MultiRowData>()
    for (const m of ALL_MODE_METRICS) {
      for (const pt of multiData[m] ?? []) {
        if (!dateMap.has(pt.date)) {
          dateMap.set(pt.date, {
            date: formatTableDate(pt.date),
            rawDate: pt.date,
            impressions: 0,
            reactions: 0,
            comments: 0,
            reposts: 0,
            engagements: 0,
            engagement_rate: "0.00%",
          })
        }
        const row = dateMap.get(pt.date)!
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic metric key assignment
        ;(row as unknown as Record<string, number>)[m] = pt.value
      }
    }

    // Compute engagement rate per row
    for (const row of dateMap.values()) {
      const imp = row.impressions || 0
      const eng = row.engagements || 0
      row.engagement_rate = imp > 0 ? `${((eng / imp) * 100).toFixed(2)}%` : "0.00%"
    }

    return Array.from(dateMap.values()).sort((a, b) => b.rawDate.localeCompare(a.rawDate))
  }, [isAllMode, multiData])

  // Build single-column data
  const singleTableData: SingleRowData[] = useMemo(
    () =>
      data.map((d) => ({
        date: formatTableDate(d.date),
        rawDate: d.date,
        value: d.value,
      })),
    [data]
  )

  // Multi-column definitions for "all" mode
  const multiColumns: ColumnDef<MultiRowData>[] = useMemo(
    () => [
      {
        accessorKey: "rawDate",
        header: sortableHeader("Date"),
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">{row.original.date}</span>
        ),
      },
      {
        accessorKey: "impressions",
        header: sortableHeader("Impressions"),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{row.original.impressions.toLocaleString()}</span>
        ),
      },
      {
        accessorKey: "reactions",
        header: sortableHeader("Reactions"),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{row.original.reactions.toLocaleString()}</span>
        ),
      },
      {
        accessorKey: "comments",
        header: sortableHeader("Comments"),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{row.original.comments.toLocaleString()}</span>
        ),
      },
      {
        accessorKey: "reposts",
        header: sortableHeader("Reposts"),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{row.original.reposts.toLocaleString()}</span>
        ),
      },
      {
        accessorKey: "engagements",
        header: sortableHeader("Engagements"),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{row.original.engagements.toLocaleString()}</span>
        ),
      },
      {
        accessorKey: "engagement_rate",
        header: sortableHeader("Eng. Rate"),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{row.original.engagement_rate}</span>
        ),
      },
    ],
    []
  )

  // Single-column definitions
  const singleColumns: ColumnDef<SingleRowData>[] = useMemo(
    () => [
      {
        accessorKey: "rawDate",
        header: sortableHeader("Date"),
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">{row.original.date}</span>
        ),
      },
      {
        accessorKey: "value",
        header: sortableHeader(metricLabel),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{formatValue(row.original.value, isRate)}</span>
        ),
      },
    ],
    [metricLabel, isRate]
  )

  // Multi-column table
  const multiTable = useReactTable({
    data: multiTableData,
    columns: multiColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  // Single-column table
  const singleTable = useReactTable({
    data: singleTableData,
    columns: singleColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  const isEmpty = isAllMode ? multiTableData.length === 0 : singleTableData.length === 0

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      variants={fadeSlideUpVariants}
      initial="initial"
      animate="animate"
    >
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <IconTable className="size-5" />
                Data Table
              </CardTitle>
              <CardDescription>
                {isAllMode
                  ? `All metrics data by ${granularity} intervals`
                  : `${metricLabel} data by ${granularity} intervals`}
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              {/* Granularity Toggle */}
              <ToggleGroup
                type="single"
                value={granularity}
                onValueChange={(value) => {
                  if (value) onGranularityChange(value)
                }}
                variant="outline"
                className="shrink-0"
              >
                <ToggleGroupItem
                  value="daily"
                  aria-label="Daily granularity"
                  className={cn(
                    "text-xs transition-all",
                    "data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
                  )}
                >
                  Daily
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="weekly"
                  aria-label="Weekly granularity"
                  className={cn(
                    "text-xs transition-all",
                    "data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
                  )}
                >
                  Weekly
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="monthly"
                  aria-label="Monthly granularity"
                  className={cn(
                    "text-xs transition-all",
                    "data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
                  )}
                >
                  Monthly
                </ToggleGroupItem>
              </ToggleGroup>

              {/* CSV Export */}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  if (isAllMode) {
                    exportMultiCSV(multiTableData)
                  } else {
                    exportSingleCSV(singleTableData, metric)
                  }
                }}
                disabled={isEmpty}
              >
                <IconDownload className="size-3.5" />
                CSV
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isEmpty ? (
            <LottieEmptyState
              title="Still getting your data"
              description="Please wait while we calculate your analytics. Data will appear here after your first sync."
            />
          ) : isAllMode ? (
            <DataTableInner table={multiTable} />
          ) : (
            <DataTableInner table={singleTable} />
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
