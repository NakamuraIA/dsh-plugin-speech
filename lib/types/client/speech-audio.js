/**
 * Browser playback over the host's synthesis route.
 *
 * One click sends the whole reply in **one request** and the host streams the
 * audio back while the service is still working. The browser appends every chunk
 * to a single MediaSource buffer and starts the element as soon as a short head
 * of audio is in hand — under a second in practice, because the service
 * synthesizes far faster than a voice speaks (measured at 73x realtime on a warm
 * connection, 1.5x on a cold one). From there the element plays out of the
 * buffer while the rest arrives behind it, so the voice is continuous and the
 * wait is a fraction of a second.
 *
 * That head is deliberately small: it exists to cover the first chunk's jitter,
 * not to wait for a meaningful part of the reply. Raising it buys nothing when
 * the service is fast and costs exactly what it waits.
 *
 * When MediaSource is unusable — or the engine accepts the type and then refuses
 * the buffer — the reply is still played as one whole file in one element.
 */
/** Route the host exposes for synthesis. */
const SPEAK_ROUTE = '/speech/speak';
/** Container the host answers with, and the one MediaSource must accept. */
const AUDIO_MIME = 'audio/mpeg';
/**
 * Seconds of audio to hold before starting. Enough to cover the gap between the
 * first chunk and the next, small enough to be inaudible as a delay: the service
 * normally delivers a whole reply in about a second, so this is the only wait.
 */
const PREBUFFER_SECONDS = 1.5;
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
     * Speak one text: one request for the whole reply, played as it arrives.
     * @param text - projected spoken text.
     * @param overrides - preview overrides, or undefined to use the durable settings.
     * @param onEnded - called once the last audio has played out.
     */
    async speak(text, overrides, onEnded) {
        if (text.trim() === '')
            return;
        const generation = ++this.generation;
        this.dropPlayback();
        const abort = new AbortController();
        this.abort = abort;
        const played = await this.playReply(text, overrides, generation, abort.signal);
        // A run superseded by a later stop or speak answers false, so a true answer
        // is the only thing that reports an end.
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
     * @param signal - aborts the reply in flight.
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
        if (!response.ok)
            throw new Error(await failureOf(response));
        const body = response.body;
        if (body === null || !canStream()) {
            const audio = await response.blob();
            if (generation !== this.generation)
                return false;
            return await this.playBlob(audio, generation);
        }
        return await this.streamReply(body, generation);
    }
    /**
     * Append one reply's frames and start the element as soon as the head is in.
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
        let started = false;
        const play = async () => {
            if (started)
                return true;
            if (!await this.startPlayback(element, generation)) {
                this.releaseChunk(url);
                return false;
            }
            started = true;
            return true;
        };
        const reader = body.getReader();
        // Everything read before playback starts, so a buffer that refuses the frames
        // still leaves a complete file to play.
        const held = [];
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
                    // The head is judged per chunk: the body stays open while the service
                    // keeps sending, and waiting for it to end would delay speech by the
                    // length of the whole reply.
                    if (!started && bufferedSeconds(buffer) >= PREBUFFER_SECONDS) {
                        if (!await play())
                            return false;
                        held.length = 0;
                    }
                }
                if (done)
                    break;
            }
            if (!await play())
                return false;
            if (media.readyState === 'open')
                media.endOfStream();
            await this.playedOut(element, generation);
            this.releaseChunk(url);
            return generation === this.generation;
        }
        catch (error) {
            this.releaseChunk(url);
            if (generation !== this.generation)
                return false;
            // A body that dies after the head went in still leaves buffered audio; the
            // element plays what it has and ends, which beats throwing it away.
            if (started) {
                if (media.readyState === 'open')
                    media.endOfStream();
                await this.playedOut(element, generation);
                return generation === this.generation;
            }
            // Nothing played: the engine refused the buffer itself. Play the reply as
            // one whole file from the bytes in hand plus the rest of the body.
            void error;
            return await this.playCollected(reader, held, generation);
        }
    }
    /**
     * Drain what is left of a reply and play everything as one file.
     * @param reader - the response reader, partly consumed.
     * @param held - the chunks already in hand.
     * @param generation - token this request belongs to.
     * @returns whether playback ran to the end under the same generation.
     */
    async playCollected(reader, held, generation) {
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
        if (generation !== this.generation)
            return false;
        if (chunks.length === 0)
            return false;
        return await this.playBlob(new Blob(chunks, { type: AUDIO_MIME }), generation);
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