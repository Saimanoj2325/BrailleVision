import { AutoProcessor, AutoModelForImageTextToText, RawImage, pipeline, env, TextStreamer } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.10';

// Configure transformers.js to use WebGPU if available
env.allowLocalModels = false;
env.backends.onnx.wasm.proxy = true;

const MODEL_ID = "onnx-community/LFM2-VL-450M-ONNX";
const MODEL_FILE_COUNT = 3;
const MAX_NEW_TOKENS = 128; // Mobile GPUs take too long (5-10 seconds) if this is set to 1024

function normalizeText(text) {
    return text.replace(/\s+/g, " ").trim();
}

export default class BrainModule {
    constructor(onStatusChange) {
        this.onStatusChange = onStatusChange;
        this.processor = null;
        this.visionModel = null;
        this.translationPipeline = null;

        this.initStatus = {
            vision: false,
            translator: false,
            error: null
        };
        this.generationInFlight = false;
    }

    async init() {
        this.onStatusChange("Downloading Vision AI... (may take a minute)");

        if (!("gpu" in navigator)) {
            const message = "WebGPU is not available in this browser.";
            this.initStatus.error = message;
            this.onStatusChange(`Error: ${message}`);
            return false;
        }

        try {
            // Load state-of-the-art vision model via WebGPU
            this.processor = await AutoProcessor.from_pretrained(MODEL_ID);

            const progressMap = new Map();
            const progressCallback = (info) => {
                if (info.status === 'download') {
                    this.onStatusChange(`Vision: Starting download for ${info.file}`);
                } else if (info.status === 'progress' && info.file.endsWith('.onnx_data') && info.total > 0) {
                    progressMap.set(info.file, info.loaded / info.total);
                    const totalProgress = (Array.from(progressMap.values()).reduce((sum, value) => sum + value, 0) / MODEL_FILE_COUNT) * 100;
                    this.onStatusChange(`Vision: Downloading... ${Math.round(totalProgress)}%`);
                } else if (info.status === 'done') {
                    this.onStatusChange(`Vision: Finished download for ${info.file}`);
                } else if (info.status === 'ready') {
                    this.onStatusChange(`Vision AI Ready. Compiling shaders...`);
                }
            };

            this.visionModel = await AutoModelForImageTextToText.from_pretrained(
                MODEL_ID,
                {
                    device: "webgpu",
                    dtype: {
                        vision_encoder: "fp16",
                        embed_tokens: "fp16",
                        decoder_model_merged: "q4f16",
                    },
                    progress_callback: progressCallback,
                }
            );

            this.initStatus.vision = true;

            this.onStatusChange("Downloading Translation AI... (1.2GB)");
            // Load translation model (NLLB supports 200 languages)
            // Forced to 'wasm' because sequence-to-sequence decoder models are highly unstable in raw WebGPU
            this.translationPipeline = await pipeline('translation', 'Xenova/nllb-200-distilled-600M', {
                device: 'wasm',
                progress_callback: (data) => {
                    if (data.status === 'download') this.onStatusChange(`Translator: Starting download for ${data.file}`);
                    else if (data.status === 'progress') this.onStatusChange(`Translator: Downloading ${data.file}... ${Math.round(data.progress)}%`);
                    else if (data.status === 'done') this.onStatusChange(`Translator: Finished download for ${data.file}`);
                    else if (data.status === 'ready') this.onStatusChange(`Translator AI Ready. Loading to memory...`);
                }
            });
            this.initStatus.translator = true;

            this.onStatusChange("Ready");
            return true;
        } catch (e) {
            console.error("Failed to load AI models:", e);
            this.initStatus.error = e.message;
            this.onStatusChange(`Error: ${e.message}`);
            return false;
        }
    }

    async processFrame(imageDataBase64, targetLangCode, userQuery = "") {
        if (!this.initStatus.vision || !this.initStatus.translator) {
            return null;
        }

        if (this.generationInFlight) {
            return null;
        }

        this.generationInFlight = true;

        try {
            // 1. Vision: Generate English caption from the image
            const rawFrame = await RawImage.fromURL(imageDataBase64);
            
            let prompt = "You are a helpful AI assistant acting as the eyes for a blind person via their camera. Describe exactly what the blind person is showing you right now. Crucially, check if they are pointing correctly at any Braille. If you see Braille, tell them 'Braille is detected' and guide their aim (e.g. move closer, left, right). If no Braille is visible, definitively state 'I cannot see any Braille.' and briefly describe what objects are in front of them to help them orient.";
            
            if (userQuery && userQuery.length > 0) {
                prompt = `You are a helpful AI assistant acting as the eyes for a blind person via camera. Based on the image, answer this: "${userQuery}". Look carefully for Braille. If you see Braille, state 'Braille is detected'. If there is no Braille, say 'I cannot see any Braille' and describe what you do see. Keep your description clear and concise.`;
            }

            const messages = [
                {
                    role: "user",
                    content: [
                        { type: "image" },
                        { text: normalizeText(prompt), type: "text" },
                    ]
                },
            ];

            const chatPrompt = this.processor.apply_chat_template(messages, {
                add_generation_prompt: true,
            });

            const inputs = await this.processor(rawFrame, chatPrompt, {
                add_special_tokens: false,
            });

            let streamedText = "";
            const streamer = new TextStreamer(this.processor.tokenizer, {
                callback_function: (text) => {
                    streamedText += text;
                },
                skip_prompt: true,
                skip_special_tokens: true,
            });

            // To provide nice feedback we could use a streamer as well, 
            // but for simplicity with the translatation pipeline we await the full result.
            const outputs = await this.visionModel.generate({
                ...inputs,
                do_sample: false,
                max_new_tokens: 128,
                repetition_penalty: 1.08,
                streamer,
            });

            // Use the confidently streamed text!
            let englishCaption = normalizeText(streamedText);

            // Fallback in case streamer didn't catch it
            if (!englishCaption) {
                const inputLength = inputs.input_ids.dims.at(-1) ?? 0;
                // outputs is a tensor
                const generated = outputs.slice(null, [inputLength, null]);
                const [decoded] = this.processor.batch_decode(generated, {
                    skip_special_tokens: true,
                });
                englishCaption = normalizeText(decoded);
            }
            
            // if it is STILL empty, it might be due to the prompt.
            if (!englishCaption || englishCaption.trim() === "") {
                 console.log("Vision model returned empty text. Fallback triggered.");
                 // return null to trigger error flow
                 return null;
            }

            let finalOutput = englishCaption;
            let isPriority = false;

            // Expanded hazard vocabulary for visually impaired navigation
            const urgentWords = ['car', 'vehicle', 'truck', 'bus', 'bike', 'bicycle', 'street', 'traffic', 'stairs', 'step', 'hole', 'wall', 'approaching', 'running', 'danger', 'obstacle', 'pole', 'door', 'intersection', 'curb'];
            if (urgentWords.some(w => englishCaption.toLowerCase().includes(w))) {
                isPriority = true;
            }

            // 2. Translation
            if (targetLangCode !== 'eng_Latn') {
                const transResult = await this.translationPipeline(englishCaption, {
                    src_lang: 'eng_Latn',
                    tgt_lang: targetLangCode
                });
                finalOutput = transResult[0].translation_text;
            }

            return {
                description: finalOutput,
                is_priority: isPriority,
                raw_english: englishCaption // Useful for logging
            };

        } catch (e) {
            console.error("Inference Error:", e);
            return null;
        } finally {
            this.generationInFlight = false;
        }
    }
}

