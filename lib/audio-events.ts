export type AudioEvent = Record<string, unknown>;

/** Read progress as a stream and require an explicit successful terminal event. */
export async function readAudioEvents(response: Response, onEvent?: (event: AudioEvent) => void | Promise<void>): Promise<AudioEvent> {
  if (!response.body) throw new Error("The audio service returned an empty response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let ready: AudioEvent | null = null;
  const consume = async (line: string) => {
    if (!line.trim()) return;
    let event: AudioEvent;
    try { event = JSON.parse(line); }
    catch { throw new Error("The audio service returned an invalid progress response. Please retry."); }
    if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("Invalid audio service response.");
    if (event.status === "error") throw new Error(typeof event.error === "string" ? event.error : "Audio processing failed.");
    if (event.status === "cancelled") throw new Error("Operation cancelled.");
    if (event.status === "ready") ready = event;
    await onEvent?.(event);
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      if (buffer.length > 1_048_576) throw new Error("Invalid audio progress response.");
      for (const line of lines) await consume(line);
      if (done) break;
    }
    if (buffer.trim()) await consume(buffer);
    if (!ready) throw new Error("The audio connection ended before processing finished. Please retry.");
    return ready;
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally { reader.releaseLock(); }
}
