export class InterviewService {
    aiService;
    documentService;
    constructor(aiService, documentService) {
        this.aiService = aiService;
        this.documentService = documentService;
    }
    /**
     * Generates 15 professional interview questions with answers based on uploaded PDF/document
     */
    async generateInterviewQuestions(filePath, questionCount = 15) {
        try {
            // Step 1: Extract text from PDF/document
            const document = await this.documentService.importDocument(filePath);
            if (!document.extractedText || document.extractedText.length < 100) {
                throw new Error('Document does not contain enough text to generate questions. Please upload a document with more content.');
            }
            // Step 2: Build prompt for interview question generation
            const systemPrompt = "Read document. Output max 3-5 core bullet-point suggestions/Q&As. No intro, no summary, no markdown formatting fluff.";
            const userPrompt = `Based on the following document (resume/CV/job description), generate ${questionCount} professional interview questions with answers:

DOCUMENT CONTENT:
${document.extractedText.slice(0, 8000)}

Please analyze the skills, experience, and qualifications mentioned in the document and create relevant interview questions that would be asked for this role/candidate profile. Return the result as a valid JSON array.`;
            // Step 3: Generate questions using AI
            const options = {
                question: userPrompt,
                style: 'detailed',
                transcriptHistory: [],
                screenOcrContext: '',
                activeDocuments: [],
                signal: undefined,
            };
            const result = await this.aiService.generateAnswer(options);
            // Step 4: Parse AI response
            const questions = this.parseQuestionsResponse(result.answer);
            if (questions.length === 0) {
                throw new Error('Failed to parse generated questions. Please try again.');
            }
            // Step 5: Return result with AI provider info
            return {
                questions: questions.slice(0, questionCount),
                aiProvider: this.aiService['settings']?.provider || 'unknown',
                aiModel: this.aiService['settings']?.modelName || 'unknown',
                documentName: document.name,
                generatedAt: Date.now(),
            };
        }
        catch (error) {
            console.error('[InterviewService] Error generating questions:', error);
            throw error;
        }
    }
    /**
     * Parse AI response to extract questions in JSON format
     */
    parseQuestionsResponse(response) {
        try {
            // Try to extract JSON from the response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No JSON array found in response');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            // Validate and format the questions
            return parsed.map((item) => ({
                question: item.question || '',
                answer: item.answer || '',
                category: item.category || 'General',
                difficulty: ['Easy', 'Medium', 'Hard'].includes(item.difficulty) ? item.difficulty : 'Medium',
            })).filter((q) => q.question && q.answer);
        }
        catch (error) {
            console.error('[InterviewService] Error parsing questions:', error);
            throw new Error('Failed to parse AI response. The AI did not return valid JSON format.');
        }
    }
    /**
     * Get current AI provider information
     */
    getAiProviderInfo() {
        return {
            provider: this.aiService['settings']?.provider || 'unknown',
            model: this.aiService['settings']?.modelName || 'unknown',
        };
    }
}
