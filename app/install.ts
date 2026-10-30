export type InstallHelp = 'installed' | 'iphone' | 'prompt' | 'android' | 'none'

export interface DeviceInfo {
  userAgent: string
  maxTouchPoints: number
  standalone: boolean
  /** The browser has offered its own install prompt. */
  canPrompt: boolean
}

function isIos({ userAgent, maxTouchPoints }: DeviceInfo): boolean {
  // iPads report themselves as Macs, so touch is what gives them away.
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
}

export function installHelp(device: DeviceInfo): InstallHelp {
  if (device.standalone) return 'installed'
  if (isIos(device)) return 'iphone'
  if (device.canPrompt) return 'prompt'
  return /Android/.test(device.userAgent) ? 'android' : 'none'
}
