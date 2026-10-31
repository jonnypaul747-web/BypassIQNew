const QUESTION_PREFIXES = [
    'what', 'why', 'how', 'when', 'where', 'who', 'which', 'whose', 'whom',
    'can you', 'could you', 'would you', 'will you', 'should we', 'should i',
    'do you', 'did you', 'are you', 'is there', 'are there', 'have you', 'has it',
    'tell me about', 'explain', 'describe', 'walk me through', 'solve',
    'how would you', 'how do you', 'how can we', 'what is the', 'what are the',
    'what does', 'why does', 'can we', 'is it possible', 'does this'
];
const TECHNICAL_INSTRUCTION_PREFIXES = [
    'write a', 'implement', 'debug', 'refactor', 'optimize', 'explain the error',
    'what is the complexity', 'what is the big o', 'how would you design',
    'find the bug', 'fix this', 'create a function'
];
const FILLER_PHRASES = [
    'yeah', 'yes', 'okay', 'cool', 'alright', 'right', 'got it', 'sure',
    'i mean', 'you know', 'let me see', 'uh', 'um', 'hm'
];
export class QuestionDetector {
    /**
     * Analyzes a candidate text and determines whether it represents a real question or prompt
     */
    static analyze(rawText) {
        const text = rawText.trim();
        if (!text || text.length < 5) {
            return { isQuestion: false, questionText: text, confidence: 0, type: 'statement' };
        }
        const lower = text.toLowerCase().replace(/^[,\s.!]+/, '');
        // Check if it's purely a filler response
        if (FILLER_PHRASES.some((filler) => lower === filler || lower.startsWith(filler + ' ') && lower.length < 15)) {
            return { isQuestion: false, questionText: text, confidence: 0, type: 'statement' };
        }
        // 1. Explicit question mark
        if (text.endsWith('?')) {
            return {
                isQuestion: true,
                questionText: text,
                confidence: 0.95,
                type: 'direct_question',
            };
        }
        // 2. Interrogative prefix match
        for (const prefix of QUESTION_PREFIXES) {
            if (lower.startsWith(prefix + ' ') || lower.startsWith(prefix + "'")) {
                return {
                    isQuestion: true,
                    questionText: text,
                    confidence: 0.88,
                    type: 'direct_question',
                };
            }
        }
        // 3. Technical instruction match
        for (const prefix of TECHNICAL_INSTRUCTION_PREFIXES) {
            if (lower.startsWith(prefix + ' ')) {
                return {
                    isQuestion: true,
                    questionText: text,
                    confidence: 0.9,
                    type: 'technical_prompt',
                };
            }
        }
        // Default statement
        return {
            isQuestion: false,
            questionText: text,
            confidence: 0.1,
            type: 'statement',
        };
    }
    /**
     * Scans a series of recent transcript segments and extracts the latest active question
     */
    static extractLatestQuestion(segments) {
        if (!segments || segments.length === 0)
            return null;
        // Scan backwards from the newest finalized segments
        for (let i = segments.length - 1; i >= 0; i--) {
            const seg = segments[i];
            if (!seg.text.trim())
                continue;
            const analysis = this.analyze(seg.text);
            if (analysis.isQuestion && analysis.confidence >= 0.7) {
                return analysis.questionText;
            }
            // Check if combining last 2 segments forms a complete question
            if (i > 0) {
                const combined = `${segments[i - 1].text.trim()} ${seg.text.trim()}`;
                const combinedAnalysis = this.analyze(combined);
                if (combinedAnalysis.isQuestion && combinedAnalysis.confidence >= 0.8) {
                    return combinedAnalysis.questionText;
                }
            }
        }
        return null;
    }
}
