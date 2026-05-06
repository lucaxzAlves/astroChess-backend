import { extractTournamentDates } from './date-parser';

const examples = [
  '10/04/2026',
  '10 a 12/04/2026',
  '10 de abril de 2026',
  '10 a 12 de abril de 2026',
  'Festival de Xadrez São Paulo 10 a 12 de maio de 2026',
  'OPEN RAPIDO 21-04-2026',
  'Apr 10, 2026',
  '10-12 Apr 2026',
  '10/04',
  '10 de abril',
];

export const runDateParserExamples = (): void => {
  for (const example of examples) {
    console.log(example, extractTournamentDates({ title: example }));
  }
};

if (require.main === module) {
  runDateParserExamples();
}
