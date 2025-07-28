/**
 * Streaming Infrastructure - Entry point for all streamer classes.
 *
 * Exports all streamer implementations for different input types:
 * - ChunkStreamer: Base class for coordination
 * - StringStreamer: Memory-efficient string processing
 * - FileStreamer: Browser File objects with FileReader
 * - NetworkStreamer: Remote file downloading via HTTP
 * - ReadableStreamStreamer: Node.js readable streams
 * - DuplexStreamStreamer: Node.js duplex streams for piping
 */

export { ChunkStreamer, type ChunkStreamerConfig } from "./chunk-streamer";
export { StringStreamer } from "./string-streamer";
export { FileStreamer, type FileStreamerConfig } from "./file-streamer";
export {
  NetworkStreamer,
  type NetworkStreamerConfig,
} from "./network-streamer";
export {
  ReadableStreamStreamer,
  type ReadableStreamStreamerConfig,
  type NodeReadableStream,
} from "./readable-stream-streamer";
export {
  DuplexStreamStreamer,
  type DuplexStreamStreamerConfig,
  type NodeDuplex,
} from "./duplex-stream-streamer";
