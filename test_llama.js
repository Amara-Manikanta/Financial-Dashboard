import { getLlama } from "node-llama-cpp";
async function test() {
  console.log("Loading llama...");
  try {
    const llama = await getLlama();
    console.log("Loading model...");
    const model = await llama.loadModel({ modelPath: "/Users/manikantaamara/Programming/Models/mistral-7b-instruct.gguf" });
    console.log("Model loaded successfully.");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
test();
