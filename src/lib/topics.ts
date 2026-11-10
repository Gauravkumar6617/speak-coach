export type Topic = { category: string; text: string };

const t = (category: string, texts: string[]) => texts.map((text) => ({ category, text }));

export const TOPICS: Topic[] = [
  ...t('Everyday', [
    'Describe your typical morning routine.',
    'Talk about a meal you love and how it is made.',
    'What do you usually do on weekends?',
    'Describe the neighbourhood where you live.',
    'Talk about a hobby you would like to start.',
    'How do you usually get around your city?',
    'Describe a shop or café you often visit.',
    'What does a perfect day off look like for you?',
  ]),
  ...t('Work and tech', [
    'Describe your current job or studies.',
    'How has technology changed the way you work?',
    'Talk about an app you use every day and why.',
    'What is the hardest part of working in a team?',
    'Should companies allow working from home full time?',
    'Describe a tool or skill that made you more productive.',
    'How do you deal with too many emails or messages?',
    'What job would you like to have in ten years?',
  ]),
  ...t('Opinions', [
    'Is social media good or bad for society?',
    'Should schools teach money management?',
    'Is it better to live in a city or the countryside?',
    'Should people be paid for doing housework?',
    'Are video games a waste of time?',
    'Is it important to learn more than one language?',
    'Should public transport be free?',
    'Do people travel too much these days?',
  ]),
  ...t('Stories', [
    'Tell me about a time you got lost.',
    'Describe a memorable trip you took.',
    'Talk about a mistake that taught you something.',
    'Tell me about the best gift you ever received.',
    'Describe a time you helped a stranger.',
    'Talk about a day that did not go as planned.',
    'Tell me about a teacher who influenced you.',
    'Describe a moment when you felt really proud.',
  ]),
  ...t('Interview', [
    'Tell me about yourself.',
    'What is your greatest strength and your biggest weakness?',
    'Describe a difficult problem you solved at work.',
    'Why do you want to work for our company?',
    'Tell me about a time you disagreed with your manager.',
    'Where do you see yourself in five years?',
    'Describe a project you are proud of.',
    'How do you handle pressure and tight deadlines?',
  ]),
];

export const randomTopic = (current?: Topic): Topic => {
  const pool = TOPICS.filter((x) => x !== current);
  return pool[Math.floor(Math.random() * pool.length)];
};
