/**
 * Browser playback over the host's synthesis route.
 *
 * The whole reply goes out in one request and the audio is played as it
 * arrives: the response body is read chunk by chunk and appended to a
 * MediaSource buffer the audio element already plays from, so speech starts on
 * the first frames and never waits for the rest — the audio equivalent of
 * watching an answer stream in.
 *
 * A browser whose MediaSource cannot take MP3 falls back to one request per
 * sentence and blob playback, which still works but waits for each sentence.
 */
import { splitRequests, splitSentences } from "./sentences.js";
/** Route the host exposes for synthesis. */
const SPEAK_ROUTE = '/speech/speak';
/** Content type the host answers with, and the one MediaSource must accept. */
const AUDIO_TYPE = 'audio/mpeg';
/**
 * Whether this browser can play encoded audio as it streams in.
 * @returns true when MediaSource accepts the host's audio type.
 */
function streamsAudio() {
    return typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(AUDIO_TYPE);
}
/**
 * Read the error a failed synthesis answered with.
 * @param response - the failed response.
 * @returns the host's message, or the status line.
 */
async function failureOf(response) {
    try {
        const body = await response.json();
        if (typeof body.error === 'string')
            return body.error;
    }
    catch (_notJson) {
        // A proxy or a truncated stream can answer with something that is not the
        // route's JSON; the status line still says what happened.
    }
    return `${response.status} ${response.statusText}`;
}
/**
 * Read the request bound a refusal named.
 * @param message - the host's error text.
 * @returns the character limit, or undefined when the refusal was about something else.
 */
function limitOf(message) {
    const match = /1\.\.(\d+) characters/.exec(message);
    if (match === null)
        return undefined;
    // A matched group is always a string here; the cast states the regex's own
    // guarantee instead of adding a branch no input can reach.
    const limit = Number.parseInt(match[1], 10);
    return Number.isFinite(limit) && limit > 0 ? limit : undefined;
}
/**
 * Resolve once a buffer is ready to accept appends.
 * @param media - the MediaSource the audio element plays from.
 * @returns the source buffer, in sequence mode.
 */
function openBuffer(media) {
    return new Promise((resolve, reject) => {
        media.addEventListener('sourceopen', () => {
            try {
                const buffer = media.addSourceBuffer(AUDIO_TYPE);
                // Raw MP3 frames carry no timestamps, so sequence mode is what lets
                // MediaSource stitch them; segments mode would reject the first append.
                buffer.mode = 'sequence';
                resolve(buffer);
            }
            catch (error) {
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        }, { once: true });
    });
}
/**
 * Append one chunk and wait for the buffer to accept it.
 * @param buffer - the source buffer.
 * @param chunk - encoded audio bytes.
 */
async function appendChunk(buffer, chunk) {
    const settled = new Promise((resolve) => {
        buffer.addEventListener('updateend', () => { resolve(); }, { once: true });
    });
    // The copy re-anchors the bytes on a plain ArrayBuffer: the reader can hand
    // back a view whose buffer is shared or detached, which SourceBuffer refuses.
    buffer.appendBuffer(new Uint8Array(chunk));
    await settled;
}
/**
 * Resolve when an element stops producing sound, whether it ended or failed.
 * @param element - the audio element.
 */
function finished(element) {
    if (element.ended)
        return Promise.resolve();
    return new Promise((resolve) => {
        element.addEventListener('ended', () => { resolve(); }, { once: true });
        element.addEventListener('error', () => { resolve(); }, { once: true });
    });
}
/** Owns the audio currently playing and the requests behind it. */
export class SpeechAudio {
    /** Cancellation token: every stop or new request invalidates what is running. */
    generation = 0;
    playing;
    objectUrl;
    /**
     * Speak one text. The whole reply travels in one request whenever it fits, and
     * playback starts on the first audio frames that arrive.
     * @param text - projected spoken text.
     * @param overrides - preview overrides, or undefined to use the durable settings.
     * @param onEnded - called once the last audio has played out.
     */
    async speak(text, overrides, onEnded) {
        const requests = splitRequests(text);
        if (requests.length === 0)
            return;
        const generation = ++this.generation;
        this.dropPlayback();
        const single = requests.length === 1 ? requests[0] : undefined;
        const played = single !== undefined && streamsAudio()
            ? await this.streamRequest(single, overrides, generation)
            : await this.playSentenceBySentence(splitSentences(text), overrides, generation);
        // Both paths answer false when a later stop or speak superseded them, so a
        // true answer is the only thing that reports an end.
        this.report(played, onEnded);
    }
    /**
     * Report an end for a run that played out, and stay silent for one that a
     * later stop or speak superseded.
     * @param played - whether the run reached its last audio frame.
     * @param onEnded - the caller's end callback.
     */
    report(played, onEnded) {
        if (played)
            onEnded();
    }
    /** Stop playback and abandon whatever is still arriving. */
    stop() {
        this.generation += 1;
        this.dropPlayback();
    }
    /** Stop playback and release the last object URL. */
    dispose() {
        this.stop();
    }
    /**
     * Stream one request's audio into a MediaSource-backed element.
     * @param text - the whole projected text.
     * @param overrides - preview overrides, when any.
     * @param generation - token this request belongs to.
     * @returns whether playback ran to the end under the same generation.
     */
    async streamRequest(text, overrides, generation) {
        const response = await fetch(SPEAK_ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text, ...overrides }),
        });
        if (!response.ok) {
            const message = await failureOf(response);
            const limit = limitOf(message);
            if (limit === undefined)
                throw new Error(message);
            // The host enforces a smaller request than this build sends — an older
            // server, or a tighter deployment bound. Speak in pieces it accepts
            // instead of failing the whole reply.
            return await this.playSentenceBySentence(splitSentences(text, limit), overrides, generation);
        }
        const body = response.body;
        if (body === null)
            throw new Error('speech stream carried no body');
        const media = new MediaSource();
        const url = URL.createObjectURL(media);
        const element = new Audio(url);
        this.playing = element;
        this.objectUrl = url;
        const buffer = await openBuffer(media);
        const reader = body.getReader();
        let started = false;
        try {
            for (;;) {
                const { done, value } = await reader.read();
                if (generation !== this.generation) {
                    await reader.cancel();
                    return false;
                }
                if (value !== undefined && value.length > 0) {
                    await appendChunk(buffer, value);
                    if (!started) {
                        started = true;
                        // The first frames are enough to begin: the element keeps playing
                        // while the rest of the reply is still being synthesized.
                        await element.play();
                    }
                }
                if (done)
                    break;
            }
        }
        finally {
            if (generation !== this.generation)
                this.releaseChunk(url);
        }
        if (!started)
            return false;
        if (media.readyState === 'open')
            media.endOfStream();
        await finished(element);
        this.releaseChunk(url);
        return generation === this.generation;
    }
    /**
     * Fallback path for a reply the browser cannot stream: one request per
     * sentence, each played as a blob.
     * @param sentences - sentence-sized spans.
     * @param overrides - preview overrides, when any.
     * @param generation - token this run belongs to.
     * @returns whether every span played out under the same generation.
     */
    async playSentenceBySentence(sentences, overrides, generation) {
        let pending;
        for (const [index, sentence] of sentences.entries()) {
            pending ??= this.fetchAudio(sentence, overrides);
            const audio = await pending;
            pending = undefined;
            if (generation !== this.generation)
                return false;
            const next = sentences[index + 1];
            if (next !== undefined) {
                pending = this.fetchAudio(next, overrides);
                // A stop cancels the lookahead; the loop reports that through the
                // generation, so the rejection must not surface as unhandled.
                pending.catch(() => { });
            }
            if (!await this.playBlob(audio, generation))
                return false;
        }
        return true;
    }
    /**
     * Fetch the audio of one span.
     * @param text - span to speak.
     * @param overrides - preview overrides, when any.
     * @returns the encoded audio the host answered with.
     */
    async fetchAudio(text, overrides) {
        const response = await fetch(SPEAK_ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text, ...overrides }),
        });
        if (!response.ok)
            throw new Error(await failureOf(response));
        return await response.blob();
    }
    /**
     * Play one buffered span and wait for it to finish.
     * @param audio - encoded audio bytes.
     * @param generation - token this span belongs to.
     * @returns whether the span played out under the same generation.
     */
    async playBlob(audio, generation) {
        const url = URL.createObjectURL(audio);
        const element = new Audio(url);
        this.playing = element;
        this.objectUrl = url;
        element.addEventListener('ended', () => { }, { once: true });
        try {
            await element.play();
        }
        catch (error) {
            this.releaseChunk(url);
            throw error;
        }
        await finished(element);
        this.releaseChunk(url);
        return generation === this.generation;
    }
    dropPlayback() {
        const element = this.playing;
        const url = this.objectUrl;
        this.playing = undefined;
        this.objectUrl = undefined;
        element?.pause();
        if (url !== undefined)
            URL.revokeObjectURL(url);
    }
    releaseChunk(url) {
        if (this.objectUrl !== url)
            return;
        this.playing = undefined;
        this.objectUrl = undefined;
        URL.revokeObjectURL(url);
    }
}
//# sourceMappingURL=speech-audio.js.map