// stories.js — large curated story pack (short, medium, long) — non-cringe, relatable
const STORY_PACK = [
  // each item: { genre, length, lines }
  { genre:"Petty Revenge", length:"short", lines:[
    "She said I talk too much. So I whispered louder. It was an instant win."
  ]},
  { genre:"Petty Revenge", length:"short", lines:[
    "Someone stole my charger. I notified them when their battery hit 1%."
  ]},
  { genre:"Petty Revenge", length:"medium", lines:[
    "Kid called me 'extra' in class. Next week I brought snacks for everyone.",
    "He didn't get any. Karma looked delicious."
  ]},
  { genre:"Petty Revenge", length:"long", lines:[
    "My brother used my stuff without asking for months.",
    "I replaced his phone ringtone with classical music.",
    "Now his 'sneak' moves come with violins. Justice served."
  ]},

  { genre:"School Chaos", length:"short", lines:[
    "Fire drill during a quiz. We all got passes. Best plot twist."
  ]},
  { genre:"School Chaos", length:"medium", lines:[
    "Teacher said 'lining up quietly' and someone started a whisper chant.",
    "It became a movement. Now we have a whisper club."
  ]},
  { genre:"School Chaos", length:"long", lines:[
    "They rearranged the lunch seating chart to stop 'cliques'.",
    "We staged a fake press conference about 'food equality'.",
    "Suddenly the cafeteria started charging popularity fees. We laughed, they fixed it."
  ]},

  { genre:"Crush Awkward", length:"short", lines:[
    "I complimented their hoodie. They thought I was flirting with the hoodie."
  ]},
  { genre:"Crush Awkward", length:"medium", lines:[
    "Crush asked if I liked 'mystery novels'. I said yes.",
    "Turns out their ex wrote one. Awkward silence."
  ]},
  { genre:"Crush Awkward", length:"long", lines:[
    "I tried to be mysterious around my crush. I tripped over a potted plant.",
    "They asked if I was okay. I said I was 'collecting dramatic energy.'",
    "They left with a smile. That's a win."
  ]},

  { genre:"Introvert Pain", length:"short", lines:[
    "Teacher: 'Share something about yourself.' Me: 'I share things offline.'"
  ]},
  { genre:"Introvert Pain", length:"medium", lines:[
    "Group activity time. I sit in the corner and power-save my personality.",
    "They think I'm aloof. I'm conserving bandwidth."
  ]},
  { genre:"Introvert Pain", length:"long", lines:[
    "Party invite: 'Everyone's coming.' I RSVP 'maybe' and call it a plan.",
    "I show up late for 10 minutes and leave. Peak performance."
  ]},

  { genre:"Sibling War", length:"short", lines:[
    "Brother yelled at me; I set his alarm 7 minutes earlier. Revenge is punctual."
  ]},
  { genre:"Sibling War", length:"medium", lines:[
    "Little sibling hid my homework. I wrote a fake 'treasure map' and watched them search.",
    "They never found it. I still have the map."
  ]},
  { genre:"Sibling War", length:"long", lines:[
    "Sibling stole my hoodie. I posted a photo of them wearing it to our family chat.",
    "Now relatives send me 'where did you find that hoodie?' messages. Chaos."
  ]},

  { genre:"Low-Effort Genius", length:"short", lines:[
    "Group project: I 'format' the slides and got the credit. Efficiency."
  ]},
  { genre:"Low-Effort Genius", length:"medium", lines:[
    "I said I'd handle 'the slides'. I used templates and added one sentence.",
    "Teacher called it 'clean design.' They don't know how little effort it took."
  ]},
  { genre:"Low-Effort Genius", length:"long", lines:[
    "Exam day: I show up with a single sheet of formulas I 'might' need.",
    "Turns out it was exactly what we needed. Future me says 'you're welcome.'"
  ]},

  { genre:"Teacher Behavior", length:"short", lines:[
    "Teacher said 'I won't be late' and arrived 22 minutes late. Role reversal."
  ]},
  { genre:"Teacher Behavior", length:"medium", lines:[
    "Substitute introduced themselves like a villain origin story.",
    "We behaved out of pure curiosity. It was chaos and we loved it."
  ]},
  { genre:"Teacher Behavior", length:"long", lines:[
    "Teacher announced a pop quiz; we all acted surprised.",
    "One student actually studied and the class looked at them like an anomaly.",
    "They deserved their medal."
  ]},

  { genre:"Lunchroom Logic", length:"short", lines:[
    "Cafeteria special: 'mystery meat'. I say it's an identity, not a food."
  ]},
  { genre:"Lunchroom Logic", length:"medium", lines:[
    "They gave me a tray with no dessert. I traded my social credit for cookies and left victorious."
  ]},
  { genre:"Lunchroom Logic", length:"long", lines:[
    "The lunch lady winked and said there's a 'secret menu'. We queued like cult members.",
    "It was just apples with sprinkles. The line was still worth it."
  ]},

  { genre:"Social Flex", length:"short", lines:[
    "I pretended my phone died to avoid a meeting. It worked. Power move."
  ]},
  { genre:"Social Flex", length:"medium", lines:[
    "Someone asked me for advice. I gave them a two-step plan and watched them become the problem solver.",
    "I charged them compliments later."
  ]},
  { genre:"Social Flex", length:"long", lines:[
    "Class gossip circle started. I fed them tiny truths and watched the domino effect.",
    "No drama started. Controlled chaos, that's talent."
  ]},

  { genre:"Darkish Irony", length:"short", lines:[
    "Teacher: 'This will be useful later.' 10 years later: 'Nope.'"
  ]},
  { genre:"Darkish Irony", length:"medium", lines:[
    "We made a 'safety plan' for the school play. We forgot the script.",
    "The improv saved the night and somehow the principal cried. Theater is weird."
  ]},
  { genre:"Darkish Irony", length:"long", lines:[
    "Someone said they'd 'never' change. Then they changed everything.",
    "We celebrated by starting a new rumor — about our own growth. Meta."
  ]},

  { genre:"Absurd Random", length:"short", lines:[
    "Elevator music played and someone slowed down dramatically. 10/10 performance."
  ]},
  { genre:"Absurd Random", length:"medium", lines:[
    "I labeled my notebook 'do not open' and watched people fail the temptation test.",
    "I called it 'behavioral science'."
  ]},
  { genre:"Absurd Random", length:"long", lines:[
    "I started a club for people who don't want to be in clubs.",
    "We met once, apologised, and never met again.",
    "The manifesto was just nap times."
  ]},

  { genre:"Academic Pain", length:"short", lines:[
    "Midterm: 'Explain yourself.' Me: 'I regret a few choices.'"
  ]},
  { genre:"Academic Pain", length:"medium", lines:[
    "Paper due midnight. I handed something in at 11:59 with a paragraph of honesty.",
    "Received a polite 'see me' reply. That's fine."
  ]},
  { genre:"Academic Pain", length:"long", lines:[
    "Group project turned into a soap opera.",
    "We fixed the slides and destroyed the drama with graphs.",
    "Numbers don't lie, and neither do receipts."
  ]},

  { genre:"Hallway Humor", length:"short", lines:[
    "Someone ran in the hallway like they had to catch their future. They didn't."
  ]},
  { genre:"Hallway Humor", length:"medium", lines:[
    "Locker jammed. We staged a rescue mission like it was a film set.",
    "Two students and a pencil saved the day."
  ]},
  { genre:"Hallway Humor", length:"long", lines:[
    "Senior pranked the PA system. We jammed every announcement with meme songs.",
    "Principals smiled secretly; it was organized chaos."
  ]},

  { genre:"Cringe-free Roast", length:"short", lines:[
    "You looked at my notes — thanks for the free tutoring notes."
  ]},
  { genre:"Cringe-free Roast", length:"medium", lines:[
    "They copied my homework and then asked for help explaining it to the teacher.",
    "I don't envy their confidence."
  ]},
  { genre:"Cringe-free Roast", length:"long", lines:[
    "Someone tried to roast me and forgot the punchline halfway through.",
    "I applauded. We both learned humility."
  ]},

  // Add more variations until you have a large library. Here we included many to get you started.
];

// Helpers
function categories(){
  const set = new Set();
  STORY_PACK.forEach(s => set.add(s.genre));
  return Array.from(set);
}
function getRandomStory(cat='any', len='any'){
  let pool = STORY_PACK.slice();
  if(cat !== 'any') pool = pool.filter(s => s.genre === cat);
  if(len !== 'any') pool = pool.filter(s => s.length === len);
  if(pool.length === 0) return null;
  return pool[Math.floor(Math.random()*pool.length)];
}
window.BR_STORIES = { STORY_PACK, categories, getRandomStory };
