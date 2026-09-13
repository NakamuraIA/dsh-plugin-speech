/** `speech` namespace dictionaries: the read-aloud action and its settings row. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'speak.read': '朗读这条回复',
  'speak.stop': '停止朗读',
  'speak.failed.unavailable': '这条回复暂时无法朗读',
  'speak.failed.provider': '语音服务调用失败',
  'row.title': '朗读',
  'row.description': '用于朗读助手回复的语音',
  'row.provider': '服务',
  'row.language': '语言',
  'row.voice': '声音',
  'row.rate': '速度',
  'row.volume': '音量',
  'row.pitch': '音高',
  'row.percentUnit': '%',
  'row.pitchUnit': 'Hz',
  'row.skipCode': '跳过代码',
  'row.skipCode.description': '朗读时忽略代码块与表格',
  'row.test': '试听',
  'row.testSample': '这就是我朗读回复的声音。',
  'row.writeFailed': '未保存——仍在使用之前的值。',
  'provider.edge': 'Microsoft Edge',
} satisfies Record<string, string>

/** The speech namespace key union. */
export type SpeechKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'speak.read': 'Read this reply aloud',
  'speak.stop': 'Stop reading aloud',
  'speak.failed.unavailable': 'This reply has no spoken text',
  'speak.failed.provider': 'The speech service call failed',
  'row.title': 'Read aloud',
  'row.description': 'The voice used to read assistant replies',
  'row.provider': 'Service',
  'row.language': 'Language',
  'row.voice': 'Voice',
  'row.rate': 'Speed',
  'row.volume': 'Volume',
  'row.pitch': 'Pitch',
  'row.percentUnit': '%',
  'row.pitchUnit': 'Hz',
  'row.skipCode': 'Skip code',
  'row.skipCode.description': 'Leave code blocks and tables out of the reading',
  'row.test': 'Test voice',
  'row.testSample': 'This is how I read your replies.',
  'row.writeFailed': 'Not saved — the previous value is still in effect.',
  'provider.edge': 'Microsoft Edge',
} satisfies Record<SpeechKey, string>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The read-aloud action and its settings row copy. */
    speech: SpeechKey
  }
}
