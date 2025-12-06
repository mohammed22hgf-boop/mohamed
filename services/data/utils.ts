
import { Question, QuestionType } from '../../types';

export const q = (id: string, s: string, t: 'mcq' | 'true_false', x: string, c: string, o: string[] = [], e: string = ''): Question => ({
    id, subjectId: s, type: t as QuestionType, text: x, correctAnswer: c, options: t === 'mcq' ? o : undefined, explanation: e
});
