export default class BrailleTFJS {
    constructor(onStatusChange) {
        this.onStatusChange = onStatusChange;
        this.model = null;
        this.inputSize = 320;
        this.isProcessing = false;
        this.labels = [
            'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
            'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'
        ];
        this.initStatus = {
            loaded: false,
            error: null
        };
    }

    async init() {
        this.onStatusChange("Loading Braille Engine...");

        try {
            // Load the YOLOv8 converted graph model
            // Make sure tf module is available from CDN
            if (typeof tf === 'undefined') {
                throw new Error("TensorFlow.js not found. Make sure network is connected.");
            }

            const modelURL = 'Bestmodel/model.json';
            this.model = await tf.loadGraphModel(modelURL);

            // Warm up the model
            const dummyInput = tf.zeros([1, this.inputSize, this.inputSize, 3]);
            this.model.execute(dummyInput);
            dummyInput.dispose();

            this.initStatus.loaded = true;
            this.onStatusChange("Ready");
            return true;
        } catch (err) {
            console.error("Braille Model Load Error: ", err);
            this.initStatus.error = err.message || err;
            this.onStatusChange(`Error: ${this.initStatus.error}`);
            return false;
        }
    }

    async processFrame(videoElement) {
        if (!this.initStatus.loaded || this.isProcessing) {
            return null;
        }

        this.isProcessing = true;

        let tensor = null;
        let prediction = null;

        try {
            // Preprocess Image (from video)
            // 1. Convert to tensor from pixels
            tensor = tf.browser.fromPixels(videoElement);

            // Wait, we need the original dimensions to calculate scaling factors
            const h = tensor.shape[0];
            const w = tensor.shape[1];

            // 2. Resize to 320x320
            const resized = tf.image.resizeBilinear(tensor, [this.inputSize, this.inputSize]);

            // 3. Normalize to [0...1]
            const normalized = resized.div(255.0);

            // 4. Add batch dimension
            const batched = normalized.expandDims(0);

            // Cleanup intermediate tensors
            resized.dispose();
            normalized.dispose();

            // Run inference
            prediction = await this.model.executeAsync(batched);
            batched.dispose();

            // YOLOv8 output is [1, num_classes + 4, anchors] e.g., [1, 30, 2100]
            const squeezed = prediction.squeeze();
            const reshaped = squeezed.transpose(); // size: [2100, 30]

            // Process the output data
            const results = await this.parseYOLOOutput(reshaped, w, h);

            squeezed.dispose();
            reshaped.dispose();

            if (results && results.length > 0) {
                const text = this.assembleSentence(results);
                return {
                    description: text,
                    is_priority: false, // Braille reading doesn't trigger alerts
                    raw_detections: results
                };
            }

            return null; // No detections

        } catch (err) {
            console.error("Braille Inference Error:", err);
            return null;
        } finally {
            this.isProcessing = false;
            // Clean up memory
            if (tensor) tensor.dispose();
            if (prediction) {
                if (Array.isArray(prediction)) prediction.forEach(p => p.dispose());
                else prediction.dispose();
            }
        }
    }

    async parseYOLOOutput(tensorVal, origWidth, origHeight) {
        const data = await tensorVal.array(); // JS array of [2100][30]
        const numClasses = this.labels.length; // 26

        const boxes = [];
        const scores = [];
        const classIds = [];

        // YOLOv8 bbox parameters are xc, yc, w, h in the first 4 indices
        for (let r = 0; r < data.length; r++) {
            const row = data[r];

            let maxScore = 0;
            let classIdx = -1;

            // Find class with highest score
            for (let c = 0; c < numClasses; c++) {
                if (row[c + 4] > maxScore) {
                    maxScore = row[c + 4];
                    classIdx = c;
                }
            }

            if (maxScore > 0.3) {
                const xc = row[0];
                const yc = row[1];
                const w = row[2];
                const h = row[3];

                // Convert back to original image scale
                const xCenterOrig = (xc / this.inputSize) * origWidth;
                const yCenterOrig = (yc / this.inputSize) * origHeight;
                const wOrig = (w / this.inputSize) * origWidth;
                const hOrig = (h / this.inputSize) * origHeight;

                // [ymin, xmin, ymax, xmax] - Required by tf.image.nonMaxSuppressionAsync
                const xmin = xCenterOrig - wOrig / 2;
                const ymin = yCenterOrig - hOrig / 2;
                const xmax = xCenterOrig + wOrig / 2;
                const ymax = yCenterOrig + hOrig / 2;

                boxes.push([ymin, xmin, ymax, xmax]);
                scores.push(maxScore);
                classIds.push(classIdx);
            }
        }

        if (boxes.length === 0) return [];

        // Tensorify data for NMS
        const tBoxes = tf.tensor2d(boxes, [boxes.length, 4]);
        const tScores = tf.tensor1d(scores);

        // Non-max suppression to prevent overlapping bounding boxes
        const indices = await tf.image.nonMaxSuppressionAsync(
            tBoxes, tScores, 150, 0.45, 0.3
        );

        const validIndices = await indices.array();

        tBoxes.dispose();
        tScores.dispose();
        indices.dispose();

        const detections = [];
        for (let i = 0; i < validIndices.length; i++) {
            const idx = validIndices[i];
            const b = boxes[idx];
            detections.push({
                ymin: b[0],
                xmin: b[1],
                ymax: b[2],
                xmax: b[3],
                xc: (b[1] + b[3]) / 2,
                yc: (b[0] + b[2]) / 2,
                w: b[3] - b[1],
                h: b[2] - b[0],
                score: scores[idx],
                label: this.labels[classIds[idx]]
            });
        }

        return detections;
    }

    assembleSentence(detections) {
        if (!detections || detections.length === 0) return "";

        // Find averge character height to help threshold line groupings
        const avgHeight = detections.reduce((sum, d) => sum + d.h, 0) / detections.length;
        const avgWidth = detections.reduce((sum, d) => sum + d.w, 0) / detections.length;

        // 1. Sort temporally roughly from top to bottom
        detections.sort((a, b) => a.yc - b.yc);

        // 2. Group into distinct lines
        const lines = [];
        let currentLine = [];

        for (let i = 0; i < detections.length; i++) {
            const d = detections[i];
            // If it's the first element or it belongs to the same line as the previous ones
            if (currentLine.length === 0) {
                currentLine.push(d);
            } else {
                // Check Y distance to average of current line's Y center
                const lineYAvg = currentLine.reduce((sum, cl) => sum + cl.yc, 0) / currentLine.length;
                if (Math.abs(d.yc - lineYAvg) < avgHeight * 0.5) {
                    currentLine.push(d);
                } else {
                    lines.push([...currentLine]);
                    currentLine = [d];
                }
            }
        }
        // Push the last line
        if (currentLine.length > 0) lines.push(currentLine);

        // 3. For each line, sort left-to-right + Insert Spaces
        let fullText = "";

        for (let i = 0; i < lines.length; i++) {
            let lineStr = "";
            let line = lines[i];
            line.sort((a, b) => a.xmin - b.xmin);

            for (let j = 0; j < line.length; j++) {
                lineStr += line[j].label;

                // If not last element in line, intelligently insert spaces
                if (j < line.length - 1) {
                    const current = line[j];
                    const next = line[j + 1];
                    const distance = next.xmin - current.xmax;

                    // If distance is large relative to character width, insert space
                    if (distance > avgWidth * 0.7) {
                        lineStr += " ";
                    }
                }
            }
            fullText += lineStr + (i < lines.length - 1 ? "\n" : "");
        }

        return fullText.toLowerCase().trim(); // Braille standardizing
    }
}

// Make it available to app.js
