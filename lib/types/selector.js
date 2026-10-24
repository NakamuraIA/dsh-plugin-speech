/**
 * The speech selector: turns the durable settings section plus one request's
 * overrides into the exact call a provider receives. This is the only place
 * that knows how a settings block maps onto a provider, so a provider folder
 * never reads settings and the HTTP route never names a vendor.
 */
import { providerById } from "./providers/registry.js";
/**
 * Read the voice and tuning the durable block contributes.
 * @param section - durable speech settings.
 * @returns the block's voice and the tuning keys its provider declares.
 */
function blockOf(section) {
    // One provider today, so the block is read directly; the next provider turns
    // this into a switch over the provider id.
    return {
        voice: section.edge.voice,
        tuning: { rate: section.edge.rate, volume: section.edge.volume, pitch: section.edge.pitch },
    };
}
/**
 * Resolve one synthesis call.
 * @param section - durable speech settings.
 * @param text - text to speak.
 * @param overrides - optional preview overrides from the settings screen.
 * @returns the provider and its request, or undefined when no folder claims the id.
 */
export function selectSpeech(section, text, overrides = {}) {
    const id = (overrides.provider ?? section.provider);
    const provider = providerById(id);
    if (provider === undefined)
        return undefined;
    const block = blockOf(section);
    return {
        provider,
        request: {
            text,
            voice: overrides.voice ?? block.voice,
            tuning: { ...block.tuning, ...overrides.tuning },
        },
    };
}
//# sourceMappingURL=selector.js.map