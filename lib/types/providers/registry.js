/**
 * The compiled-in provider roster. Each entry is one folder under `providers/`;
 * adding a provider means adding its folder and one line here, and nothing else
 * in the host changes.
 */
import { edgeProvider } from "./edge/server.js";
/** Every provider this host can call, in display order. */
export const PROVIDERS = Object.freeze([edgeProvider]);
/**
 * Resolve one provider by its identifier.
 * @param id - provider identifier from the settings or a request override.
 * @returns the provider, or undefined when no folder claims that id.
 */
export function providerById(id) {
    return PROVIDERS.find(provider => provider.id === id);
}
//# sourceMappingURL=registry.js.map