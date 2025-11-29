// stories.js — curated non-cringe stories (short/medium/long)
// Each entry: { genre, length: 'short'|'medium'|'long', lines: [..] }
// You can add more entries later.

const STORY_PACK = [
  /* Petty / Relatable */
  { genre:"Petty Revenge", length:"short", lines:[
    "He said I talk too much. So I whispered louder and got the whole table to be quiet."
  ]},
  { genre:"Petty Revenge", length:"medium", lines:[
    "Someone took my charger. So I walked up to them later and asked for the Wi-Fi password with a smile.",
    "They look up when the battery hits 3%. Timing matters."
  ]},
  { genre:"Petty Revenge", length:"long", lines:[
    "My sibling kept using my headphones. I labeled their playlist 'boring' and changed the album art to 'Please return'.",
    "They begged me to fix it and offered snacks. The snacks were the plan."
  ]},

  /* School Chaos */
  { genre:"School Chaos", length:"short", lines:[
    "Fire drill during math test. Everyone left math on the desk like a crime scene."
  ]},
  { genre:"School Chaos", length:"medium", lines:[
    "Substitute said 'be yourselves' and then assigned a pop quiz.",
    "Two minutes later we were all 'our worst selves'."
  ]},
  { genre:"School Chaos", length:"long", lines:[
    "They tried to stop clique lunch tables by reshuffling menus.",
    "We staged a silent protest eating apples and nodding seriously.",
    "Administration forgot how to handle passive-aggression."
  ]},

  /* Crush Awkward */
  { genre:"Crush Awkward", length:"short", lines:[
    "Crush asked if I liked their haircut. I said yes and then complimented the sky."
  ]},
  { genre:"Crush Awkward", length:"medium", lines:[
    "I wrote a note for my crush and left it on a desk. They read it aloud... and asked who 'the memo' was from.",
    "I said 'the universe' and left."
  ]},
  { genre:"Crush Awkward", length:"long", lines:[
    "Tried to be mysterious around crush; tripped over a plant and knocked a poster down.",
    "They laughed and said 'you do you.' Somehow that was better than any speech."
  ]},

  /* Introvert Pain */
  { genre:"Introvert Pain", length:"short", lines:[
    "They asked 'what are you thinking?' I said 'quiet things' and left it at that."
  ]},
  { genre:"Introvert Pain", length:"medium", lines:[
    "Group work: I offered to 'format' the slides and then disappeared until they thanked me.",
    "Ghosting with purpose."
  ]},
  { genre:"Introvert Pain", length:"long", lines:[
    "Party invite: 'be there or be square.' I RSVP 'maybe' and then show up for 12 minutes.",
    "That’s my peak social performance."
  ]},

  /* Sibling / Family */
  { genre:"Sibling War", length:"short", lines:[
    "Sibling ate my leftovers. I poured glitter into their pencil case. Harmless, iconic."
  ]},
  { genre:"Sibling War", length:"medium", lines:[
    "Little brother hid my homework. I left a fake map and watched him search for hours.",
    "He found the map, not the homework. I still have the map."
  ]},
  { genre:"Sibling War", length:"long", lines:[
    "My sister borrowed my jacket and returned it with a sticker on the sleeve.",
    "I posted the picture 'found: stolen goods'. Family group chat erupted in investigations."
  ]},

  /* Low-Effort Genius */
  { genre:"Low-Effort Genius", length:"short", lines:[
    "I did the title slide. They called me the project lead. Small wins."
  ]},
  { genre:"Low-Effort Genius", length:"medium", lines:[
    "Task: 'design the presentation'. I used a template and minimal words.",
    "Teacher complimented the 'clean aesthetic' and I bowed to the template gods."
  ]},
  { genre:"Low-Effort Genius", length:"long", lines:[
    "Exam day: I prepared a one-page cheat sheet. It matched the final.",
    "That single sheet is now in my personal hall of fame."
  ]},

  /* Teacher stuff */
  { genre:"Teacher Behavior", length:"short", lines:[
    "Teacher said 'no phones' but checked their phone for 12 minutes. I took notes."
  ]},
  { genre:"Teacher Behavior", length:"medium", lines:[
    "Sub told a story about being a spy. We took notes like it was a lecture.",
    "Nobody questioned it."
  ]},
  { genre:"Teacher Behavior", length:"long", lines:[
    "Teacher: 'You’ll use this in life.' Ten years later: 'maybe.'",
    "Reality didn't RSVP to class."
  ]},

  /* Lunchroom Logic */
  { genre:"Lunchroom Logic", length:"short", lines:[
    "Cafeteria spaghetti redesigned my worldview. I accept defeat."
  ]},
  { genre:"Lunchroom Logic", length:"medium", lines:[
    "Dessert line looked empty so I ran. Glory is sweet but crumbly."
  ]},
  { genre:"Lunchroom Logic", length:"long", lines:[
    "They introduced a 'mystery dessert'. We formed an investigation committee.",
    "Turns out it was just very confident applesauce."
  ]},

  /* Absurd Random */
  { genre:"Absurd Random", length:"short", lines:[
    "Someone did a dramatic slow clap in the hall and I applauded the energy."
  ]},
  { genre:"Absurd Random", length:"medium", lines:[
    "I labeled my notebook 'top secret'. People touched it exactly once.",
    "Research complete."
  ]},
  { genre:"Absurd Random", length:"long", lines:[
    "We started a club for people who refuse to join clubs.",
    "We met once, held a solemn nap, and disbanded with dignity."
  ]},

  /* Academic Pain */
  { genre:"Academic Pain", length:"short", lines:[
    "Professor asked 'who read the assignment?' I raised my hand and lied."
  ]},
  { genre:"Academic Pain", length:"medium", lines:[
    "Midterm: 'Write something.' I wrote the truth and got a 'see me'. Worth it."
  ]},
  { genre:"Academic Pain", length:"long", lines:[
    "Group project devolved into drama but the final slides were immaculate.",
    "Turns out spreadsheets are the therapy none of us knew we needed."
  ]},

  /* Hallway Humor */
  { genre:"Hallway Humor", length:"short", lines:[
    "Someone ran like it was the Olympics. Nobody qualified."
  ]},
  { genre:"Hallway Humor", length:"medium", lines:[
    "Locker jammed; we formed a rescue team with duct tape and optimism.",
    "It worked. Confidence rising."
  ]},
  { genre:"Hallway Humor", length:"long", lines:[
    "Senior prank hijacked announcements with meme songs. The principal hummed along privately.",
    "History will remember that playlist."
  ]},

  /* Roast (clean) */
  { genre:"Cringe-free Roast", length:"short", lines:[
    "You copied my notes — thanks for outsourcing your studying."
  ]},
  { genre:"Cringe-free Roast", length:"medium", lines:[
    "They copied my answers and then asked for my explanation to the teacher.",
    "That’s bravery I won't forget."
  ]},
  { genre:"Cringe-free Roast", length:"long", lines:[
    "Someone tried to roast me and forgot the joke halfway through.",
    "We both clapped anyway. Honesty deserves applause."
  ]},

  // You can append more stories here.
];

function categories(){
  const s = new Set(); STORY_PACK.forEach(x=>s.add(x.genre)); return Array.from(s);
}
function getRandomStory(cat='any', len='any'){
  let pool = STORY_PACK.slice();
  if(cat !== 'any') pool = pool.filter(x=>x.genre === cat);
  if(len !== 'any') pool = pool.filter(x=>x.length === len);
  if(pool.length === 0) return null;
  return pool[Math.floor(Math.random()*pool.length)];
}

window.BR_STORIES = { STORY_PACK, categories, getRandomStory };
