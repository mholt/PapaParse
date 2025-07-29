import fs from "fs";
import path from "path";
import { ReadableStreamStreamer } from "./readable-stream-streamer";

// Test 1: Mimics the exact pattern from node-tests.js
async function testOnlyCompleteCallback() {
  console.log(
    "Test 1: Testing with ONLY complete callback (like node-tests.js)...\n"
  );

  const csvPath = path.join(__dirname, "../../tests/long-sample.csv");
  const stream = fs.createReadStream(csvPath, "utf8");

  const streamer = new ReadableStreamStreamer({
    complete: function (parsedCsv) {
      console.log("✓ Complete callback fired");
      console.log("  - Total rows parsed:", parsedCsv.data.length);
      console.log("  - Errors:", parsedCsv.errors.length);
      console.log("  - Meta info:", JSON.stringify(parsedCsv.meta));
      console.log("  - First row:", parsedCsv.data[0]);
      console.log("  - Last row:", parsedCsv.data[parsedCsv.data.length - 1]);
    },
  });

  // This mimics Papa.parse(stream, config)
  streamer.stream(stream);
}

// Test 2: Simple test to verify ReadableStreamStreamer works with Node.js streams
async function testReadableStreamStreamer() {
  console.log(
    "Test 2: Testing ReadableStreamStreamer with basic complete callback..."
  );

  const csvPath = path.join(__dirname, "../../tests/sample.csv");
  const stream = fs.createReadStream(csvPath, "utf8");

  const streamer = new ReadableStreamStreamer({
    complete: (results) => {
      console.log("Parsing complete!");
      console.log("Results:", results);
      if (results && results.data) {
        console.log("Row count:", results.data.length);
        console.log("First few rows:", results.data.slice(0, 3));
        console.log("Errors:", results.errors.length);
        console.log("Meta:", results.meta);
      } else {
        console.log("Results is undefined or has no data!");
      }
    },
    error: (error) => {
      console.error("Error during parsing:", error);
    },
  });

  // Start streaming
  streamer.stream(stream);
}

// Run all tests in sequence
async function runAllTests() {
  await testOnlyCompleteCallback();
  console.log("\n" + "=".repeat(60) + "\n");
  await testReadableStreamStreamer();
  console.log("\n" + "=".repeat(60) + "\n");
  await testStreamingWithChunks();
}

runAllTests().catch(console.error);

// Test with larger file to see chunking behavior
async function testStreamingWithChunks() {
  console.log("Test 3: Testing streaming behavior with chunk callbacks...");

  const csvPath = path.join(__dirname, "../../tests/long-sample.csv");

  // Check if file exists
  if (!fs.existsSync(csvPath)) {
    console.log("long-sample.csv not found, using verylong-sample.csv instead");
    const altPath = path.join(__dirname, "../../tests/verylong-sample.csv");
    if (fs.existsSync(altPath)) {
      testWithFile(altPath);
    } else {
      console.log("No large sample file found, skipping chunk test");
    }
  } else {
    testWithFile(csvPath);
  }

  function testWithFile(filePath: string) {
    const stream = fs.createReadStream(filePath, {
      encoding: "utf8",
      highWaterMark: 1024,
    }); // Small buffer to force chunking

    let chunkCount = 0;
    let rowCount = 0;

    const streamer = new ReadableStreamStreamer({
      chunk: (results, handle) => {
        chunkCount++;
        rowCount += results.data.length;
        console.log(
          `Chunk ${chunkCount}: ${results.data.length} rows (total: ${rowCount})`
        );

        // Demonstrate pause/resume
        if (chunkCount === 2) {
          console.log("Pausing after chunk 2...");
          handle.pause();
          setTimeout(() => {
            console.log("Resuming...");
            handle.resume();
          }, 100);
        }
      },
      complete: (results) => {
        console.log("\nStreaming complete!");
        console.log(`Total chunks processed: ${chunkCount}`);
        console.log(`Total rows via chunks: ${rowCount}`);
        console.log(`Complete results rows: ${results?.data?.length || 0}`);
      },
      error: (error) => {
        console.error("Error:", error);
      },
    });

    streamer.stream(stream);
  }
}
