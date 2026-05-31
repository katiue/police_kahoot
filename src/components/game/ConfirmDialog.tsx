'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-5 backdrop-blur-md">
      <Card className="w-full max-w-md border-border/60 bg-card/85 shadow-[0_0_60px_rgba(255,61,61,0.12)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className={destructive ? 'size-5 text-red-400' : 'size-5 text-amber-400'} />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel}>
              Hủy
            </Button>
            <Button variant={destructive ? 'destructive' : 'accent'} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
