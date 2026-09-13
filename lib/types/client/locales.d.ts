/** `speech` namespace dictionaries: the read-aloud action and its settings row. */
/** Simplified Chinese dictionary (the key-set source of truth). */
export declare const zh: {
    'speak.read': string;
    'speak.stop': string;
    'speak.failed.unavailable': string;
    'speak.failed.provider': string;
    'row.title': string;
    'row.description': string;
    'row.provider': string;
    'row.language': string;
    'row.voice': string;
    'row.rate': string;
    'row.volume': string;
    'row.pitch': string;
    'row.percentUnit': string;
    'row.pitchUnit': string;
    'row.skipCode': string;
    'row.skipCode.description': string;
    'row.test': string;
    'row.testSample': string;
    'row.writeFailed': string;
    'provider.edge': string;
};
/** The speech namespace key union. */
export type SpeechKey = keyof typeof zh;
/** English dictionary, checked complete against the zh key set. */
export declare const en: {
    'speak.read': string;
    'speak.stop': string;
    'speak.failed.unavailable': string;
    'speak.failed.provider': string;
    'row.title': string;
    'row.description': string;
    'row.provider': string;
    'row.language': string;
    'row.voice': string;
    'row.rate': string;
    'row.volume': string;
    'row.pitch': string;
    'row.percentUnit': string;
    'row.pitchUnit': string;
    'row.skipCode': string;
    'row.skipCode.description': string;
    'row.test': string;
    'row.testSample': string;
    'row.writeFailed': string;
    'provider.edge': string;
};
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The read-aloud action and its settings row copy. */
        speech: SpeechKey;
    }
}
//# sourceMappingURL=locales.d.ts.map