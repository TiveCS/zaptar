import { zodResolver } from '@hookform/resolvers/zod'
import * as React from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import type { Connection, ConnectionDraft, DialectId } from '@shared/types'
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

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: Connection
  onSave: (draft: ConnectionDraft) => Promise<void>
}

export function ConnectionForm({ open, onOpenChange, editing, onSave }: Props): React.JSX.Element {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? {
          label: editing.label,
          dialect: editing.dialect,
          host: editing.host,
          port: editing.port,
          username: editing.username,
          password: '',
          database: editing.database,
          sslEnabled: !!editing.ssl
        }
      : {
          label: '',
          dialect: 'mysql',
          host: 'localhost',
          port: 3306,
          username: 'root',
          password: '',
          database: '',
          sslEnabled: false
        }
  })

  React.useEffect(() => {
    if (!open) return
    reset(
      editing
        ? {
            label: editing.label,
            dialect: editing.dialect,
            host: editing.host,
            port: editing.port,
            username: editing.username,
            password: '',
            database: editing.database,
            sslEnabled: !!editing.ssl
          }
        : {
            label: '',
            dialect: 'mysql',
            host: 'localhost',
            port: 3306,
            username: 'root',
            password: '',
            database: '',
            sslEnabled: false
          }
    )
  }, [open, editing, reset])

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit connection' : 'New connection'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Update the connection details.'
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

          {/* Username + Password */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" {...register('username')} />
              {errors.username && (
                <p className="text-xs text-[var(--color-destructive)]">{errors.username.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">
                {editing ? 'Password (leave blank to keep)' : 'Password'}
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register('password')}
              />
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

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : editing ? 'Save changes' : 'Add connection'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
