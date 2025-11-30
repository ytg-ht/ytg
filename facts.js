// facts.js — default facts pools. Each pool contains many single-line facts.
// The generator picks N facts (unique) from the selected pool.

const FACT_POOLS = {
  random: [
    "Honey never spoils; archaeologists found edible honey in ancient tombs.",
    "Bananas are berries but strawberries are not.",
    "Octopuses have three hearts and blue blood.",
    "There are more possible chess games than atoms in the observable universe.",
    "A day on Venus is longer than a year on Venus.",
    "Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid.",
    "The Eiffel Tower can be 15 cm taller during hot days.",
    "Wombat poop is cube-shaped — it helps them mark territory.",
    "Sharks existed before trees evolved on Earth.",
    "A bolt of lightning contains enough energy to toast 100,000 slices of bread."
  ],
  science: [
    "Water can boil and freeze at the same time under a vacuum (triple point).",
    "Our bones are constantly renewing; your skeleton replaces itself about every 10 years.",
    "Neutron stars are so dense that a sugar-cube-sized amount would weigh about a billion tons.",
    "If you could drive straight up, you'd reach space in about an hour at highway speeds.",
    "Plants can communicate through fungal networks sometimes called the wood-wide web.",
    "There are more possible protein sequences than there are atoms in the universe.",
    "A teaspoon of neutron star material would weigh as much as Mount Everest.",
    "Sunlight takes about 8 minutes and 20 seconds to reach Earth.",
    "Some bacteria can survive decades in extreme dormancy and reanimate later.",
    "Saturn's rings are mostly made of water ice and are incredibly thin relative to their width."
  ],
  history: [
    "Oxford University existed before the Aztec empire was founded.",
    "The shortest war in history lasted around 40 minutes (UK vs Zanzibar, 1896).",
    "The Great Pyramid was the tallest man-made structure for over 3,800 years.",
    "During WWII, a Great Dane named Juliana was awarded for extinguishing an incendiary bomb by peeing on it.",
    "Vikings used a type of 'sunstone' crystal for navigation on cloudy days.",
    "Roman concrete's durability came from volcanic ash in the mortar.",
    "Ketchup used to be sold as a medicine in the 1830s.",
    "A president once survived a bullet because the bullet hit a metal eyeglass case in his pocket.",
    "Some ancient coins contain microscopic layers of gold leaf to save metal.",
    "Railroad spikes were sometimes used as money in frontier towns."
  ],
  weird: [
    "A single strand of spider silk is thinner than human hair but stronger than steel by weight.",
    "In Japan there is an island populated almost entirely by rabbits.",
    "There's a species of jellyfish that is biologically immortal (Turritopsis dohrnii).",
    "The smell after rain even has a name: petrichor.",
    "There's a plant called the 'resurrection plant' that can come back to life after drying.",
    "A small town in Norway has more bicycles than people.",
    "Some plants eat animals — the venus flytrap traps insects to survive.",
    "There's a tiny moon orbiting the asteroid Ida called Dactyl.",
    "The longest-living animal known grew to over 500 years (a clam named Ming).",
    "A single cloud can weigh more than a million pounds."
  ]
};

// helper
function pickFacts(poolName='random', count=7){
  const pool = FACT_POOLS[poolName] || FACT_POOLS['random'];
  const copy = pool.slice();
  const out = [];
  while(out.length < count && copy.length > 0){
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i,1)[0]);
  }
  return out;
}

window.FACT_POOLS = FACT_POOLS;
window.pickFacts = pickFacts;
