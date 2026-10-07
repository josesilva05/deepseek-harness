/** `localServers` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'title': '本地模型服务',
  'intro': '由本机上的服务器提供的模型路由，以及它当前加载的模型。',
  'refresh': '刷新',
  'loading': '正在读取本地模型服务…',
  'error': '无法读取本地模型服务：{message}',
} satisfies Record<string, string>

/** The localServers namespace key union. */
export type LocalServersKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Models page's local model servers card. */
    localServers: LocalServersKey
  }
}

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'title': 'Local model servers',
  'intro': 'Model routes served from a server on this machine, with the model it has loaded.',
  'refresh': 'Refresh',
  'loading': 'Reading the local model servers…',
  'error': 'Could not read the local model servers: {message}',
} satisfies Record<LocalServersKey, string>
