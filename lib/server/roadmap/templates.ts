import type { Difficulty } from '../../types';
import type { StageDraft } from './skeleton';

// Fallback roadmap when AI is off, slow or returns junk. {interest} = interest name, lowercase.
// Order matches STAGE_SKELETON: connect / coop positions must stay where they are.
const T: Record<Difficulty, StageDraft[]> = {
  1: [
    { title: 'Set your first {interest} mini-goal', minutes: 5,
      description: 'Pick one tiny goal you can finish this week. Small beats ambitious.',
      steps: ['Choose a goal you can finish in under 30 minutes', 'Pick the day and time', 'Write it down where you will see it'] },
    { title: 'Find a {interest} buddy on the map', minutes: 5,
      description: 'Open the map, find someone near you who also wants to start {interest}, and say hi.',
      steps: ['Tap your state on the map', 'Check the shared interests on the cards', 'Send one connect request'] },
    { title: 'Your first {interest} session together', minutes: 20,
      description: 'Meet your buddy in a public place, do a short session together and take a photo.',
      steps: ['Agree on a public place and time', 'Do a 15-minute session together', 'Take one photo together and upload it'] },
  ],
  3: [
    { title: 'Learn the {interest} basics', minutes: 15,
      description: 'Spend 15 minutes on one beginner guide or video and note 3 things to try.',
      steps: ['Find one beginner guide or video', 'Write down 3 things to try', 'Pick the easiest one for next time'] },
    { title: 'Do a 15-minute {interest} practice', minutes: 15,
      description: 'Try the first thing from your list. Done is better than perfect.',
      steps: ['Set a 15-minute timer', 'Practice one thing only', 'Note what felt hard'] },
    { title: 'Show your progress', minutes: 15,
      description: 'Practice again and capture your setup or result. A photo earns bonus coins.',
      steps: ['Repeat yesterday\'s practice', 'Add one small challenge', 'Snap a photo of the result'] },
    { title: 'Find a {interest} partner on the map', minutes: 5,
      description: 'Practice is easier with someone. Find a partner nearby at your level.',
      steps: ['Open the map', 'Look for someone at a similar level', 'Send a connect request'] },
    { title: 'Push a little further', minutes: 20,
      description: 'Do a session 5 minutes longer than last time.',
      steps: ['Warm up for 3 minutes', 'Go 5 minutes longer than last time', 'Write down one win'] },
    { title: 'Level-up session with your partner', minutes: 30,
      description: 'Meet in a public place, practice together and share a photo of the moment.',
      steps: ['Pick a public spot that works for both', 'Practice together for 30 minutes', 'Take a photo together and upload it'] },
  ],
  5: [
    { title: 'Define your {interest} goal for the month', minutes: 10,
      description: 'Make it specific and measurable, so you know when you have won.',
      steps: ['Write the goal in one sentence', 'Add a number or a date', 'Tell one person about it'] },
    { title: 'Build a weekly {interest} routine', minutes: 10,
      description: 'Block 3 time slots in your calendar for the next 7 days.',
      steps: ['Open your calendar', 'Block 3 slots of 20+ minutes', 'Set reminders'] },
    { title: 'First focused session', minutes: 20,
      description: 'One session, one focus, no phone.',
      steps: ['Put your phone away', 'Practice one skill for 20 minutes', 'Rate the session from 1 to 5'] },
    { title: 'Find what holds you back', minutes: 15,
      description: 'Notice the one thing that slows you down the most.',
      steps: ['Do a short session', 'Write down what was hardest', 'Find one tip for exactly that'] },
    { title: 'Find a {interest} crew member on the map', minutes: 5,
      description: 'Hard goals need a crew. Find someone who is serious about {interest} too.',
      steps: ['Open the map', 'Check people with {interest} on Hard or Medium', 'Send a connect request'] },
    { title: 'Practice the hard part', minutes: 20,
      description: 'Spend a whole session on the thing that holds you back.',
      steps: ['Warm up', 'Spend 15 minutes on the hard part only', 'Note any progress'] },
    { title: 'Keep the streak: 3 sessions this week', minutes: 20,
      description: 'Consistency beats intensity. Three short sessions this week.',
      steps: ['Session one', 'Session two', 'Session three'] },
    { title: 'Take {interest} somewhere new', minutes: 25,
      description: 'Try {interest} in a new public place in your city.',
      steps: ['Pick a new public place', 'Go there and practice', 'Notice what felt different'] },
    { title: 'Measure your progress', minutes: 10,
      description: 'Compare with day one: what is easier now?',
      steps: ['Repeat your first session', 'Compare with your day-one notes', 'Write down your biggest win'] },
    { title: 'Boss level: show your skills together', minutes: 45,
      description: 'Meet your crew member in a public place, do your best session together and capture the moment.',
      steps: ['Plan the session together', 'Meet in a public place', 'Take a photo together and upload it'] },
  ],
};

export function templateDrafts(difficulty: Difficulty, interestName: string): StageDraft[] {
  const name = interestName.toLowerCase();
  const fill = (s: string) => s.replaceAll('{interest}', name);
  return T[difficulty].map((d) => ({
    title: fill(d.title),
    description: fill(d.description),
    minutes: d.minutes,
    steps: d.steps.map(fill),
  }));
}
