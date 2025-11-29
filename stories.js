// stories.js — curated short/medium/long non-cringe stories
const STORY_PACK = [
  /* Petty Revenge */
  { genre:"Petty Revenge", length:"short", lines:[
    "She said I talk too much. So I whispered louder. Instant silence."
  ]},
  { genre:"Petty Revenge", length:"short", lines:[
    "Someone took my charger. I notified them when their battery hit 1%."
  ]},
  { genre:"Petty Revenge", length:"medium", lines:[
    "Kid called me 'extra' in class. Next week I brought snacks for everyone.",
    "He didn't get any. Karma looked delicious."
  ]},
  { genre:"Petty Revenge", length:"long", lines:[
    "My brother used my stuff without asking for months.",
    "I replaced his ringtone with dramatic classical music.",
    "Now every sneak move arrives with violins. Justice served."
  ]},

  /* School Chaos */
  { genre:"School Chaos", length:"short", lines:[
    "Fire drill during a quiz — we all got passes. Best plot twist."
  ]},
  { genre:"School Chaos", length:"medium", lines:[
    "Teacher said 'lining up quietly' and someone started a whisper chant.",
    "It became a club. We wore badges."
  ]},
  { genre:"School Chaos", length:"long", lines:[
    "They rearranged the lunch seating chart to stop cliques.",
    "We staged a fake press conference about 'food equality'.",
    "They fixed the chart and we celebrated with cookies."
  ]},

  /* Crush Awkward */
  { genre:"Crush Awkward", length:"short", lines:[
    "I complimented their hoodie. They thought I was flirting with the hoodie."
  ]},
  { genre:"Crush Awkward", length:"medium", lines:[
    "Crush asked if I liked mystery novels. I said yes.",
    "Turns out their ex wrote one. Awkward silence."
  ]},
  { genre:"Crush Awkward", length:"long", lines:[
    "I tried to act mysterious around my crush and tripped over a potted plant.",
    "They checked if I was okay. I said I was 'collecting dramatic energy.'",
    "They smiled. That's a win."
  ]},

  /* Introvert Pain */
  { genre:"Introvert Pain", length:"short", lines:[
    "Teacher: 'Share something about yourself.' Me: 'I share things offline.'"
  ]},
  { genre:"Introvert Pain", length:"medium", lines:[
    "Group activity time. I sit in the corner and power-save my personality.",
    "They think I'm aloof. I'm conserving bandwidth."
  ]},
  { genre:"Introvert Pain", length:"long", lines:[
    "Party invite: 'Everyone's coming.' I RSVP 'maybe' and call it a plan.",
    "I show up for 10 minutes and leave. Peak performance."
  ]},

  /* Sibling War */
  { genre:"Sibling War", length:"short", lines:[
    "Brother ate my leftovers. I set his alarm seven minutes earlier. Revenge is punctual."
  ]},
  { genre:"Sibling War", length:"medium", lines:[
    "Little sibling hid my homework. I drew a treasure map and watched them search.",
    "Still have the map."
  ]},
  { genre:"Sibling War", length:"long", lines:[
    "Sibling wore my hoodie. I posted the photo to family chat with the caption 'found in the wild.'",
    "Relatives sent rescue missions. Chaos."
  ]},

  /* Low-Effort Genius */
  { genre:"Low-Effort Genius", length:"short", lines:[
    "Group project: I formatted the slides and got the credit. Efficiency."
  ]},
  { genre:"Low-Effort Genius", length:"medium", lines:[
    "I said I'd make the slides. Used a template and one sentence.",
    "Teacher called it 'clean design.' They don't know the truth."
  ]},
  { genre:"Low-Effort Genius", length:"long", lines:[
    "Exam day: I show up with one formula sheet I 'might' need.",
    "It was exactly what the test asked. Future me: you're welcome."
  ]},

  /* Teacher Behavior */
  { genre:"Teacher Behavior", length:"short", lines:[
    "Teacher: 'I won't be late.' Arrived 22 minutes late. Role reversal."
  ]},
  { genre:"Teacher Behavior", length:"medium", lines:[
    "Substitute introduced themselves like a villain origin story.",
    "We behaved purely out of curiosity. It was chaos and we loved it."
  ]},
  { genre:"Teacher Behavior", length:"long", lines:[
    "Teacher announced a pop quiz; one student actually studied.",
    "We all looked at them like a rare artifact. They deserved the medal."
  ]},

  /* Lunchroom Logic */
  { genre:"Lunchroom Logic", length:"short", lines:[
    "Cafeteria special: 'mystery meat'. I call that an identity."
  ]},
  { genre:"Lunchroom Logic", length:"medium", lines:[
    "No dessert on my tray. I traded social credit for cookies and left victorious."
  ]},
  { genre:"Lunchroom Logic", length:"long", lines:[
    "The lunch lady whispered about a 'secret menu'. We queued like cult members.",
    "It was apples with sprinkles. Still worth it."
  ]},

  /* Social Flex */
  { genre:"Social Flex", length:"short", lines:[
    "Pretended my phone died to avoid a meeting. Power move."
  ]},
  { genre:"Social Flex", length:"medium", lines:[
    "Someone asked me for advice. I gave a two-step plan and watched them become the hero.",
    "I accepted a small compliment as fee."
  ]},
  { genre:"Social Flex", length:"long", lines:[
    "Gossip circle started; I fed tiny truths and watched the dominoes fall.",
    "No drama started. Controlled chaos is my art."
  ]},

  /* Darkish Irony */
  { genre:"Darkish Irony", length:"short", lines:[
    "Teacher: 'This will be useful later.' Ten years later: 'Nope.'"
  ]},
  { genre:"Darkish Irony", length:"medium", lines:[
    "We made a safety plan for a play and forgot the script.",
    "Improv saved it and the principal cried. Theater is wild."
  ]},
  { genre:"Darkish Irony", length:"long", lines:[
    "Someone said they'd 'never' change. Then changed everything overnight.",
    "We celebrated by making a rumor about their transformation. Meta."
  ]},

  /* Absurd Random */
  { genre:"Absurd Random", length:"short", lines:[
    "Elevator music started and someone slowed down dramatically. 10/10 performance."
  ]},
  { genre:"Absurd Random", length:"medium", lines:[
    "I labeled my notebook 'do not open' and watched temptation failers.",
    "I called it behavioral science."
  ]},
  { genre:"Absurd Random", length:"long", lines:[
    "I started a club for people who don't want to be in clubs.",
    "We met, apologized, and never met again."
  ]},

  /* Academic Pain */
  { genre:"Academic Pain", length:"short", lines:[
    "Midterm asked 'Explain yourself.' Me: 'I regret a few choices.'"
  ]},
  { genre:"Academic Pain", length:"medium", lines:[
    "Paper due midnight. I submitted one paragraph of honesty at 11:59.",
    "Got a 'see me'. It's fine."
  ]},
  { genre:"Academic Pain", length:"long", lines:[
    "Group project turned into a soap opera.",
    "We fixed slides and extinguished drama with graphs. Numbers don't lie."
  ]},

  /* Hallway Humor */
  { genre:"Hallway Humor", length:"short", lines:[
    "Someone ran like they were late for their destiny. They were not."
  ]},
  { genre:"Hallway Humor", length:"medium", lines:[
    "Locker jammed; we staged a rescue mission.",
    "Two students and a pencil saved the day."
  ]},
  { genre:"Hallway Humor", length:"long", lines:[
    "Senior pranked the PA system; we turned announcements into meme hour.",
    "Principals smiled secretly. Organized chaos."
  ]},

  /* Cringe-free Roast */
  { genre:"Cringe-free Roast", length:"short", lines:[
    "You looked at my notes — thanks for the free tutoring notes."
  ]},
  { genre:"Cringe-free Roast", length:"medium", lines:[
    "They copied my homework and asked me to explain it to the teacher.",
    "Confidence is impressive."
  ]},
  { genre:"Cringe-free Roast", length:"long", lines:[
    "Someone tried to roast me and forgot the punchline.",
    "I clapped. We both learned humility."
  ]},

  /* Add more later as you like */
];

// helpers
function categories(){
  const s = new Set();
  STORY_PACK.forEach(x=>s.add(x.genre));
  return Array.from(s);
}
function getRandomStory(cat='any', len='any'){
  let pool = STORY_PACK.slice();
  if(cat !== 'any') pool = pool.filter(x=>x.genre === cat);
  if(len !== 'any') pool = pool.filter(x=>x.length === len);
  if(pool.length === 0) return null;
  return pool[Math.floor(Math.random()*pool.length)];
}

window.BR_STORIES = { STORY_PACK, categories, getRandomStory };
