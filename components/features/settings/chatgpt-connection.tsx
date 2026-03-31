'use client'

/**
 * ChatGPT Connection Settings Component
 *
 * Allows users to connect their ChatGPT account via the Codex device-code
 * OAuth flow or by manually entering an API key. Shows connection status,
 * plan type, and provides disconnect functionality.
 *
 * @module components/features/settings/chatgpt-connection
 * @example
 * <ChatGPTConnection />
 */

import * as React from 'react'
import {
  IconBrandOpenai,
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconKey,
  IconLoader2,
  IconPlugConnected,
  IconPlugConnectedX,
} from '@tabler/icons-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useOpenAIConnection } from '@/hooks/use-openai-connection'

/**
 * ChatGPT connection settings panel.
 *
 * Displays one of three states:
 * 1. Connected - shows email, plan type, and disconnect button
 * 2. Device code flow active - shows user code, copy button, and polling spinner
 * 3. Disconnected - connect button and manual API key option
 *
 * @returns JSX element for the ChatGPT connection card.
 */
export function ChatGPTConnection() {
  const {
    status,
    loading,
    isPolling,
    deviceFlow,
    error,
    startDeviceFlow,
    saveApiKey,
    disconnect,
  } = useOpenAIConnection()

  const [showApiKeyInput, setShowApiKeyInput] = React.useState(false)
  const [apiKeyValue, setApiKeyValue] = React.useState('')
  const [isSavingKey, setIsSavingKey] = React.useState(false)
  const [isDisconnecting, setIsDisconnecting] = React.useState(false)

  /**
   * Copy the device user code to clipboard.
   */
  const handleCopyCode = React.useCallback(async () => {
    if (!deviceFlow?.userCode) return
    try {
      await navigator.clipboard.writeText(deviceFlow.userCode)
      toast.success('Code copied to clipboard')
    } catch {
      toast.error('Failed to copy code')
    }
  }, [deviceFlow?.userCode])

  /**
   * Handle manual API key submission.
   */
  const handleSaveApiKey = React.useCallback(async () => {
    if (!apiKeyValue.trim()) return
    setIsSavingKey(true)
    try {
      await saveApiKey(apiKeyValue.trim())
      setApiKeyValue('')
      setShowApiKeyInput(false)
      toast.success('API key saved successfully')
    } catch {
      toast.error(error || 'Failed to save API key')
    } finally {
      setIsSavingKey(false)
    }
  }, [apiKeyValue, saveApiKey, error])

  /**
   * Handle disconnect with confirmation.
   */
  const handleDisconnect = React.useCallback(async () => {
    setIsDisconnecting(true)
    try {
      await disconnect()
      toast.success('ChatGPT disconnected')
    } catch {
      toast.error('Failed to disconnect')
    } finally {
      setIsDisconnecting(false)
    }
  }, [disconnect])

  // Loading skeleton
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconBrandOpenai className="h-5 w-5" />
            <CardTitle className="text-base">ChatGPT Connection</CardTitle>
          </div>
          <CardDescription>Loading connection status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Connected state
  if (status?.connected) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconBrandOpenai className="h-5 w-5" />
              <CardTitle className="text-base">ChatGPT Connection</CardTitle>
            </div>
            <Badge
              variant="outline"
              className="border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
            >
              <IconCheck className="mr-1 h-3 w-3" />
              Connected
            </Badge>
          </div>
          <CardDescription>
            Your ChatGPT account is connected and ready for post generation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            {status.email && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Account</span>
                <span className="font-medium">{status.email}</span>
              </div>
            )}
            {status.planType && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Plan</span>
                <Badge variant="secondary" className="capitalize">
                  {status.planType}
                </Badge>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Method</span>
              <span className="font-medium">
                {status.method === 'oauth-device' ? 'OAuth' : 'API Key'}
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
          >
            {isDisconnecting ? (
              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <IconPlugConnectedX className="mr-2 h-4 w-4" />
            )}
            Disconnect ChatGPT
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Device code flow active
  if (deviceFlow && isPolling) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconBrandOpenai className="h-5 w-5" />
            <CardTitle className="text-base">ChatGPT Connection</CardTitle>
          </div>
          <CardDescription>
            Enter this code on OpenAI to connect your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User code display */}
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/50 p-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Your code
            </p>
            <div className="flex items-center gap-2">
              <code className="text-3xl font-bold tracking-[0.3em] font-mono">
                {deviceFlow.userCode}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleCopyCode}
              >
                <IconCopy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
              Waiting for authorization...
            </div>
          </div>

          {/* Open OpenAI link */}
          <Button asChild variant="default" className="w-full">
            <a
              href={deviceFlow.verificationUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconExternalLink className="mr-2 h-4 w-4" />
              Open OpenAI to Enter Code
            </a>
          </Button>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </CardContent>
      </Card>
    )
  }

  // Disconnected state - connect options
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <IconBrandOpenai className="h-5 w-5" />
          <CardTitle className="text-base">ChatGPT Connection</CardTitle>
        </div>
        <CardDescription>
          Connect your ChatGPT account to use your subscription for AI-powered
          post generation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* OAuth device flow button */}
        <Button
          className="w-full"
          onClick={startDeviceFlow}
          disabled={isPolling}
        >
          <IconPlugConnected className="mr-2 h-4 w-4" />
          Connect ChatGPT Account
        </Button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Manual API key option */}
        {!showApiKeyInput ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowApiKeyInput(true)}
          >
            <IconKey className="mr-2 h-4 w-4" />
            Enter API Key Manually
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="sk-..."
                value={apiKeyValue}
                onChange={(e) => setApiKeyValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveApiKey()
                }}
                className={cn(
                  'font-mono text-sm',
                  error && 'border-destructive'
                )}
              />
              <Button
                onClick={handleSaveApiKey}
                disabled={!apiKeyValue.trim() || isSavingKey}
              >
                {isSavingKey ? (
                  <IconLoader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Save'
                )}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => {
                setShowApiKeyInput(false)
                setApiKeyValue('')
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
