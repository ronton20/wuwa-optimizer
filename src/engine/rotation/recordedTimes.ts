import type { TimingKind } from './actions';

/**
 * Action times measured from the owner's gameplay recordings (skill `model-character-timings`), in seconds
 * from one input to the next. `moves` is keyed by the move's label as the rotation screen shows it
 * ("Heavy Attack - Bitterfrost: Foreclaimed Self"); `kinds` covers every other move of that kind.
 * Anything not here falls back to the machine's estimate, then DEFAULT_TIMES.
 */
export interface RecordedTimes {
  kinds?: Partial<Record<TimingKind, number>>;
  moves?: Record<string, number>;
  /** where the numbers came from: recording file name and date */
  source: string;
}

// All game time read off the Tower of Adversity timer (it stops during Liberation cinematics), owner's
// tests-support/recordings/hiyuki/toa_1.mp4 and toa_3.mp4 with their press lists, 2026-11-27.
export const RECORDED_TIMES: Record<string, RecordedTimes> = {
  Hiyuki: {
    source: 'ToA floors 1 and 3 (hiyuki/toa_1, toa_3), 2026-11-27; training-room animations (hiyuki/Hiyuki timings.mp4), 2026-11-28',
    // switching in with Outro + Intro hides the UI for 1.48–1.70 s (4 switches)
    kinds: { intro: 1.6 },
    moves: {
      // training room, each move from its first frame to idle (no input display, so not cancel points)
      'Basic Attack - Present Self Stage 1': 0.7,
      'Basic Attack - Present Self Stage 2': 0.55,
      'Resonance Skill - Present Self': 1.7,
      'Resonance Skill - Frostblight: Jade Cleave': 1.1,
      'Resonance Skill - Frostblight: Petalfall': 0.9,
      'Basic Attack - Iai': 1.0, // 2nd and 3rd Iai of three; the 1st ran 2.6 s with the Iai Stance entry
      // real animation; ToA stops the clock for these (FROZEN_LIBERATION_TIME / stopsClock)
      'Resonance Liberation - Foreclaiming: Inward Vision': 4.1,
      'Resonance Liberation - Foreclaiming: Blade Liberation': 6.0,
      'Heavy Attack - Bitterfrost: Foreclaimed Self': 3.1,
      // Intro landing → Inward Vision cast took 4.2 / 4.3 / 4.5 s in ToA. Frost Splinter alone is ~2.1 s in the
      // training room; Stage 3 alone is ~1.4 s there, so ~0.8 s of the ToA stretch is the Intro's tail / walking in
      'Basic Attack - Present Self Stage 3': 2.2,
      'Heavy Attack - Frost Splinter: Present Self': 2.1,
      // Inward Vision → first Resonance Skill: 4.3 s (with an Echo) and 4.2 s for the 5-stage string
      'Basic Attack - Foreclaimed Self Stage 1': 0.85,
      'Basic Attack - Foreclaimed Self Stage 2': 0.85,
      'Basic Attack - Foreclaimed Self Stage 3': 0.85,
      'Basic Attack - Foreclaimed Self Stage 4': 0.85,
      'Basic Attack - Foreclaimed Self Stage 5': 0.85,
    },
  },
  Suisui: {
    source: 'ToA floors 1 and 3 (hiyuki/toa_1, toa_3), 2026-11-27',
    moves: {
      // first input → Awakening Spring: 2.4–2.9 s for 4 Zephyr Basics
      'Basic Attack - Zephyr Stance Stage 1': 0.65,
      'Basic Attack - Zephyr StanceStage 2': 0.65, // the game's own label has no space
      'Basic Attack - Zephyr Stance Stage 3': 0.65,
      'Basic Attack - Zephyr Stance Stage 4': 0.65,
      'Resonance Skill - Awakening Spring': 1.0, // 0.99 s to the Liberation press
      // end of the Liberation cinematic → switch: 6.0 s for 4 Drizzle Basics + Echo, 6.7 s for 5 + Echo
      'Basic Attack - Drizzle Stance Stage 1': 1.25,
      'Basic Attack - Drizzle Stance Stage 2': 1.25,
      'Basic Attack - Drizzle Stance Stage 3': 1.25,
      'Basic Attack - Drizzle Stance Stage 4': 1.25,
    },
  },

  // Cartethyia team: tests-support/recordings/cartethyia/toa_1.mp4 (ToA floor 1) with the owner's press list, 2026-11-27.
  // Each stretch between two casts (skill cooldowns starting, Liberation cinematics, switches) is exact game time;
  // inside a stretch the split follows the default times' proportions unless a comment says it was seen.
  Chisa: {
    source: 'ToA floor 1 (cartethyia/toa_1), 2026-11-27',
    kinds: { echo: 1.0 }, // Echo → Serrated Loop: 1.04 s
    moves: {
      // Eye of Unraveling → Liberation press: 3.10 s for Skill + 3 Basics
      'Resonance Skill - Eye of Unraveling': 1.1, 'Normal Attack - Rending Lunge': 0.65, 'Normal Attack - Death Snip': 0.7, 'Normal Attack - Death Snip Additional': 0.65,
      // Serrated Loop → switch: 4.0 s for Serrated Loop, Blitz 2, Blitz 3 (the Outro cancelled the Eradication)
      'Resonance Skill - Serrated Loop': 1.35, 'Sawring - Blitz Stage 2 + Discordance': 1.35, 'Sawring - Blitz Stage 3 + Falltone': 1.3,
    },
  },
  Ciaccona: {
    source: 'ToA floor 1 (cartethyia/toa_1), 2026-11-27',
    kinds: { intro: 0.8 },
    moves: {
      // switch → Resonance Skill: 3.45 s for Intro, Stage 3, 4, jump, Mid-air 1, 2, Stage 4 (cancels throughout)
      'Normal Attack - Stage 3': 0.4, 'Normal Attack - Stage 4': 0.4, Jump: 0.2, 'Mid-air Attack Stage 1': 0.6, 'Mid-air Attack Stage 2': 0.65,
      // Resonance Skill → Liberation press: 1.7 s for Skill + Quadruple Downbeat
      'Resonance Skill - Harmonic Allegro': 0.8, 'Forte Circuit - Quadruple Downbeat': 0.9,
    },
  },
  Cartethyia: {
    source: 'ToA floor 1 (cartethyia/toa_1), 2026-11-27',
    // switch → Resonance Skill: 4.7 s for Intro + Basic 2, 3, 4; her later Basic 1-4 + Heavy took 3.66 s (~0.62 per Basic),
    // so the Intro gets the rest (estimate)
    kinds: { intro: 2.85, echo: 0.8 },
    moves: {
      'Basic Attack - Cartethyia Stage 1': 0.62, 'Basic Attack - Cartethyia Stage 2': 0.62, 'Basic Attack - Cartethyia Stage 3': 0.62, 'Basic Attack - Cartethyia Stage 4': 0.62,
      'Heavy Attack - Cartethyia': 1.2,
      // Resonance Skill → Liberation press: 2.08 s for Skill + plunge
      'Resonance Skill - Cartethyia': 1.1, 'Mid-air Attack - Cartethyia': 1.0,
      // Answer Waves' Call is cancelled into the Echo right away (0.14 s); Echo → May Tempest: 2.8 s for Echo, jump, Mid-air 1, 2
      "Resonance Skill - Sword to Answer Waves' Call": 0.15, Jump: 0.3, 'Mid-air Attack - Fleurdelys Stage 1': 0.85, 'Mid-air Attack - Fleurdelys Stage 2': 0.85,
      // May Tempest → finisher: 6.7 s, split where her Conviction ring stepped up (seen)
      'Resonance Skill - May Tempest Break the Tides': 1.6, 'Basic Attack - Fleurdelys Stage 3': 0.9, 'Basic Attack - Fleurdelys Stage 4': 0.9,
      'Basic Attack - Fleurdelys Stage 5': 1.0, 'Heavy Attack - Fleurdelys': 0.6, 'Enhanced Heavy Attack - Fleurdelys': 1.7,
    },
  },
};
