/**
 * Guided-selling quiz (FR-QUIZ-01) — "Find your supplement". A fixed set of
 * questions whose answers map to wellness-goal category slugs; the service then
 * recommends published products in those categories. Pure + unit-tested.
 */
export type GuidedOption = { label: string; goals: string[] };
export type GuidedQuestion = { id: string; q: string; options: GuidedOption[] };

export const GUIDED_QUIZ: GuidedQuestion[] = [
  {
    id: 'goal',
    q: 'What is your main wellness goal?',
    options: [
      { label: 'More energy & focus', goals: ['energy'] },
      { label: 'Stronger immunity', goals: ['immunity'] },
      { label: 'Better sleep & calm', goals: ['sleep'] },
      { label: 'Skin, hair & beauty', goals: ['beauty'] },
    ],
  },
  {
    id: 'concern',
    q: 'Which area would you most like to support?',
    options: [
      { label: 'Joints & bones', goals: ['joints'] },
      { label: 'Heart & circulation', goals: ['heart'] },
      { label: 'Digestion & gut', goals: ['digestion'] },
      { label: 'General wellness', goals: ['immunity', 'energy'] },
    ],
  },
  {
    id: 'pref',
    q: 'Any product preference?',
    options: [
      { label: 'Premium / clinical-grade', goals: ['premium'] },
      { label: 'Natural & plant-based', goals: ['natural'] },
      { label: 'Best value', goals: [] },
      { label: 'No preference', goals: [] },
    ],
  },
];

/** Map selected option labels (keyed by question id) to deduped goal slugs. */
export function recommendFromAnswers(answers: Record<string, string>): string[] {
  const goals = new Set<string>();
  for (const question of GUIDED_QUIZ) {
    const opt = question.options.find((o) => o.label === answers[question.id]);
    opt?.goals.forEach((g) => goals.add(g));
  }
  return [...goals];
}
