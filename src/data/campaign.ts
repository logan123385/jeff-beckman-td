export interface CampaignLocation { x: number; y: number; region: string; objective: string; tactic: string; }
export const CAMPAIGN_LOCATIONS: Record<string, CampaignLocation> = {
  crawlspace: { x: 12, y: 72, region: 'The lowlands', objective: 'Keep the first basement dry.', tactic: 'A barricade at a bend buys your washer time to hit the whole pack.' },
  boilerRoom: { x: 29, y: 52, region: 'Old town', objective: 'Restore pressure to the neighborhood.', tactic: 'Mineral shells shrug off water. Put a torch behind the crew and cover both approaches.' },
  radiantFloor: { x: 17, y: 28, region: 'The terraces', objective: 'Bring warmth back to the valley.', tactic: 'Radiant heat both melts ice and protects nearby towers from freezing.' },
  municipalMain: { x: 43, y: 24, region: 'The river crossing', objective: 'Break the Rogue Boiler’s siege.', tactic: 'Watch the red pressure circle. Move the crew or stun the boss before it vents.' },
  snowmelt: { x: 67, y: 17, region: 'Frostline pass', objective: 'Reopen the frozen mountain road.', tactic: 'Pair heat and armor stripping. Keep a thawing tower close to your frontline.' },
  attic: { x: 85, y: 34, region: 'The high roofs', objective: 'Clear the swarm above the rooftops.', tactic: 'Flying enemies ignore the frontline. Invest in anti-air coverage before the rush.' },
  liftStation: { x: 66, y: 53, region: 'The wetland', objective: 'Drain the rising floodwaters.', tactic: 'Cover both routes. A second rally point matters more than an isolated expensive tower.' },
  mechanicalRoom: { x: 83, y: 74, region: 'The works', objective: 'Take back the machinery district.', tactic: 'Strip armor first, then concentrate fire. Save Summon Logan for a leak through the line.' },
  heatPlant: { x: 49, y: 80, region: 'The furnace district', objective: 'Silence the First Furnace.', tactic: 'The final boss targets your largest investment. Rally away from the marked impact zone and interrupt its cast.' },
};
