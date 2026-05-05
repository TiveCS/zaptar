import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Eye, EyeOff, Loader2, XCircle } from 'lucide-react'
import * as React from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import type { Connection, ConnectionDraft, ConnectionTestResult, DialectId } from '@shared/types'
import { api } from '@renderer/lib/api'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'

const schema = z.object({
  label: z.string().min(1, 'Label is required'),
  dialect: z.enum(['mysql', 'mariadb']),
  host: z.string().min(1, 'Host is required'),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1, 'Username is required'),
  password: z.string(),
  database: z.string().min(1, 'Database name is required'),
  sslEnabled: z.boolean()
})

type FormValues = z.infer<typeof schema>

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; serverVersion: string }
  | { status: 'error'; message: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: Connection
  duplicateFrom?: Connection
  onSave: (draft: ConnectionDraft) => Promise<void>
}

function blankDefaults(): FormValues {
  return {
    label: '',
    dialect: 'mysql',
    host: 'localhost',
    port: 3306,
    username: 'root',
    password: '',
    database: '',
    sslEnabled: false
  }
}

function editingDefaults(conn: Connection): FormValues {
  return {
    label: conn.label,
    dialect: conn.dialect,
    host: conn.host,
    port: conn.port,
    username: conn.username,
    password: '',
    database: conn.database,
    sslEnabled: !!conn.ssl
  }
}

function duplicateDefaults(conn: Connection): FormValues {
  return {
    ...editingDefaults(conn),
    label: `Copy of ${conn.label}`
  }
}

export function ConnectionForm({ open, onOpenChange, editing, duplicateFrom, onSave }: Props): React.JSX.Element {
  const [showPassword, setShowPassword] = React.useState(false)
  const [testState, setTestState] = React.useState<TestState>({ status: 'idle' })

  const {
    register,
    handleSubmit,
    reset,
    control,
    getValues,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? editingDefaults(editing)
      : duplicateFrom
        ? duplicateDefaults(duplicateFrom)
        : blankDefaults()
  })

  React.useEffect(() => {
    if (!open) return
    setTestState({ status: 'idle' })
    setShowPassword(false)
    reset(
      editing
        ? editingDefaults(editing)
        : duplicateFrom
          ? duplicateDefaults(duplicateFrom)
          : blankDefaults()
    )
  }, [open, editing, duplicateFrom, reset])

  async function handleTest(): Promise<void> {
    setTestState({ status: 'testing' })
    let result: ConnectionTestResult
    try {
      const values = getValues()
      // Edit mode + blank password → test the saved connection (keeps existing password)
      if (editing && !values.password) {
        result = await api.connection.test(editing.id)
      } else {
        const { sslEnabled, ...rest } = values
        const draft: ConnectionDraft = {
          ...rest,
          dialect: rest.dialect as DialectId,
          ssl: sslEnabled ? { rejectUnauthorized: true } : undefined
        }
        result = await api.connection.testDraft(draft)
      }
    } catch (err) {
      result = { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
    if (result.ok) {
      setTestState({ status: 'ok', serverVersion: result.serverVersion ?? 'unknown' })
    } else {
      setTestState({ status: 'error', message: result.error ?? 'Connection failed' })
    }
  }

  async function onSubmit(values: FormValues): Promise<void> {
    const { sslEnabled, ...rest } = values
    const draft: ConnectionDraft = {
      ...rest,
      dialect: rest.dialect as DialectId,
      ssl: sslEnabled ? { rejectUnauthorized: true } : undefined
    }
    await onSave(draft)
    onOpenChange(false)
  }

  const isTesting = testState.status === 'testing'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit connection' : duplicateFrom ? 'Duplicate connection' : 'New connection'}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? 'Update the connection details.'
              : duplicateFrom
                ? 'Fields are pre-filled from the original. Re-enter the password to save.'
                : 'Add a MySQL or MariaDB database connection. The password is encrypted by your OS keychain.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-4">
          {/* Label */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="label">Label</Label>
            <Input id="label" placeholder="e.g. prod-eu-west" {...register('label')} />
            {errors.label && (
              <p className="text-xs text-[var(--color-destructive)]">{errors.label.message}</p>
            )}
          </div>

          {/* Dialect */}
          <div className="flex flex-col gap-1.5">
            <Label>Dialect</Label>
            <Controller
              control={control}
              name="dialect"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select dialect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mysql">MySQL</SelectItem>
                    <SelectItem value="mariadb">MariaDB</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Host + Port */}
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="host">Host</Label>
              <Input id="host" placeholder="localhost" {...register('host')} />
              {errors.host && (
                <p className="text-xs text-[var(--color-destructive)]">{errors.host.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="port">Port</Label>
              <Input id="port" type="number" {...register('port', { valueAsNumber: true })} />
              {errors.port && (
                <p className="text-xs text-[var(--color-destructive)]">{errors.port.message}</p>
              )}
            </div>
          </div>

          {/* Username + Password — items-end aligns inputs even when labels differ in height */}
          <div className="grid grid-cols-2 items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" {...register('username')} />
              {errors.username && (
                <p className="text-xs text-[var(--color-destructive)]">{errors.username.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">
                {editing ? 'Password' : 'Password'}
                {editing && (
                  <span className="ml-1 text-xs font-normal text-[var(--color-muted-foreground)]">
                    (blank = keep)
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="pr-9"
                  {...register('password')}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Database */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="database">Database</Label>
            <Input id="database" placeholder="my_database" {...register('database')} />
            {errors.database && (
              <p className="text-xs text-[var(--color-destructive)]">{errors.database.message}</p>
            )}
          </div>

          {/* SSL */}
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="rounded" {...register('sslEnabled')} />
            Enable SSL / TLS
          </label>

          {/* Test result */}
          {testState.status === 'ok' && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-diff-added)]">
              <CheckCircle2 className="size-3.5 shrink-0" />
              Connected · {testState.serverVersion}
            </div>
          )}
          {testState.status === 'error' && (
            <div className="flex items-start gap-1.5 text-xs text-[var(--color-destructive)]">
              <XCircle className="mt-0.5 size-3.5 shrink-0" />
              <span className="break-all">{testState.message}</span>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={isTesting || isSubmitting}
            >
              {isTesting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Testing…
                </>
              ) : (
                'Test connection'
              )}
            </Button>
            <div className="flex-1" />
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isTesting}>
              {isSubmitting
                ? 'Saving…'
                : editing
                  ? 'Save changes'
                  : duplicateFrom
                    ? 'Create duplicate'
                    : 'Add connection'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
