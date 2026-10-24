/**
 * Browser playback over the host's synthesis route.
 *
 * The whole reply goes out in one request and the host streams the audio back
 * while the service is still synthesizing it. The browser appends each chunk to
 * a MediaSource buffer and starts playing once a few seconds of audio are
 * buffered — early enough to feel immediate, late enough that playback cannot
 * catch the network and stall in the middle of a sentence. That pre-buffer is
 * the whole trick: streaming alone started too early and paused whenever the
 * service fell behind; waiting for the whole file was seamless but slow.
 *
 * When a link in that chain is missing — no MediaSource, a container the engine
 * refuses, a buffer that dies mid-reply — the reply is still played, as one
 * whole file assembled from the bytes in hand. That path cannot start before the
 * reply is complete, but it always produces sound.
 */
import { splitRequests, splitSentences } from "./sentences.js";
/** Route the host exposes for synthesis. */
const SPEAK_ROUTE = '/speech/speak';
/** Container the host answers with, and the one MediaSource must accept. */
const AUDIO_MIME = 'audio/mpeg';
/**
 * Seconds of audio to buffer before playback starts. Below this, a reply that
 * arrives slower than it is spoken would run dry mid-sentence; above it, the
 * wait starts to feel like the browser is thinking.
 */
const PREBUFFER_SECONDS = 4;
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
 * Whether a caught value is the interruption a pause causes. Pausing an element
 * whose `play()` has not settled yet rejects that promise, and the platform
 * labels the rejection an abort; it reports a stop, not a fault.
 * @param error - the caught value.
 * @returns true when the platform called it an abort.
 */
function isAbort(error) {
    return typeof error === 'object' && error !== null && error.name === 'AbortError';
}
/**
 * Whether this browser can play encoded audio through MediaSource.
 * @returns true when the container the host sends is one MediaSource accepts.
 */
function canStream() {
    return typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(AUDIO_MIME);
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
                const buffer = media.addSourceBuffer(AUDIO_MIME);
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
 * How much audio the buffer holds, in seconds.
 * @param buffer - the source buffer.
 * @returns the end of the last buffered range, or zero when nothing is buffered.
 */
function bufferedSeconds(buffer) {
    const ranges = buffer.buffered;
    if (ranges === undefined || ranges.length === 0)
        return 0;
    return ranges.end(ranges.length - 1);
}
/** Owns the audio currently playing and the requests behind it. */
export class SpeechAudio {
    /** Cancellation token: every stop or new request invalidates what is running. */
    generation = 0;
    playing;
    objectUrl;
    /** Aborts the response body a stop would otherwise keep reading forever. */
    abort;
    /**
     * Speak one text. The whole reply travels in one request; playback starts on
     * the buffered head of it. A reply too large for one request is spoken
     * sentence by sentence.
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
        const abort = new AbortController();
        this.abort = abort;
        const played = requests.length === 1
            ? await this.playReply(requests[0], overrides, generation, abort.signal)
            : await this.playSentenceBySentence(splitSentences(text), overrides, generation, abort.signal);
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
     * Fetch one reply and play it, streaming it when the browser can.
     * @param text - the whole projected text.
     * @param overrides - preview overrides, when any.
     * @param generation - token this request belongs to.
     * @returns whether playback ran to the end under the same generation.
     */
    async playReply(text, overrides, generation, signal) {
        let response;
        try {
            response = await fetch(SPEAK_ROUTE, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ text, ...overrides }),
                signal,
            });
        }
        catch (error) {
            // A stop aborts the request; that is the cancellation it asked for.
            if (generation !== this.generation)
                return false;
            throw error;
        }
        if (!response.ok) {
            const message = await failureOf(response);
            const limit = limitOf(message);
            if (limit === undefined)
                throw new Error(message);
            // The host enforces a smaller request than this build sends — an older
            // server, or a tighter deployment bound. Speak in pieces it accepts
            // instead of failing the whole reply.
            return await this.playSentenceBySentence(splitSentences(text, limit), overrides, generation, signal);
        }
        if (!canStream()) {
            const audio = await response.blob();
            if (generation !== this.generation)
                return false;
            return await this.playBlob(audio, generation);
        }
        const body = response.body;
        if (body === null)
            throw new Error('speech stream carried no body');
        return await this.streamReply(body, generation);
    }
    /**
     * Append one reply's frames and start playing once enough of it is buffered.
     * @param body - the response body carrying encoded audio.
     * @param generation - token this request belongs to.
     * @returns whether playback ran to the end under the same generation.
     */
    async streamReply(body, generation) {
        const media = new MediaSource();
        const url = URL.createObjectURL(media);
        const element = new Audio(url);
        this.playing = element;
        this.objectUrl = url;
        const reader = body.getReader();
        // Everything read before playback starts, so a buffer that refuses the
        // frames still leaves a complete file to fall back on.
        const held = [];
        let started = false;
        let attemptedPlayback = false;
        try {
            const buffer = await openBuffer(media);
            for (;;) {
                const { done, value } = await reader.read();
                if (generation !== this.generation) {
                    await reader.cancel();
                    this.releaseChunk(url);
                    return false;
                }
                if (value !== undefined && value.length > 0) {
                    if (!started)
                        held.push(value);
                    await appendChunk(buffer, value);
                    if (!started && bufferedSeconds(buffer) >= PREBUFFER_SECONDS) {
                        // The head of the reply is in hand: from here the element plays
                        // while the rest is still being synthesized.
                        attemptedPlayback = true;
                        if (!await this.startPlayback(element, generation)) {
                            this.releaseChunk(url);
                            return false;
                        }
                        started = true;
                        held.length = 0;
                    }
                }
                if (done)
                    break;
            }
        }
        catch (error) {
            this.releaseChunk(url);
            // A stop aborts the read, which arrives here as a failed body.
            if (generation !== this.generation)
                return false;
            // A playback refusal is the caller's to report; a buffer that refuses the
            // frames is not, and the audio in hand can still be played as one file.
            if (attemptedPlayback)
                throw error;
            return await this.playCollected(reader, held, generation, error);
        }
        if (started) {
            await this.playedOut(element, generation);
            this.releaseChunk(url);
            return generation === this.generation;
        }
        // The reply ended before the buffer reached the threshold, or this engine
        // never buffered anything: play the whole of it as one file.
        this.releaseChunk(url);
        return await this.playCollected(reader, held, generation, undefined);
    }
    /**
     * Drain what is left of a reply and play everything received as one file.
     * @param reader - the response reader, possibly partly consumed.
     * @param held - chunks already in hand.
     * @param generation - token this request belongs to.
     * @param cause - the failure that sent the reply down this path, when there was one.
     * @returns whether playback ran to the end under the same generation.
     */
    async playCollected(reader, held, generation, cause) {
        const chunks = [...held];
        try {
            for (;;) {
                const { done, value } = await reader.read();
                if (value !== undefined && value.length > 0)
                    chunks.push(value);
                if (done)
                    break;
            }
        }
        catch (_bodyFailed) {
            // The body died too; the chunks in hand are what this reply will be.
        }
        if (chunks.length === 0) {
            if (cause !== undefined)
                throw cause;
            return false;
        }
        if (generation !== this.generation)
            return false;
        return await this.playBlob(new Blob(chunks, { type: AUDIO_MIME }), generation);
    }
    /**
     * Fallback path for a reply one request cannot carry: one request per
     * sentence, each played as a blob.
     * @param sentences - sentence-sized spans.
     * @param overrides - preview overrides, when any.
     * @param generation - token this run belongs to.
     * @returns whether every span played out under the same generation.
     */
    async playSentenceBySentence(sentences, overrides, generation, signal) {
        let pending;
        for (const [index, sentence] of sentences.entries()) {
            pending ??= this.fetchAudio(sentence, overrides, signal);
            const audio = await pending;
            pending = undefined;
            if (generation !== this.generation)
                return false;
            const next = sentences[index + 1];
            if (next !== undefined) {
                pending = this.fetchAudio(next, overrides, signal);
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
    async fetchAudio(text, overrides, signal) {
        const response = await fetch(SPEAK_ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text, ...overrides }),
            signal,
        });
        if (!response.ok)
            throw new Error(await failureOf(response));
        return await response.blob();
    }
    /**
     * Play one buffered file and wait for it to finish.
     * @param audio - encoded audio bytes.
     * @param generation - token this run belongs to.
     * @returns whether the file played out under the same generation.
     */
    async playBlob(audio, generation) {
        const url = URL.createObjectURL(audio);
        const element = new Audio(url);
        this.playing = element;
        this.objectUrl = url;
        if (!await this.startPlayback(element, generation)) {
            this.releaseChunk(url);
            return false;
        }
        await this.playedOut(element, generation);
        this.releaseChunk(url);
        return generation === this.generation;
    }
    /**
     * Start one element, reading a pause as the cancellation it is.
     * @param element - element to start.
     * @param generation - token the run belongs to.
     * @returns whether playback started; false means a stop got there first.
     */
    async startPlayback(element, generation) {
        try {
            await element.play();
            return true;
        }
        catch (error) {
            // A stop, or a newer request, pauses the element while play() is still
            // settling; the platform rejects that play() with an abort. Impatience on
            // the play button is not a service failure, and saying so painted a red
            // message over a reply the user had simply paused.
            if (generation !== this.generation || isAbort(error))
                return false;
            // Chromium's autoplay refusal is a different error, and that one is worth
            // reporting.
            throw error;
        }
    }
    /**
     * Resolve when one element stops producing sound, whether it ended, failed, or
     * was stopped by a newer request.
     * @param element - the audio element.
     * @param generation - token the run belongs to.
     */
    async playedOut(element, generation) {
        if (element.ended)
            return;
        // A stop that landed while playback was starting is already the answer; the
        // pause it caused has come and gone before this could listen for it.
        if (generation !== this.generation)
            return;
        await new Promise((resolve) => {
            const settle = () => { resolve(); };
            element.addEventListener('ended', settle, { once: true });
            element.addEventListener('error', settle, { once: true });
            // A stop pauses the element instead of ending it. Without this branch the
            // run would wait for an 'ended' that never comes, and every reader that
            // stopped playback would leave a promise hanging behind it.
            element.addEventListener('pause', () => {
                if (generation !== this.generation)
                    settle();
            }, { once: true });
        });
    }
    dropPlayback() {
        // Aborting first ends the body read: without it a stopped reply kept a
        // reader waiting on chunks that no longer mattered.
        this.abort?.abort();
        this.abort = undefined;
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