/**
 * The compiled-in provider roster. Each entry is one folder under `providers/`;
 * adding a provider means adding its folder and one line here, and nothing else
 * in the host changes.
 */
import type { SpeechProvider, SpeechProviderId } from './types.ts';
/** Every provider this host can call, in display order. */
export declare const PROVIDERS: readonly SpeechProvider[];
/**
 * Resolve one provider by its identifier.
 * @param id - provider identifier from the settings or a request override.
 * @returns the provider, or undefined when no folder claims that id.
 */
export declare function providerById(id: SpeechProviderId): SpeechProvider | undefined;
//# sourceMappingURL=registry.d.ts.map